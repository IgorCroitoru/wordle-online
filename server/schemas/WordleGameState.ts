import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export type TileState = 'empty' | 'absent' | 'present' | 'correct';
export type GameStatus = 'waiting' | 'playing' | 'won' | 'lost';
export type RoomGameState = 'waiting' | 'playing' | 'finished';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('number') currentRow: number = 0;
  @type('string') gameStatus: GameStatus = 'waiting';
  @type('boolean') isReady: boolean = false;
  @type('number') completionTime?: number;
//   @type([ 'number' ]) roundScores = new ArraySchema<number>();
  @type('number') totalScore: number = 0;
  @type([ 'string' ]) progress = new ArraySchema<TileState>();

  // Private round data (not synced to clients)
  private playerRoundData: {
    roundNumber: number;
    guesses: string[];
  } = {
    roundNumber: 1,
    guesses: Array(6).fill("")
  };

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    
    // Initialize progress grid (6 rows x 5 columns)
    for (let i = 0; i < 30; i++) {
        this.progress.push('empty');
   
    }
  }

  // Methods to manage private round data
  setRoundData(roundNumber: number, guesses: string[] = Array(6).fill("")) {
    this.playerRoundData = {
      roundNumber,
      guesses: [...guesses]
    };
  }

  getRoundData() {
    return { ...this.playerRoundData };
  }

  setGuess(rowIndex: number, guess: string) {
    if (rowIndex >= 0 && rowIndex < 6) {
      this.playerRoundData.guesses[rowIndex] = guess;
    }
  }

  getGuesses(): string[] {
    return [...this.playerRoundData.guesses];
  }

  getCurrentRoundNumber(): number {
    return this.playerRoundData.roundNumber;
  }
}

export class WordleGameState extends Schema {
//   @type('string') roomId: string = '';
  @type('string') gameState: RoomGameState = 'waiting';
  @type('number') currentRound: number = 0;
  @type('number') totalRounds?: number ;
  @type('string') currentWord: string = '';
  @type('string') winner?: string;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('number') roundStartTime?: number;
  @type('number') roundEndTime?: number;

  constructor(roomId: string) {
    super();
    // this.roomId = roomId;
  }

  addPlayer(sessionId: string, name: string): Player {
    const player = new Player(sessionId, name);
    this.players.set(sessionId, player);
    return player;
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
  }

  getPlayer(sessionId: string): Player | undefined {
    return this.players.get(sessionId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  allPlayersReady(): boolean {
    const players = this.getAllPlayers();
    return players.length > 0 && players.every(player => player.isReady);
  }

  startRound(word: string): void {
    this.gameState = 'playing';
    this.currentWord = word.toUpperCase();
    this.roundStartTime = Date.now();
    this.winner = undefined;

    // Reset all players for new round
    this.getAllPlayers().forEach(player => {
      player.gameStatus = 'playing';
      player.currentRow = 0;
      player.completionTime = undefined;
      
      // Reset progress grid
      for (let i = 0; i < 30; i++) {
          player.progress[i] = 'empty';
      }
    });
  }

  finishRound(): void {
    this.gameState = 'finished';
    this.roundEndTime = Date.now();
    
    
    this.getAllPlayers().forEach(player => {
      player.gameStatus = 'waiting';
     
    });
  }

  public calculatePlayerScore(player: Player): number {
    if (player.gameStatus !== 'won') return 0;
    let score = 0;
    //if player is first to guess the word
    const playingPlayers = this.getAllPlayers()
      .filter(p => ['playing','won','lost'].includes(p.gameStatus) && p.id !== player.id);
    if(playingPlayers.length >= 1){
      const isFirstWhoWon  = playingPlayers.every(p => ['playing','lost'].includes(p.gameStatus));
      if(isFirstWhoWon) {
        score += 2; // Bonus for being the first to guess
      }
    }
    // Score: 7 points for row 0, 6 for row 1, etc., minimum 1 point
    switch (player.currentRow) {
      case 0: return score+=10;
      case 1: return score+=9;
      case 2: return score+=8;
      case 3: return score+=7;
      case 4: return score+=6;
      case 5: return score+=5;
      default: return score+=1; // For any row beyond 5, minimum score is
    }
    // return Math.max(7 - player.currentRow, 1);
  }

  canStartNextRound(): boolean {
    return this.gameState === 'finished' || this.gameState === 'waiting'
  }

  startNextRound(word: string): void {
    if (!this.canStartNextRound()) return;
    
    this.currentRound++;
    this.startRound(word);
  }

  isGameComplete(): boolean {
    return  this.gameState === 'finished';
  }

  getOverallWinner(): Player | null {
    if (!this.isGameComplete()) return null;
    
    const players = this.getAllPlayers();
    if (players.length === 0) return null;
    
    return players.reduce((winner, current) => 
      current.totalScore > winner.totalScore ? current : winner
    );
  }

  evaluateGuess(guess: string): TileState[] {
    const word = this.currentWord;
    const result: TileState[] = new Array(5).fill('absent');
    const wordLetters = word.split('');
    const guessLetters = guess.toUpperCase().split('');
    
    // First pass: mark correct positions
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === wordLetters[i]) {
        result[i] = 'correct';
        wordLetters[i] = ''; // Mark as used
        guessLetters[i] = ''; // Mark as used
      }
    }
    
    // Second pass: mark present letters
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] && wordLetters.includes(guessLetters[i])) {
        result[i] = 'present';
        const wordIndex = wordLetters.indexOf(guessLetters[i]);
        wordLetters[wordIndex] = ''; // Mark as used
      }
    }
    
    return result;
  }
}
