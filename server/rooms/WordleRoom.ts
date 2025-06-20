import { Room, Client } from 'colyseus';
import { WordleGameState, Player } from '../schemas/WordleGameState';

// Word lists for each round
const WORD_LISTS = [
  ['HELLO', 'WORLD', 'GAMES', 'PARTY', 'MAGIC'],
  ['BRAIN', 'CHAIR', 'FLAME', 'PHONE', 'TIGER'],
  ['CLOUD', 'DANCE', 'EARTH', 'FRUIT', 'HOUSE']
];

interface JoinOptions {
  playerName: string;
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

export class WordleRoom extends Room<WordleGameState> {
  maxClients = 6;
  
  onCreate(options: any) {
    console.log('Creating WordleRoom with options:', options);
    this.state = new WordleGameState(options.roomId || this.roomId);
    
    console.log('WordleRoom created:', this.roomId);
    
    // Handle player guess
    this.onMessage('guess', (client, message: GuessMessage) => {
      this.handleGuess(client, message.guess);
    });
    
    // Handle player ready state
    this.onMessage('ready', (client, message: ReadyMessage) => {
      this.handleReady(client, message.ready);
    });
    
    // Handle start round
    this.onMessage('startRound', (client, message: StartRoundMessage) => {
      this.handleStartRound();
    });
    
    // Handle next round
    this.onMessage('nextRound', (client) => {
      this.handleNextRound();
    });
  }
  
  onJoin(client: Client, options: JoinOptions) {
    console.log(`Player ${options.playerName} joined room ${this.roomId}`);
    
    const player = this.state.addPlayer(client.sessionId, options.playerName);
    
    // If this is the first player, start the game immediately
    // if (this.state.getPlayerCount() === 1) {
    //   this.startFirstRound();
    // }
    
    // Broadcast player joined
    this.broadcast('playerJoined', {
      playerId: client.sessionId,
      playerName: options.playerName,
      playerCount: this.state.getPlayerCount()
    });
  }
  
  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left room ${this.roomId}`);
    
    const player = this.state.getPlayer(client.sessionId);
    if (player) {
      this.state.removePlayer(client.sessionId);
      
      this.broadcast('playerLeft', {
        playerId: client.sessionId,
        playerName: player.name,
        playerCount: this.state.getPlayerCount()
      });
      
      // If no players left, dispose the room
      if (this.state.getPlayerCount() === 0) {
        this.disconnect();
      }
    }
  }
  
  onDispose() {
    console.log('WordleRoom disposed:', this.roomId);
  }
  
  private handleGuess(client: Client, guess: string) {
    const player = this.state.getPlayer(client.sessionId);
    if (!player || player.gameStatus !== 'playing' || this.state.gameState !== 'playing') {
      return;
    }
    
    if (guess.length !== 5 || player.currentRow >= 6) {
      return;
    }
    
    // Evaluate the guess
    const evaluation = this.state.evaluateGuess(guess);
    
    // Update player progress
    for (let i = 0; i < 5; i++) {
      player.progress[player.currentRow * 5 + i] = evaluation[i];
    }
    
    // Check if player won
    const won = evaluation.every(tile => tile === 'correct');
    
    if (won) {
      player.gameStatus = 'won';
      player.completionTime = Date.now() - (this.state.roundStartTime || 0);
      
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
      
      // Check if player lost (used all rows)
      if (player.currentRow >= 6) {
        player.gameStatus = 'lost';
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
    if (this.state.gameState === 'waiting') {
      this.startFirstRound();
    }
  }
  
  private handleNextRound() {
    if (!this.state.canStartNextRound()) return;
    
    const nextWord = this.getWordForRound(this.state.currentRound + 1);
    this.state.startNextRound(nextWord);
    
    this.broadcast('roundStarted', {
      round: this.state.currentRound,
      totalRounds: this.state.totalRounds
    });
  }
  
  private startFirstRound() {
    const word = this.getWordForRound(1);
    this.state.startRound(word);
    
    // this.broadcast('gameStarted', {
    //   round: this.state.currentRound,
    //   totalRounds: this.state.totalRounds
    // });
  }
  
  private checkRoundEnd() {
    const players = this.state.getAllPlayers();
    const allPlayersFinished = players.every(player => 
      player.gameStatus === 'won' || player.gameStatus === 'lost'
    );
    
    if (allPlayersFinished) {
      this.state.finishRound();
      
      // Check if game is complete
      if (this.state.isGameComplete()) {
        const overallWinner = this.state.getOverallWinner();
        this.broadcast('gameComplete', {
          winner: overallWinner ? {
            id: overallWinner.id,
            name: overallWinner.name,
            totalScore: overallWinner.totalScore
          } : null,
          finalScores: players.map(player => ({
            id: player.id,
            name: player.name,
            totalScore: player.totalScore,
            // roundScores: Array.from(player.roundScores)
          }))
        });
      } else {
        // Round finished, but game continues
        this.broadcast('roundComplete', {
          round: this.state.currentRound,
          nextRound: this.state.currentRound + 1,
          totalRounds: this.state.totalRounds,
          scores: players.map(player => ({
            id: player.id,
            name: player.name,
            // roundScore: player.roundScores[player.roundScores.length - 1] || 0,
            totalScore: player.totalScore
          }))
        });
      }
    }
  }
  
  private getWordForRound(round: number): string {
    const roundIndex = Math.min(round - 1, WORD_LISTS.length - 1);
    const wordList = WORD_LISTS[roundIndex];
    return wordList[Math.floor(Math.random() * wordList.length)];
  }
}
