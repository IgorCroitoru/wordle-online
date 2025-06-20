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

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    
    // Initialize progress grid (6 rows x 5 columns)
    for (let i = 0; i < 30; i++) {
        this.progress.push('empty');
   
    }
  }
}

export class WordleGameState extends Schema {
//   @type('string') roomId: string = '';
  @type('string') gameState: RoomGameState = 'waiting';
  @type('number') currentRound: number = 1;
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
    
    // Calculate scores for this round
    this.getAllPlayers().forEach(player => {
      const score = this.calculatePlayerScore(player);
    //   player.roundScores.push(score);
      player.totalScore += score;
    });
  }

  private calculatePlayerScore(player: Player): number {
    if (player.gameStatus !== 'won') return 0;
    // Score: 7 points for row 0, 6 for row 1, etc., minimum 1 point
    return Math.max(7 - player.currentRow, 1);
  }

  canStartNextRound(): boolean {
    return this.gameState === 'finished'
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
