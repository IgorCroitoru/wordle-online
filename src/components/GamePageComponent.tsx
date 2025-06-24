"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, use, useLayoutEffect } from "react";
import { useWordleGame } from "@/contexts/WordleGameContext";
import {
  GameGrid,
  Keyboard,
  TileState,
  PlayerProgress,
  PlayersLeaderboard,
  RoomStatus,
  CopyRoom,
} from "@/components/GameComponents";
import { Client, Room } from "colyseus.js";

export function GameRoomColyseus() {
  const router = useRouter();

  // Get all game state from context
  const {
    room,
    isConnected,
    currentPlayer,
    players,
    currentRound,
    gameState,
    winner,
    guesses,
    makeGuess,
    setReady,
    startRound,
    nextRound,
    disconnect,
    error,
    currentRow,
    wordleRoomId,
  } = useWordleGame();

  const [playerName, setPlayerName] = useState("");
  const [currentGuess, setCurrentGuess] = useState("");
  const [evaluations, setEvaluations] = useState<TileState[][]>([]);
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>(
    {}
  );

  const hasJoinedRef = useRef(false); // Track if we've already attempted to join

  // Get reactive state from Colyseus room
  const gameRoomState = room?.state;
  console.log("GameRoomColyseus state:", room);
  useEffect(() => {
    // Define priority order: correct > present > absent > empty
    const tilePriority: Record<TileState, number> = {
      correct: 3,
      present: 2,
      absent: 1,
      empty: 0,
    };

    // Helper function to get the highest priority tile state
    const getHigherPriorityTile = (
      current: TileState,
      newTile: TileState
    ): TileState => {
      return tilePriority[newTile] > tilePriority[current] ? newTile : current;
    };

    // Process each guess and build letter states with priority
    const newLetterStates: Record<string, TileState> = {};

    guesses.forEach((guess, index) => {
      if (!guess || guess.length === 0) return;

      // Get the tile states for this guess (5 tiles per row)
      const guessTileStates =
        currentPlayer?.progress.slice(index * 5, (index + 1) * 5) || [];

      guessTileStates.forEach((tile, tileIndex) => {
        const letter = guess[tileIndex].toUpperCase(); // Get the letter from the guess
        if (!letter) return;

        // If this letter already has a state, compare priorities
        if (newLetterStates[letter]) {
          newLetterStates[letter] = getHigherPriorityTile(
            newLetterStates[letter],
            tile
          );
        } else {
          newLetterStates[letter] = tile;
        }
      });
    });

    // Update the state with the computed letter states
    setLetterStates(newLetterStates);
  }, [guesses, currentPlayer?.progress]);
  useEffect(() => {
    setLetterStates({});
  }, [currentRound]);
  //   useEffect(() => {
  //     // Get player name from localStorage
  //     const savedName = localStorage.getItem("playerName");
  //     if (!savedName) {
  //       router.push("/");
  //       return;
  //     }
  //     setPlayerName(savedName);

  //     // Join the room only once
  //     if (!hasJoinedRef.current && !isConnected && !room) {
  //       console.log("Attempting to join room:", roomId);
  //       hasJoinedRef.current = true;
  //       const savedId = localStorage.getItem("persistentId") ?? undefined;
  //       joinRoom({
  //         wordleRoomId: roomId,
  //         playerName: savedName,
  //         persistentId: savedId,
  //       });
  //     }

  //     // Cleanup on unmount
  //     return () => {
  //       if (room && room.connection.isOpen) {
  //         disconnect();
  //       }
  //     };
  //   }, [router, roomId]); // Minimal dependencies

  // Reset join attempt flag when roomId changes
  //   useEffect(() => {
  //     hasJoinedRef.current = false;
  //   }, [roomId]);

  // Debug gameState changes in page component
  useEffect(() => {
    console.log("Page gameState changed:", gameState);
  }, [gameState]);
  // Update local state when player progress changes
  useEffect(() => {
    if (currentPlayer) {
      const playerEvaluations: TileState[][] = [];
      console.log("Current player progress:", currentPlayer);
      console.log("Available guesses:", guesses);

      // Process each completed row
      for (let i = 0; i <= currentPlayer.currentRow; i++) {
        const rowProgress = Array.from(
          currentPlayer.progress.slice(i * 5, (i + 1) * 5)
        ) as TileState[];
        playerEvaluations.push(rowProgress);
        console.log(`Row ${i} progress:`, rowProgress);
      }

      console.log(
        "Current player progress updated:",
        guesses,
        playerEvaluations
      );
      setEvaluations(playerEvaluations);
          

    }
  }, [currentPlayer, guesses]); // Add guesses as dependency
    useLayoutEffect(() => {
        setCurrentGuess("");
        // console.log("Current row changed:", currentPlayer?.currentRow);
    }, [currentRow])
  const handleLetterClick = (letter: string) => {
    if (
      !currentPlayer ||
      currentPlayer.gameStatus !== "playing" ||
      currentGuess.length >= 5
    )
      return;
    setCurrentGuess(currentGuess + letter);
  };

  const handleBackspace = () => {
    if (!currentPlayer || currentPlayer.gameStatus !== "playing") return;
    setCurrentGuess(currentGuess.slice(0, -1));
  };

  const handleEnter = () => {
    if (
      !currentPlayer ||
      currentPlayer.gameStatus !== "playing" ||
      currentGuess.length !== 5
    )
      return;

    makeGuess(currentGuess);
    // setCurrentGuess("");
  };

  const handleStartRound = () => {
    startRound();
  };

  const handleNextRound = () => {
    nextRound();
  };
  const handleToggleReady = () => {
    if (currentPlayer) {
      setReady(!currentPlayer.isReady);
    }
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!currentPlayer || currentPlayer.gameStatus !== "playing") return;

      const key = event.key.toUpperCase();

      if (key === "ENTER") {
        handleEnter();
      } else if (key === "BACKSPACE") {
        handleBackspace();
      } else if (key.match(/^[A-Z]$/) && key.length === 1) {
        handleLetterClick(key);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentGuess, currentPlayer]);
  if (!isConnected || !gameRoomState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {error ? `Error: ${error}` : "Connecting to game..."}
          </p>
          {error && (
            <button
              onClick={() => router.push("/")}
              className="mt-4 btn btn-secondary"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
         

          {/* Round Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 max-w-md mx-auto">
            <div className="flex items-center justify-between m-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Round {currentRound}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                Your Score: {currentPlayer?.totalScore || 0} pts
              </span>
            </div>{" "}            {/* Player Ready Status and Button */}
            {(gameState === "waiting" || gameState === "finished") && (
              <div className="hidden lg:flex items-center justify-center gap-3 mb-2">
                {/* <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    currentPlayer?.isReady
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {currentPlayer?.isReady ? "✅ Ready" : "⏳ Not Ready"}
                </span> */}
                <button
                  onClick={handleToggleReady}
                  className={`btn relative text-xs px-3 py-1 rounded-full transition-colors ${
                    currentPlayer?.isReady
                      ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                      : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                  }`}
                >
                  {currentPlayer?.isReady ? "Not Ready" : "Ready"}
                  {/* <ReadyCountBubble players={Array.from(players.values())}/> */}
                  <div className="readyPulse absolute inline-flex items-center justify-center w-8 h-8 text-[10px] font-bold text-white bg-yellow-600 border-2 border-white rounded-full -top-2 -end-2 dark:border-gray-800">
                    {
                      Array.from(players.values()).filter((p) => p.isReady)
                        .length
                    }
                    /{Array.from(players.values()).length}
                  </div>
                </button>
              </div>
            )}
            {/* Game Status */}
            <div className="text-center mb-2">
              {gameRoomState.gameState === "playing" && (
                <span className="text-sm font-semibold me-2 px-2.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-sm ms-2">
                  Round {currentRound} in Progress
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:flex-row gap-8 max-w-7xl mx-auto">
          {/* Left Sidebar - Multiplayer Info (Desktop Only) */}
          <div className="lg:w-80 space-y-2">
            <CopyRoom roomId={wordleRoomId ?? ""} className="" />
            <RoomStatus
              gameState={gameState}
              winner={winner}
              players={players}
            />
            <div className="lg:flex lg:flex-col">
            <PlayersLeaderboard
              players={Array.from(players.values())}
              currentPlayerId={currentPlayer?.id || ""}
              gameState={gameState}
            />
            </div>
           
          </div>
          {/* Main Game Area (Desktop) */}
          <div className="flex-1 max-w-2xl mx-auto lg:mx-0">
            <div className="text-center mb-4">
              {/* <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {(currentPlayer?.currentRow || 0) + 1}/6 | Status:{" "}
                {currentPlayer?.gameStatus || "waiting"}
              </div> */}
            </div>
            {/* Game Grid */}
            <div className="mb-8">
              {/* Debug information */}
              {/* <div className="text-xs text-gray-500 mb-2">
                Debug - Guesses: {JSON.stringify(guesses)} | Evaluations length:{" "}
                {evaluations.length}
              </div> */}
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentRow || 0}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>
            {/* Game Status Messages */}
            {currentPlayer?.gameStatus === "won" && (
              <div className="text-center mb-6 p-1 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
              </div>
            )}
            {currentPlayer?.gameStatus === "lost" && (
              <div className="text-center mb-6 p-1 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
              </div>
            )}{" "}
            {/* Control Buttons */}
            <div className="mb-8">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={
                  !currentPlayer ||
                  currentPlayer.gameStatus !== "playing" ||
                  gameRoomState.gameState !== "playing"
                }
              />
            </div>
            {/* Game Instructions */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>Type letters using your keyboard or click the buttons above</p>
              <p>
                Press Enter to submit your guess • Press Backspace to delete
              </p>
            </div>
            {/* Back to Home Button */}
            <div className="text-center">
              <button
                onClick={() => router.push("/")}
                className="btn btn-secondary"
              >
                ← Back to Home
              </button>
            </div>
          </div>{" "}
          {/* Right Sidebar - Connection Status */}
          <div className="lg:w-80 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-300 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Connection Status
              </h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span
                    className={`font-semibold ${
                      isConnected ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Game state:</span>
                  <span className="font-mono text-xs">{gameState}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span>{players.size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Game Area - Top Priority */}
          <div className="mb-8">
            <div className="text-center mb-4">
              {/* <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {(currentPlayer?.currentRow || 0) + 1}/6 | Status:{" "}
                {currentPlayer?.gameStatus || "waiting"}
              </div> */}
            </div>
            {/* Game Grid */}
            <div className="mb-6">
              {/* Debug information */}
              {/* <div className="text-xs text-gray-500 mb-2">
                Debug - Guesses: {JSON.stringify(guesses)} | Evaluations length:{" "}
                {evaluations.length}
              </div> */}
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentRow || 0}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>{" "}
            {/* Game Status Messages */}
            {currentPlayer?.gameStatus === "won" && (
              <div className="text-center mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
              </div>
            )}
            {currentPlayer?.gameStatus === "lost" && (
              <div className="text-center mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
              </div>
            )}{" "}
            {/* Mobile Control Buttons */}
            {/* {gameState === "waiting" && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <button
                  onClick={handleStartRound}
                  className="btn btn-primary w-full"
                >
                  Start Game 🚀
                </button>
              </div>
            )} */}
            {/* {gameState === "finished" && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
                  Round {currentRound} Complete!
                </h2>
                <button
                  onClick={handleNextRound}
                  className="btn btn-primary w-full"
                >
                  Start Round {currentRound + 1} 🚀
                </button>
              </div>
            )}{" "}          */}
               {/* Virtual Keyboard */}
            <div className="mb-6">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={
                  !currentPlayer ||
                  currentPlayer.gameStatus !== "playing" ||
                  gameRoomState.gameState !== "playing"
                }
              />
            </div>
            

            
            {/* Game Instructions */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
              <p>Type letters using your keyboard or click the buttons above</p>
              <p>
                Press Enter to submit your guess • Press Backspace to delete
              </p>
            </div>
          </div>

          {/* Mobile Boards Section - Bottom */}
          <div className="space-y-6">
            {/* Room Status and Leaderboard */}
            <div className="grid grid-cols-1 gap-4">
              <CopyRoom roomId={wordleRoomId ?? ""} className="w-full" />

                            {/* Player Ready Status and Button - Mobile */}
            {(gameState === "waiting" || gameState === "finished") && (
              <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
                <button
                  onClick={handleToggleReady}
                  className={`btn relative text-sm px-4 py-2 rounded-full transition-colors ${
                    currentPlayer?.isReady
                      ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                      : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                  }`}
                >
                  {currentPlayer?.isReady ? "Not Ready" : "Ready"}
                  <div className="readyPulse absolute inline-flex items-center justify-center w-8 h-8 text-[10px] font-bold text-white bg-yellow-600 border-2 border-white rounded-full -top-2 -end-2 dark:border-gray-800">
                    {
                      Array.from(players.values()).filter((p) => p.isReady)
                        .length
                    }
                    /{Array.from(players.values()).length}
                  </div>
                </button>
              </div>
            )}

              <RoomStatus
                gameState={gameState}
                winner={winner}
                players={players}
              />
              <PlayersLeaderboard
                players={Array.from(players.values())}
                currentPlayerId={currentPlayer?.id || ""}
                gameState={gameState}
              />
            </div>
            {/* Back to Home Button */}
            <div className="text-center pt-4">
              <button
                onClick={() => router.push("/")}
                className="btn btn-secondary"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
