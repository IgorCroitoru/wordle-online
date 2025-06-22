// Import shared game types
export * from './game';
export const SOCKET_MESSAGES = {
  JOINED_ROOM: 'joined_room',
  GUESS: 'guess',
  READY: 'ready',
  PLAYER_GUESSES: 'player_guesses',
  START_ROUND: 'startRound',
  NEXT_ROUND: "nextRound",
} as const;


// Additional message interfaces specific to private communication
export interface PrivatePlayerGuessData {
  guesses: string[];
  roundNumber: number;
  // persistentId: string;
}

// Server response messages
export interface GuessValidationResult {
  isValid: boolean;
  message?: string;
  tileStates?: import('./game').TileState[];
}

export interface RoundStartMessage {
  roundNumber: number;
  wordLength: number;
  maxGuesses: number;
}

export interface PlayerJoinedMessage {
  playerId: string;
  playerName: string;
  playerCount: number;
}

export interface GameStartedMessage {
  round: number;
  totalRounds: number;
  wordLength: number;
  maxGuesses: number;
}

export interface RoundStartedMessage extends RoundStartMessage {
  totalRounds: number;
}

export interface GameEndMessage {
  winner?: string;
  finalScores: { [playerId: string]: number };
  correctWord: string;
}