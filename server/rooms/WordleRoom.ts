import { Room, Client } from "colyseus";
import { WordleGameState, Player } from "../schemas/WordleGameState";

// Word lists for each round
const WORD_LISTS = [
  ["HELLO", "WORLD", "GAMES", "PARTY", "MAGIC"],
  ["BRAIN", "CHAIR", "FLAME", "PHONE", "TIGER"],
  ["CLOUD", "DANCE", "EARTH", "FRUIT", "HOUSE"],
];

interface JoinOptions {
  playerName: string;
  persistentId?: string; // Optional persistent ID for player
  wordleRoomId?: string;
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
interface PlayerRoundData {
  roundNumber: number;
  guesses: string[];
}

export class WordleRoom extends Room<WordleGameState> {
  private playerRoundData = new Map<string, PlayerRoundData>(); // persistentId -> guesses
  private playerSessions = new Map<string, string>(); // sessionId -> persistentId
  maxClients = 6;

  onCreate(options: any) {
    console.log("Creating WordleRoom with options:", options);
    this.state = new WordleGameState(options.roomId || this.roomId);

    console.log("WordleRoom created:", this.roomId);
    // Handle player guess
    this.onMessage("guess", (client, message: GuessMessage) => {
      this.handleGuess(client, message.guess);
    });

    // Handle player ready state
    this.onMessage("ready", (client, message: ReadyMessage) => {
      this.handleReady(client, message.ready);
    });

    // Handle start round
    this.onMessage("startRound", (client, message: StartRoundMessage) => {
      this.handleStartRound();
    });

    // Handle next round
    this.onMessage("nextRound", (client) => {
      this.handleNextRound();
    });
  }
  onJoin(client: Client, options: JoinOptions) {
    console.log(`Player ${options.playerName} joined room ${this.roomId}`);

    const persistentId = options.persistentId || this.generateUUID();
    this.playerSessions.set(client.sessionId, persistentId);
    
    // Add player to game state
    this.state.addPlayer(client.sessionId, options.playerName);

    // Handle round data for the player
    this.handlePlayerRoundDataOnJoin(client, persistentId);

    // Broadcast player joined (optional)
    this.broadcast('playerJoined', {
      playerId: client.sessionId,
      playerName: options.playerName,
      playerCount: this.state.getPlayerCount()
    });

    console.log(`Player ${options.playerName} successfully joined with persistentId: ${persistentId}`);
  }

  /**
   * Handle round data when a player joins - either restore existing data or create fresh data
   */
  private handlePlayerRoundDataOnJoin(client: Client, persistentId: string) {
    const currentRound = this.state.currentRound;
    const existingData = this.playerRoundData.get(persistentId);

    if (existingData && existingData.roundNumber === currentRound) {
      // Player rejoining in current round - restore their progress
      console.log(`Restoring round data for ${persistentId} in round ${currentRound}`);
      this.sendPrivatePlayerGuessesData(client, persistentId, existingData.guesses);
    } else {
      // New player or player from previous round - give them fresh data
      console.log(`Creating fresh round data for ${persistentId} in round ${currentRound}`);
      const freshRoundData: PlayerRoundData = {
        roundNumber: currentRound,
        guesses: Array(6).fill(""),
      };
      this.playerRoundData.set(persistentId, freshRoundData);
      this.sendPrivatePlayerGuessesData(client, persistentId, freshRoundData.guesses);
    }
  }
  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left room ${this.roomId}`);

    const player = this.state.getPlayer(client.sessionId);
    if (player) {
      this.state.removePlayer(client.sessionId);

      // this.broadcast("playerLeft", {
      //   playerId: client.sessionId,
      //   playerName: player.name,
      //   playerCount: this.state.getPlayerCount(),
      // });

      // Check if round should end after player leaves (similar to when player wins/loses)
      if (this.state.gameState === "playing") {
        this.checkRoundEnd();
      }

      // If no players left, dispose the room
      if (this.state.getPlayerCount() === 0) {
        this.disconnect();
      }
    }
  }

  onDispose() {
    console.log("WordleRoom disposed:", this.roomId);
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

    if (guess.length !== 5 || player.currentRow >= 6) {
      return;
    }

    const persistentId = this.playerSessions.get(client.sessionId);
    if (!persistentId) {
      console.error("No persistent ID found for session:", client.sessionId);
      return;
    }
    let roundData = this.playerRoundData.get(persistentId);
    if (!roundData || roundData.roundNumber !== this.state.currentRound) {
      roundData = {
        guesses: Array(6).fill(""),
        roundNumber: this.state.currentRound,
      };
    }
    roundData.guesses[player.currentRow] = guess;
    this.playerRoundData.set(persistentId, roundData);
    // Evaluate the guess
    const evaluation = this.state.evaluateGuess(guess);

    // Update player progress
    for (let i = 0; i < 5; i++) {
      player.progress[player.currentRow * 5 + i] = evaluation[i];
    }
    this.sendPrivatePlayerGuessesData(client, persistentId, roundData.guesses);
    // Check if player won
    const won = evaluation.every((tile) => tile === "correct");

    if (won) {
      player.gameStatus = "won";
      player.completionTime = Date.now() - (this.state.roundStartTime || 0);
      player.isReady = false;
      // Broadcast player won
      //   this.broadcast('playerWon', {
      //     playerId: client.sessionId,
      //     playerName: player.name,
      //     completionTime: player.completionTime,
      //     rowsUsed: player.currentRow + 1
      //   });

      // Check if round should end
      this.checkRoundEnd();
    } else {
      player.currentRow++;
      player.isReady = false; // Reset ready state after guess
      // Check if player lost (used all rows)
      if (player.currentRow >= 6) {
        player.gameStatus = "lost";
        this.checkRoundEnd();
      }
    }

    // Send guess result back to player
    // client.send('guessResult', {
    //   guess,
    //   evaluation,
    //   row: player.currentRow - (won ? 0 : 1),
    //   gameStatus: player.gameStatus
    // });
  }  private sendPrivatePlayerGuessesData(
    client: Client,
    persistentId: string,
    guesses: string[]
  ) {
    const roundData = this.playerRoundData.get(persistentId);
    console.log(`Sending guess data to client ${client.sessionId}:`, {
      persistentId,
      roundNumber: roundData?.roundNumber,
      guesses: guesses.filter(g => g.length > 0), // Only show non-empty guesses in log
    });
    
    client.send("private_player_data", {
      guesses: guesses,
      roundNumber: this.state.currentRound,
      persistentId: persistentId,
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

    const nextWord = this.getWordForRound(this.state.currentRound + 1);
    
    // Clear old round data before starting next round
    this.clearOldRoundData();
    
    // Start the next round (this will reset player states)
    this.state.startNextRound(nextWord);

    // Initialize fresh round data for all current players
    this.initializeRoundDataForAllPlayers();

    // Broadcast round started to all clients
    this.broadcast("roundStarted", {
      round: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      wordLength: 5, // Wordle standard
      maxGuesses: 6,
    });

    // Send fresh private data to all clients
    this.syncAllPlayersRoundData();
  }
  private clearOldRoundData() {
    const currentRound = this.state.currentRound;

    // Remove data for players that doesn't match current round
    for (const [persistentId, roundData] of this.playerRoundData.entries()) {
      if (roundData.roundNumber !== currentRound) {
        console.log(
          `Clearing old round data for ${persistentId}: ${roundData.roundNumber}`
        );
        
        this.playerRoundData.delete(persistentId);
      }
    }
  }
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
        this.playerRoundData.set(persistentId, {
          roundNumber: currentRound,
          guesses: Array(6).fill(""), // Fresh empty guesses for new round
        });
        console.log(`Initialized round data for player ${player.name} (${persistentId})`);
      }
    }
  }
  /**
   * Send fresh round data to all connected clients
   */
  private syncAllPlayersRoundData() {
    console.log("Syncing round data to all players");
    
    for (const [sessionId, persistentId] of this.playerSessions.entries()) {
      const client = this.clients.find(c => c.sessionId === sessionId);
      if (client) {
        const roundData = this.playerRoundData.get(persistentId);
        if (roundData) {
          this.sendPrivatePlayerGuessesData(client, persistentId, roundData.guesses);
          console.log(`Synced fresh round data to ${sessionId}`);
        }
      }
    }
  }  private startFirstRound() {
    const word = this.getWordForRound(1);
    this.state.startRound(word);

    // Initialize round data for all current players
    this.initializeRoundDataForAllPlayers();

    // Send initial empty round data to all clients
    this.syncAllPlayersRoundData();

    // Broadcast game started
    this.broadcast('gameStarted', {
      round: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      wordLength: 5,
      maxGuesses: 6,
    });
  }
  private checkRoundEnd() {
    const players = this.state.getAllPlayers();
    
    // Only consider players who have actually participated in this round (made at least one guess)
    const activePlayers = players.filter(player => {
      // A player is considered active if they have won/lost (which means they participated)
      return player.gameStatus ==="playing" || player.gameStatus === "won" || player.gameStatus === "lost";
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
        this.broadcast("gameComplete", {
          winner: overallWinner
            ? {
                id: overallWinner.id,
                name: overallWinner.name,
                totalScore: overallWinner.totalScore,
              }
            : null,
          finalScores: players.map((player) => ({
            id: player.id,
            name: player.name,
            totalScore: player.totalScore,
            // roundScores: Array.from(player.roundScores)
          })),
        });
      } else {
        // Round finished, but game continues
        this.broadcast("roundComplete", {
          round: this.state.currentRound,
          nextRound: this.state.currentRound + 1,
          totalRounds: this.state.totalRounds,
          scores: players.map((player) => ({
            id: player.id,
            name: player.name,
            // roundScore: player.roundScores[player.roundScores.length - 1] || 0,
            totalScore: player.totalScore,
          })),
        });
      }
    }
  }

  private getWordForRound(round: number): string {
    const roundIndex = Math.min(round - 1, WORD_LISTS.length - 1);
    const wordList = WORD_LISTS[roundIndex];
    return wordList[Math.floor(Math.random() * wordList.length)];
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
}
