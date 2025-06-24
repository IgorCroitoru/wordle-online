import { Room, Client } from "colyseus";
import { WordleGameState, Player } from "../schemas/WordleGameState";
import { SOCKET_MESSAGES } from "../../shared/types/messages";
import { getRandomWord, isValidWord, isLanguageSupported } from "../words";

interface JoinOptions {
  playerName: string;
  persistentId?: string; // Optional persistent ID for player
  wordleRoomId?: string;
  language?: string; // Language for the game
}

interface GuessMessage {
  guess: string;
}

interface ReadyMessage {
  ready: boolean;
}

interface StartRoundMessage {
  // Empty for now
}

// Player snapshot for when they disconnect
interface PlayerSnapshot {
  persistentId: string;
  playerName: string;
  roundNumber: number;
  currentRow: number;
  gameStatus: "waiting" | "playing" | "won" | "lost";
  isReady: boolean;
  completionTime?: number;
  totalScore: number;
  progress: ("empty" | "absent" | "present" | "correct")[];
  guesses: string[];
  disconnectedAt: number;
}

export class WordleRoom extends Room<WordleGameState> {
  private playerSnapshots = new Map<string, PlayerSnapshot>(); // persistentId -> snapshot
  private playerSessions = new Map<string, string>(); // sessionId -> persistentId
  private cleanupInterval?: NodeJS.Timeout
  private CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private CLEANUP_OLDER_THAN_MS = 10 * 60 * 1000; // 10 minutes
  private language: string = 'en'; // Default language
  maxClients = 6;

  onCreate(options: any) {
    console.log("Creating WordleRoom with options:", options);
    
    // Set language from options or default to English
    this.language = options.language || 'en';
    
    // Validate language is supported
    if (!isLanguageSupported(this.language)) {
      console.warn(`Language ${this.language} not supported, defaulting to English`);
      this.language = 'en';
    }
    
    console.log(`WordleRoom created with language: ${this.language}`);
    
    this.state = new WordleGameState(options.roomId || this.roomId);
    this.startSnapshotCleanupCron()
    console.log("WordleRoom created:", this.roomId);
    // Handle player guess
    this.onMessage(SOCKET_MESSAGES.GUESS, (client, message: GuessMessage) => {
      this.handleGuess(client, message.guess);
    });

    // Handle player ready state
    this.onMessage(SOCKET_MESSAGES.READY, (client, message: ReadyMessage) => {
      this.handleReady(client, message.ready);
    });

    // Handle start round
    this.onMessage(
      SOCKET_MESSAGES.START_ROUND,
      (client, message: StartRoundMessage) => {
        this.handleStartRound();
      }
    );

    // Handle next round
    this.onMessage(SOCKET_MESSAGES.NEXT_ROUND, (client) => {
      this.handleNextRound();
    });
  }
  onJoin(client: Client, options: JoinOptions) {
    console.log(`Player ${options.playerName} joined room ${this.roomId}`);

    const persistentId = options.persistentId || this.generateUUID();
    client.send(SOCKET_MESSAGES.JOINED_ROOM, {
      persistentId: persistentId
    })
    const existingPersistentId = Array.from(this.playerSessions.values())
      .some((id) => id === persistentId)
    const existingSessionId = this.playerSessions.has(client.sessionId);

    if (existingPersistentId || existingSessionId) {
      console.error(
        `Player with persistentId ${persistentId} or sessionId ${client.sessionId} already exists in room ${this.roomId}`
      );
      client.leave(1000, 'Connection already exists'); // Close connection if player already exists
      return;
    }

    this.playerSessions.set(client.sessionId, persistentId);

    // Add player to game state
    this.state.addPlayer(client.sessionId, options.playerName); // Handle player data (either restore from snapshot or create fresh)
    this.handlePlayerDataOnJoin(client, persistentId);

    // Broadcast player joined (optional)
    // this.broadcast("playerJoined", {
    //   playerId: client.sessionId,
    //   playerName: options.playerName,
    //   playerCount: this.state.getPlayerCount(),
    // });

    console.log(
      `Player ${options.playerName} successfully joined with persistentId: ${persistentId}`
    );
  }
  /**
   * Start automatic snapshot cleanup cron
   */
  private startSnapshotCleanupCron(): void {
    this.cleanupInterval = setInterval(() => {
      console.log(`[CRON] Running automatic snapshot cleanup for room ${this.roomId}`);
      
      const beforeCount = this.playerSnapshots.size;
      this.cleanupOldSnapshots(undefined, this.CLEANUP_OLDER_THAN_MS); // Clean up snapshots older than 10 minutes
      const afterCount = this.playerSnapshots.size;
      
      if (beforeCount > afterCount) {
        console.log(`[CRON] Cleaned up ${beforeCount - afterCount} old snapshots`);
      } else {
        console.log(`[CRON] No old snapshots to clean up`);
      }
    }, this.CLEANUP_INTERVAL_MS);

    console.log(`Started snapshot cleanup cron with ${this.CLEANUP_INTERVAL_MS / 1000}s interval`);
  }
   /**
   * Stop the cleanup cron
   */
  private stopSnapshotCleanupCron(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log("Stopped snapshot cleanup cron");
    }
  }
  /**
   * Handle player data when they join - either restore from snapshot or create fresh
   */
  private handlePlayerDataOnJoin(client: Client, persistentId: string) {
    const player = this.state.getPlayer(client.sessionId);
    if (!player) {
      //console.error(`Player not found for session ${client.sessionId}`);
      return;
    }

    const currentRound = this.state.currentRound;
    const existingSnapshot = this.playerSnapshots.get(persistentId);

    if (this.hasValidSnapshot(persistentId)) {
      // Player rejoining in current round - restore from snapshot
      const snapshot = this.playerSnapshots.get(persistentId)!;
      console.log(
        `Restoring snapshot for ${persistentId} in round ${currentRound}:`,
        {
          currentRow: snapshot.currentRow,
          gameStatus: snapshot.gameStatus,
          guessCount: snapshot.guesses.filter((g) => g.length > 0).length,
        }
      );

      // Restore player state from snapshot
      this.restorePlayerFromSnapshot(player, snapshot);
      this.playerSnapshots.delete(persistentId); // Remove snapshot after restoring
      // Send restored guesses to client
      this.sendPrivatePlayerGuessesData(client, persistentId, snapshot.guesses);
    } else {
      // New player or player from previous round - create fresh state
      console.log(
        `Creating fresh state for ${persistentId} in round ${currentRound}`
      );

      // Check if there's an old snapshot (from previous rounds) to restore totalScore
      if (existingSnapshot) {
        console.log(
          `Found previous snapshot for ${persistentId} from round ${existingSnapshot.roundNumber}, restoring totalScore: ${existingSnapshot.totalScore}`
        );

        // Restore accumulated total score from previous rounds
        player.totalScore = existingSnapshot.totalScore;

        // Also restore player name in case it was updated
        if (existingSnapshot.playerName !== player.name) {
          console.log(
            `Updating player name from ${player.name} to ${existingSnapshot.playerName}`
          );
          // Note: You might want to keep the current name instead, depending on your requirements
          // player.name = existingSnapshot.playerName;
        }
      } else {
        console.log(
          `No previous snapshot found for ${persistentId}, starting with fresh state`
        );
      }

      // Initialize fresh round data for current round
      player.setRoundData(currentRound, Array(6).fill(""));

      // Send fresh empty guesses to client
      this.sendPrivatePlayerGuessesData(
        client,
        persistentId,
        player.getGuesses()
      );
    }
  }
  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left room ${this.roomId}`);
    const player = this.state.getPlayer(client.sessionId);
    if (player) {
      // Save player snapshot before removing them
      this.savePlayerSnapshot(client.sessionId);

      // Remove player from game state
      this.state.removePlayer(client.sessionId);

      // Check if round should end after player leaves
      if (this.state.gameState === "playing") {
        this.checkRoundEnd();
      }

      // If no players left, dispose the room
      if (this.state.getPlayerCount() === 0) {
        this.disconnect();
      }
      // Check if all players are ready to start next round
      if (this.state.canStartNextRound() && this.state.allPlayersReady()) {
        this.handleNextRound();
      }
    }
    this.playerSessions.delete(client.sessionId);

  }

  onDispose() {
    console.log("WordleRoom disposed:", this.roomId);
    this.stopSnapshotCleanupCron()
  }
  private handleGuess(client: Client, guess: string) {
    const player = this.state.getPlayer(client.sessionId);
    if (
      !player ||
      player.gameStatus !== "playing" ||
      this.state.gameState !== "playing"
    ) {
      return;
    }

    if (guess.length !== 5 || player.currentRow > 5) {
      return;
    }

    // Validate the word exists in the dictionary
    if (!isValidWord(guess, this.language)) {
      // Send error message to client
      client.send(SOCKET_MESSAGES.INVALID_WORD, {
        word: guess,
      });
      return;
    }

    const persistentId = this.playerSessions.get(client.sessionId);
    if (!persistentId) {
      console.error("No persistent ID found for session:", client.sessionId);
      return;
    }

    // Store the guess in the player's round data
    player.setGuess(player.currentRow, guess);

    // Evaluate the guess
    const evaluation = this.state.evaluateGuess(guess);

    // Update player progress
    for (let i = 0; i < 5; i++) {
      player.progress[player.currentRow * 5 + i] = evaluation[i];
    }

    // Send updated guesses to client
    this.sendPrivatePlayerGuessesData(
      client,
      persistentId,
      player.getGuesses()
    );
    // Check if player won
    const won = evaluation.every((tile) => tile === "correct");

    if (won) {
      player.gameStatus = "won";
      player.completionTime = Date.now() - (this.state.roundStartTime || 0);
      player.isReady = false;
      this.state.getAllPlayers().forEach((player) => {
        const score = this.state.calculatePlayerScore(player);
        //   player.roundScores.push(score);
        player.totalScore += score;
      });
      // Check if round should end
      this.checkRoundEnd();
    } else {
      // Check if player lost (used all rows)
      if (player.currentRow > 5) {
        player.gameStatus = "lost";
        player.isReady = false; // Reset ready state after guess

        this.checkRoundEnd();
        return
      }
      player.currentRow++;

    }

    // Send guess result back to player
    // client.send('guessResult', {
    //   guess,
    //   evaluation,
    //   row: player.currentRow - (won ? 0 : 1),
    //   gameStatus: player.gameStatus
    // });
  }
  private sendPrivatePlayerGuessesData(
    client: Client,
    persistentId: string,
    guesses: string[]
  ) {
    console.log(`Sending guess data to client ${client.sessionId}:`, {
      persistentId,
      roundNumber: this.state.currentRound,
      guesses: guesses.filter((g) => g.length > 0), // Only show non-empty guesses in log
    });

    client.send(SOCKET_MESSAGES.PLAYER_GUESSES, {
      guesses: guesses,
      roundNumber: this.state.currentRound,
      // persistentId: persistentId,
      // Add any other private data here
    });
  }
  private handleReady(client: Client, ready: boolean) {
    const player = this.state.getPlayer(client.sessionId);
    if (!player) return;

    player.isReady = ready;

    // Check if all players are ready to start next round
    if (this.state.canStartNextRound() && this.state.allPlayersReady()) {
      this.handleNextRound();
    }
  }

  private handleStartRound() {
    if (this.state.gameState === "waiting") {
      this.startFirstRound();
    }
  }
  private handleNextRound() {
    if (!this.state.canStartNextRound()) return;

    // const nextWord = this.getWordForRound(this.state.currentRound + 1);
    const nextWord = 'HELLO'
    // Clear old round data and snapshots
    //this.clearOldRoundData();
    // this.cleanupOldSnapshots(2); // Keep snapshots for last 2 rounds

    // Start the next round (this will reset player states)
    this.state.startNextRound(nextWord);

    // Initialize fresh round data for all current players
    this.initializeRoundDataForAllPlayers();

    // Broadcast round started to all clients
    // this.broadcast("roundStarted", {
    //   round: this.state.currentRound,
    //   totalRounds: this.state.totalRounds,
    //   wordLength: 5, // Wordle standard
    //   maxGuesses: 6,
    // });

    // Send fresh private data to all clients
    this.syncAllPlayersRoundData();
  }
  // private clearOldRoundData() {
  //   // Clean up old snapshots (older than current round)
  //   this.cleanupOldSnapshots(0); // Remove all snapshots from previous rounds
  // }
  /**
   * Initialize fresh round data for all currently connected players
   */
  private initializeRoundDataForAllPlayers() {
    const currentRound = this.state.currentRound;
    console.log(`Initializing round data for round ${currentRound}`);

    // Initialize round data for all current players
    for (const [sessionId, persistentId] of this.playerSessions.entries()) {
      const player = this.state.getPlayer(sessionId);
      if (player) {
        // Set fresh round data in player instance
        player.setRoundData(currentRound, Array(6).fill(""));
        console.log(
          `Initialized round data for player ${player.name} (${persistentId})`
        );
      }
    }
  }
  /**
   * Send fresh round data to all connected clients
   */
  private syncAllPlayersRoundData() {
    console.log("Syncing round data to all players");

    for (const [sessionId, persistentId] of this.playerSessions.entries()) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      const player = this.state.getPlayer(sessionId);

      if (client && player) {
        this.sendPrivatePlayerGuessesData(
          client,
          persistentId,
          player.getGuesses()
        );
        console.log(`Synced fresh round data to ${sessionId}`);
      }
    }
  }
  private startFirstRound() {
    const word = this.getWordForRound(1);
    this.state.startRound(word);

    // Initialize round data for all current players
    this.initializeRoundDataForAllPlayers();

    // Send initial empty round data to all clients
    this.syncAllPlayersRoundData();

    // Broadcast game started
    // this.broadcast("gameStarted", {
    //   round: this.state.currentRound,
    //   totalRounds: this.state.totalRounds,
    //   wordLength: 5,
    //   maxGuesses: 6,
    // });
  }
  private checkRoundEnd() {
    const players = this.state.getAllPlayers();

    // Only consider players who have actually participated in this round (made at least one guess)
    const activePlayers = players.filter((player) => {
      // A player is considered active if they have won/lost (which means they participated)
      return (
        player.gameStatus === "playing" ||
        player.gameStatus === "won" ||
        player.gameStatus === "lost"
      );
    });

    // If no players have participated yet, don't end the round
    if (activePlayers.length === 0) {
      return;
    }

    const allActivePlayersFinished = activePlayers.every(
      (player) => player.gameStatus === "won" || player.gameStatus === "lost"
    );

    if (allActivePlayersFinished) {
      this.state.finishRound();

      // Check if game is complete
      if (this.state.isGameComplete()) {
        const overallWinner = this.state.getOverallWinner();
        // this.broadcast("gameComplete", {
        //   winner: overallWinner
        //     ? {
        //         id: overallWinner.id,
        //         name: overallWinner.name,
        //         totalScore: overallWinner.totalScore,
        //       }
        //     : null,
        //   finalScores: players.map((player) => ({
        //     id: player.id,
        //     name: player.name,
        //     totalScore: player.totalScore,
        //     // roundScores: Array.from(player.roundScores)
        //   })),
        // });
      } else {
        // Round finished, but game continues
        // this.broadcast("roundComplete", {
        //   round: this.state.currentRound,
        //   nextRound: this.state.currentRound + 1,
        //   totalRounds: this.state.totalRounds,
        //   scores: players.map((player) => ({
        //     id: player.id,
        //     name: player.name,
        //     // roundScore: player.roundScores[player.roundScores.length - 1] || 0,
        //     totalScore: player.totalScore,
        //   })),
        // });
      }
    }
  }
  private getWordForRound(round: number): string {
    try {
      return getRandomWord(this.language);
    } catch (error) {
      console.error(`Error getting word for language ${this.language}:`, error);
      // Fallback to English if current language fails
      if (this.language !== 'en') {
        console.log('Falling back to English');
        return getRandomWord('en');
      }
      // If even English fails, use a hardcoded word
      return 'HELLO';
    }
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Create a snapshot of a player's current state
   */
  private createPlayerSnapshot(
    player: Player,
    persistentId: string
  ): PlayerSnapshot {
    return {
      persistentId,
      playerName: player.name,
      roundNumber: player.getCurrentRoundNumber(),
      currentRow: player.currentRow,
      gameStatus: player.gameStatus,
      isReady: player.isReady,
      completionTime: player.completionTime,
      totalScore: player.totalScore,
      progress: [...player.progress], // Copy the progress array
      guesses: player.getGuesses(),
      disconnectedAt: Date.now(),
    };
  }

  /**
   * Restore player state from snapshot
   */
  private restorePlayerFromSnapshot(
    player: Player,
    snapshot: PlayerSnapshot
  ): void {
    player.currentRow = snapshot.currentRow;
    player.gameStatus = snapshot.gameStatus;
    player.isReady = snapshot.isReady;
    player.completionTime = snapshot.completionTime;
    player.totalScore = snapshot.totalScore;

    // Restore progress grid
    for (
      let i = 0;
      i < Math.min(snapshot.progress.length, player.progress.length);
      i++
    ) {
      player.progress[i] = snapshot.progress[i];
    }

    // Restore round data
    player.setRoundData(snapshot.roundNumber, snapshot.guesses);
  }

  /**
   * Save player state as snapshot when they disconnect
   */
  private savePlayerSnapshot(sessionId: string): void {
    const player = this.state.getPlayer(sessionId);
    const persistentId = this.playerSessions.get(sessionId);

    if (!player || !persistentId) return;

    const snapshot = this.createPlayerSnapshot(player, persistentId);
    this.playerSnapshots.set(persistentId, snapshot);

    console.log(`Saved snapshot for ${player.name} (${persistentId}):`, {
      currentRow: snapshot.currentRow,
      gameStatus: snapshot.gameStatus,
      guessCount: snapshot.guesses.filter((g) => g.length > 0).length,
      roundNumber: snapshot.roundNumber,
    });
  }

  /**
   * Check if a player has a valid snapshot for current round
   */
  private hasValidSnapshot(persistentId: string): boolean {
    const snapshot = this.playerSnapshots.get(persistentId);
    return (
      snapshot !== undefined && snapshot.roundNumber === this.state.currentRound && this.state.gameState !=="finished"
    );
  }

  /**
   * Clean up old snapshots to prevent memory bloat
   */
  private cleanupOldSnapshots(olderThanRounds?: number, olderThanTime?: number): void {
    // If no parameters provided, delete all snapshots
    if (olderThanRounds === undefined && olderThanTime === undefined) {
      const count = this.playerSnapshots.size;
      this.playerSnapshots.clear();
      console.log(`Cleaned up all ${count} snapshots`);
      return;
    }

    const cutoffRound = olderThanRounds !== undefined ? this.state.currentRound - olderThanRounds : -Infinity;
    const cutoffTime = olderThanTime ? Date.now() - olderThanTime : null;

    for (const [persistentId, snapshot] of this.playerSnapshots.entries()) {
      let shouldDelete = false;

      // Check if snapshot is older than specified rounds (if provided)
      if (olderThanRounds !== undefined && snapshot.roundNumber < cutoffRound) {
        shouldDelete = true;
      }

      // Check if snapshot is older than specified time (if provided)
      if (cutoffTime && snapshot.disconnectedAt < cutoffTime) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        this.playerSnapshots.delete(persistentId);
        console.log(
          `Cleaned up old snapshot for ${snapshot.playerName} from round ${snapshot.roundNumber}`
        );
      }
    }
  }
}
