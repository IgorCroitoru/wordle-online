import { ReactNode, useEffect } from "react";
import {
  type TileState,
  type Player,
  type WordleGameState,
  type RoomGameState,
} from "../../server/schemas/WordleGameState";

// Re-export for convenience
export type {
  TileState,
  Player,
  RoomGameState,
} from "../../server/schemas/WordleGameState";

// Legacy interface for compatibility - now using Colyseus schema
export interface RoomData {
  id: string;
  gameState: "waiting" | "playing" | "finished";
  players: Player[];
  winner?: string;
  timeRemaining?: number;
  currentRound?: number;
  totalRounds?: number;
}

interface GameTileProps {
  letter: string;
  state: TileState;
  className?: string;
}

export const GameTile = ({ letter, state, className = "" }: GameTileProps) => {
  const getStateStyles = () => {
    switch (state) {
      case "correct":
        return "bg-green-500 border-green-500 text-white";
      case "present":
        return "bg-yellow-500 border-yellow-500 text-white";
      case "absent":
        return "bg-gray-500 border-gray-500 text-white";
      default: // empty
        return "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800";
    }
  };

  return (
    <div
      className={`
        w-14 h-14 border-2 flex items-center justify-center
        text-2xl font-bold uppercase transition-all duration-200
        ${getStateStyles()}
        ${className}
      `}
    >
      {letter}
    </div>
  );
};

interface GameRowProps {
  letters: string[];
  states: TileState[];
  isCurrentRow?: boolean;
  className?: string;
}

export const GameRow = ({
  letters = ["", "", "", "", ""],
  states = ["empty", "empty", "empty", "empty", "empty"],
  isCurrentRow = false,
  className = "",
}: GameRowProps) => {
  return (
    <div className={`flex gap-1 justify-center ${className}`}>
      {letters.map((letter, index) => (
        <GameTile
          key={index}
          letter={letter}
          state={states[index]}
          className={isCurrentRow ? "animate-pulse" : ""}
        />
      ))}
    </div>
  );
};

interface GameGridProps {
  guesses: string[];
  currentGuess: string;
  currentRow: number;
  evaluations: TileState[][];
  maxRows?: number;
  className?: string;
}

export const GameGrid = ({
  guesses = [],
  currentGuess = "",
  currentRow = 0,
  evaluations = [],
  maxRows = 6,
  className = "",
}: GameGridProps) => {
  // Debug logging
  console.log("GameGrid props:", { guesses, currentGuess, currentRow, evaluations, maxRows });
    const renderRow = (rowIndex: number) => {
    const isCurrentRowActive = rowIndex === currentRow;
    const isSubmittedRow = rowIndex < currentRow;
    const hasGuessForRow = guesses[rowIndex] && guesses[rowIndex].length > 0;

    let letters: string[] = ["", "", "", "", ""];
    let states: TileState[] = ["empty", "empty", "empty", "empty", "empty"];
    
    if (isCurrentRowActive && !hasGuessForRow) {
      // Current row being typed (only if no guess exists for this row)
      const currentLetters = currentGuess.split("");
      letters = [
        ...currentLetters,
        ...Array(5 - currentLetters.length).fill(""),
      ];
      states = currentLetters
        .map(() => "empty" as TileState)
        .concat(Array(5 - currentLetters.length).fill("empty" as TileState));
    } else if ((isSubmittedRow || hasGuessForRow) && guesses[rowIndex]) {
      // Submitted row with evaluation OR row with guess (handles winning row)
      letters = guesses[rowIndex].split("");
      states = evaluations[rowIndex] || Array(5).fill("absent" as TileState);
      console.log(`Row ${rowIndex} - letters:`, letters, "states:", states);
    }

    return (
      <GameRow
        key={rowIndex}
        letters={letters}
        states={states}
        isCurrentRow={isCurrentRowActive}
        className="mb-1"
      />
    );
  };

  return (
    <div className={`game-grid ${className}`}>
      {Array.from({ length: maxRows }, (_, index) => renderRow(index))}
    </div>
  );
};

interface KeyboardKeyProps {
  letter: string;
  state?: TileState;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const KeyboardKey = ({
  letter,
  state = "empty",
  onClick,
  disabled = false,
  className = "",
}: KeyboardKeyProps) => {
  const getKeyStyles = () => {
    if (disabled) return "bg-gray-300 text-gray-500 cursor-not-allowed";

    switch (state) {
      case "correct":
        return "bg-green-500 text-white hover:bg-green-600";
      case "present":
        return "bg-yellow-500 text-white hover:bg-yellow-600";
      case "absent":
        return "bg-gray-500 text-white hover:bg-gray-600";
      default:
        return "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600";
    }
  };

  const isSpecialKey = letter === "ENTER" || letter === "BACKSPACE";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${isSpecialKey ? "special-key px-3 py-4 text-sm w-13" : "w-10 h-12"} 
        rounded font-bold transition-colors duration-150
        ${getKeyStyles()}
        ${className}
      `}
    >
      {letter === "BACKSPACE" ? "⌫" : letter}
    </button>
  );
};

interface KeyboardProps {
  onLetterClick: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  letterStates?: Record<string, TileState>;
  disabled?: boolean;
  className?: string;
}

export const Keyboard = ({
  onLetterClick,
  onEnter,
  onBackspace,
  letterStates = {},
  disabled = false,
  className = "",
}: KeyboardProps) => {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  const handleKeyClick = (key: string) => {
    if (disabled) return;

    if (key === "ENTER") {
      onEnter();
    } else if (key === "BACKSPACE") {
      onBackspace();
    } else {
      onLetterClick(key);
    }
  };

  return (
    <div className={`keyboard ${className}`}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 mb-2">
          {row.map((key) => (
            <KeyboardKey
              key={key}
              letter={key}
              state={letterStates[key]}
              onClick={() => handleKeyClick(key)}
              disabled={disabled}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Player and room interfaces

interface PlayerProgressProps {
  player: Player;
  isCurrentPlayer?: boolean;
  className?: string;
}

export const PlayerProgress = ({
  player,
  isCurrentPlayer = false,
  className = "",
}: PlayerProgressProps) => {
  const getStatusColor = () => {
    switch (player.gameStatus) {
      case "won":
        return "text-green-600 dark:text-green-400";
      case "lost":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getStatusIcon = () => {
    switch (player.gameStatus) {
      case "won":
        return "🎉";
      case "lost":
        return "😔";
      default:
        return "🔄";
    }
  };

  return (
    <></>
    // <div className={`
    //   bg-white dark:bg-gray-800 rounded-lg p-4 border-2 transition-all duration-200
    //   ${isCurrentPlayer ? 'border-blue-500 shadow-lg' : 'border-gray-300 dark:border-gray-600'}
    //   ${className}
    // `}>
    //   <div className="flex items-center justify-between mb-3">
    //     <div className="flex items-center space-x-2">
    //       <span className="font-semibold text-gray-900 dark:text-white">
    //         {player.name}
    //         {isCurrentPlayer && ' (You)'}
    //       </span>
    //       <span className="text-sm text-gray-500 dark:text-gray-400">
    //         {getStatusIcon()}
    //       </span>
    //     </div>
    //     <div className="text-right">
    //       <div className={`text-sm font-medium ${getStatusColor()}`}>
    //         {player.gameStatus}
    //       </div>
    //       {player.completionTime && (
    //         <div className="text-xs text-gray-500 dark:text-gray-400">
    //           {Math.round(player.completionTime / 1000)}s
    //         </div>
    //       )}
    //     </div>
    //   </div>

    //   <div className="mb-2">
    //     <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
    //       Progress: Row {player.currentRow + 1}/6
    //     </div>
    //     <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
    //       <div
    //         className="bg-blue-500 h-2 rounded-full transition-all duration-300"
    //         style={{ width: `${(player.currentRow / 6) * 100}%` }}
    //       />
    //     </div>
    //   </div>

    //   {/* Mini progress grid - only show color patterns */}
    //   <div className="grid grid-cols-5 gap-1">
    //     {player.progress.slice(0, 6).map((row, rowIndex) => (
    //       <div key={rowIndex} className="flex gap-0.5 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600 shadow-sm">
    //         {row.map((state, colIndex) => (
    //           <div
    //             key={colIndex}
    //             className={`
    //               w-3 h-3 rounded-sm border transition-all duration-200
    //               ${state === 'correct' ? 'bg-green-500 border-green-500' : ''}
    //               ${state === 'present' ? 'bg-yellow-500 border-yellow-500' : ''}
    //               ${state === 'absent' ? 'bg-gray-500 border-gray-500' : ''}
    //               ${state === 'empty' ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : ''}
    //               ${state === 'filled' ? 'bg-blue-200 dark:bg-blue-800 border-blue-300 dark:border-blue-600' : ''}
    //             `}
    //           />
    //         ))}
    //       </div>
    //     ))}
    //   </div>
    // </div>
  );
};

interface PlayersLeaderboardProps {
  players: Player[];
  currentPlayerId: string;
  className?: string;
}

export const PlayersLeaderboard = ({
  players,
  currentPlayerId,
  className = "",
}: PlayersLeaderboardProps) => {
  console.log("PlayersLeaderboard rendered with players:", players);
  // Sort players by total score (for multi-round), then by current round performance
  const sortedPlayers = [...players].sort((a, b) => {
    // Primary sort: total score (higher is better)
    const aTotal = a.totalScore || 0;
    const bTotal = b.totalScore || 0;
    if (aTotal !== bTotal) return bTotal - aTotal;

    // Secondary sort: current round status
    if (a.gameStatus === "won" && b.gameStatus !== "won") return -1;
    if (b.gameStatus === "won" && a.gameStatus !== "won") return 1;

    // Tertiary sort: completion time for current round
    if (a.gameStatus === "won" && b.gameStatus === "won") {
      return (a.completionTime || 0) - (b.completionTime || 0);
    }

    // Final sort: current progress
    return b.currentRow - a.currentRow;
  });

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="mr-2">👥</span>
        Players ({players.length})
      </h3>

      <div className="space-y-4">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`
              p-3 rounded-lg border-2 transition-all duration-200
              ${
                player.id === currentPlayerId
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
              }
            `}
          >
            {/* Player Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${
                    index < 3
                      ? index === 0
                        ? "bg-yellow-500 text-white"
                        : index === 1
                        ? "bg-gray-400 text-white"
                        : "bg-orange-600 text-white"
                      : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                  }
                `}
                >
                  {index + 1}
                </div>{" "}
                <div>
                  <span
                    className={`font-medium ${
                      player.id === currentPlayerId
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {player.name}
                    {player.id === currentPlayerId && " (You)"}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {player.completionTime && (
                      <span>
                        Round: {Math.round(player.completionTime / 1000)}s •{" "}
                      </span>
                    )}
                    Total: {player.totalScore || 0} pts
                  </div>
                  {/* {player.roundScores && player.roundScores.length > 0 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Rounds: {player.roundScores.join(', ')}
                    </div>
                  )} */}
                </div>
              </div>

              <div className="flex flex-col items-end space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {player.currentRow}/6
                  </span>
                  <span className="text-lg">
                    {player.gameStatus === "won"
                      ? "🏆"
                      : player.gameStatus === "lost"
                      ? "❌"
                      : "🔄"}
                  </span>
                </div>
                {player.totalScore !== undefined && (
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {player.totalScore} pts
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`
                    h-2 rounded-full transition-all duration-300
                    ${
                      player.gameStatus === "won"
                        ? "bg-green-500"
                        : player.gameStatus === "lost"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }
                  `}
                  style={{ width: `${(player.currentRow / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* Integrated Mini Progress Grid */}
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 6 }, (_, rowIndex) => {
                // Calculate the start and end indices for this row
                const startIndex = rowIndex * 5;
                const endIndex = startIndex + 5;
                const rowData = player.progress.slice(startIndex, endIndex);

                return (
                  <div
                    key={rowIndex}
                    className="bg-white dark:bg-gray-800 rounded-md p-1 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex gap-0.5 justify-center">
                      {rowData.map((state, colIndex) => (
                        <div
                          key={colIndex}
                          className={`
                            w-2 h-2 rounded-sm transition-all duration-200
                            ${state === "correct" ? "bg-green-500" : ""}
                            ${state === "present" ? "bg-yellow-500" : ""}
                            ${state === "absent" ? "bg-gray-500" : ""}
                            ${
                              state === "empty"
                                ? "bg-gray-200 dark:bg-gray-600"
                                : ""
                            }
                          `}
                        />
                      ))}
                    </div>
                    <div className="text-center mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {rowIndex + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RoomStatusProps {
  gameState: RoomGameState;
  winner?: string;
  players: Map<string, Player>;
  className?: string;
}

export const RoomStatus = ({
  gameState,
  winner,
  players,
  className = "",
}: RoomStatusProps) => {
  useEffect(() => {
    console.log("Game state changed:", gameState);
  }, [gameState]);
  const getStatusColor = () => {
    switch (gameState) {
      case "playing":
        return "text-green-600 dark:text-green-400";
      case "waiting":
        return "text-yellow-600 dark:text-yellow-400";
      case "finished":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusIcon = () => {
    switch (gameState) {
      case "playing":
        return "🎮";
      case "waiting":
        return "⏳";
      case "finished":
        return "🏁";
      default:
        return "📋";
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            Room Status
          </span>
        </div>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {gameState.toUpperCase()}
        </span>
      </div>

      {/* {roomData.timeRemaining && roomData.timeRemaining > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Time remaining: {Math.round(roomData.timeRemaining / 1000)}s
        </div>
      )} */}

      {winner && (
        <div className="text-sm text-green-600 dark:text-green-400 mt-2">
          🏆 Winner: {players?.get(winner)?.name}
        </div>
      )}
    </div>
  );
};
