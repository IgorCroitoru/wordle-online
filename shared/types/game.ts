// Shared types between frontend and backend for Wordle multiplayer game

export type TileState = 'empty' | 'absent' | 'present' | 'correct';
export type GameStatus = 'waiting' | 'playing' | 'won' | 'lost';
export type RoomGameState = 'waiting' | 'playing' | 'finished';

// Interface for player data that's safe to share with frontend
export interface IPlayerData {
  id: string;
  name: string;
  currentRow: number;
  gameStatus: GameStatus;
  isReady: boolean;
  completionTime?: number;
  totalScore: number;
  progress: TileState[]; // Flattened 6x5 grid (30 tiles)
//   guesses?: string[]
}

// Interface for game state that's safe to share with frontend
export interface IGameState {
  gameState: RoomGameState;
  currentRound: number;
  totalRounds?: number;
  winner?: string;
  roundStartTime?: number;
  roundEndTime?: number;
}

// Message types for client-server communication
export interface JoinRoomMessage {
  name: string;
  persistentId?: string; // For reconnection
}

export interface MakeGuessMessage {
  guess: string;
  rowIndex: number;
}

export interface SetReadyMessage {
  ready: boolean;
}

// Round-specific guess storage (server-side only)
export interface PlayerGuessHistory {
  roundId: string;
  guesses: string[];
  currentRow: number;
}

// Persistent player data (server-side only)
export interface PersistentPlayerData {
  persistentId: string;
  name: string;
  totalScore: number;
  guessHistory: Map<string, PlayerGuessHistory>; // roundId -> guesses
}

// Helper function to generate round identifier
export function generateRoundId(roomId: string, roundNumber: number): string {
  return `${roomId}_round_${roundNumber}`;
}

// Helper function to generate persistent player ID
export function generatePersistentPlayerId(): string {
  return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Helper to extract subarrays from flat progress array for grid display
export function extractGridFromProgress(progress: TileState[], cols: number = 5): TileState[][] {
  const grid: TileState[][] = [];
  for (let i = 0; i < progress.length; i += cols) {
    grid.push(progress.slice(i, i + cols));
  }
  return grid;
}
