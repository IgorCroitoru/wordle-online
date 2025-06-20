'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useWordleGame } from '@/hooks/useWordleGame';
import { 
  GameGrid, 
  Keyboard, 
  TileState, 
  PlayerProgress, 
  PlayersLeaderboard, 
  RoomStatus,
} from '@/components/GameComponents';
import { Client, Room } from "colyseus.js";

export default function GameRoomColyseus() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [playerName, setPlayerName] = useState('');
  const [currentGuess, setCurrentGuess] = useState('');
  const [evaluations, setEvaluations] = useState<TileState[][]>([]);
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>({});
  const hasJoinedRef = useRef(false); // Track if we've already attempted to join
    const {
    guesses,
    room,
    isConnected,
    currentPlayer,
    players,
    joinRoom,
    makeGuess,
    setReady,
    startRound,
    nextRound,
    disconnect,
    error,
    gameState,
    winner,
    currentRound,

  } = useWordleGame();

  // Get reactive state from Colyseus room
  const gameRoomState = room?.state;  useEffect(() => {
    // Get player name from localStorage
    const savedName = localStorage.getItem('playerName');
    if (!savedName) {
      router.push('/');
      return;
    }
    setPlayerName(savedName);
    
    // Join the room only once
    if (!hasJoinedRef.current && !isConnected && !room) {
      console.log("Attempting to join room:", roomId);
      hasJoinedRef.current = true;
      joinRoom("wordle", {wordleRoomId: roomId, playerName: savedName});
    }
    
    // Cleanup on unmount
    return () => {
      if (room && room.connection.isOpen) {
        disconnect();
      }
    };
  }, [router, roomId]); // Minimal dependencies

  // Reset join attempt flag when roomId changes
  useEffect(() => {
    hasJoinedRef.current = false;
  }, [roomId]);

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
        const rowProgress = Array.from(currentPlayer.progress.slice(i*5, (i+1)*5)) as TileState[];
        playerEvaluations.push(rowProgress);
        console.log(`Row ${i} progress:`, rowProgress);
      }
      
      console.log("Current player progress updated:", guesses, playerEvaluations);
      setEvaluations(playerEvaluations);
    }
  }, [currentPlayer, guesses]); // Add guesses as dependency

  const handleLetterClick = (letter: string) => {
    if (!currentPlayer || currentPlayer.gameStatus !== 'playing' || currentGuess.length >= 5) return;
    setCurrentGuess(currentGuess + letter);
  };

  const handleBackspace = () => {
    if (!currentPlayer || currentPlayer.gameStatus !== 'playing') return;
    setCurrentGuess(currentGuess.slice(0, -1));
  };

  const handleEnter = () => {
    if (!currentPlayer || currentPlayer.gameStatus !== 'playing' || currentGuess.length !== 5) return;
    
    makeGuess(currentGuess);
    setCurrentGuess('');
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
      if (!currentPlayer || currentPlayer.gameStatus !== 'playing') return;
      
      const key = event.key.toUpperCase();
      
      if (key === 'ENTER') {
        handleEnter();
      } else if (key === 'BACKSPACE') {
        handleBackspace();
      } else if (key.match(/^[A-Z]$/) && key.length === 1) {
        handleLetterClick(key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentGuess, currentPlayer]);
  if (!playerName || !isConnected || !gameRoomState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {error ? `Error: ${error}` : 'Connecting to game...'}
          </p>
          {error && (
            <button
              onClick={() => router.push('/')}
              className="mt-4 btn btn-secondary"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }
//   const allPlayers = Array.from(players.values());
//   const totalRounds = gameRoomState?.totalRounds || 3;
//   const gameComplete = gameRoomState?.isGameComplete() || false;
//   const overallWinner = gameRoomState?.getOverallWinner() || null;

  // Create compatible RoomData for existing components
//   const roomData: RoomData = {
//     id: roomId,
//     gameState: gameRoomState.gameState as 'waiting' | 'playing' | 'finished',
//     players: allPlayers,
//     winner: gameRoomState.winner,
//     currentRound: gameRoomState.currentRound,
//     totalRounds: gameRoomState.totalRounds
//   };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Room: {roomId}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome, {playerName}!
          </p>
            {/* Round Information */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Round {currentRound}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                Your Score: {currentPlayer?.totalScore || 0} pts
              </span>
            </div>
            
            {/* Player Ready Status */}
            {gameState === 'waiting' && (
              <div className="flex items-center justify-center mb-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentPlayer?.isReady 
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {currentPlayer?.isReady ? '✅ Ready' : '⏳ Not Ready'}
                </span>
              </div>
            )}
            
            {/* Round Progress Bar */}
            {/* <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentRound / totalRounds) * 100}%` }}
              />
            </div> */}
              {/* Game Status */}
            <div className="text-center mb-2">
              {gameRoomState.gameState === 'waiting' && (
                <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                  ⏳ Waiting for players
                </span>
              )}
              {gameRoomState.gameState === 'playing' && (
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                  🎯 Round {currentRound} in Progress
                </span>
              )}
              {/* {gameRoomState.gameState === 'finished' && !gameComplete && (
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  ✅ Round {currentRound} Complete
                </span>
              )}
              {gameComplete && (
                <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                  🏆 Game Complete
                </span>
              )} */}
            </div>
            
            {/* Round Scores */}
            {/* {currentPlayer && currentPlayer.roundScores.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Previous rounds: {Array.from(currentPlayer.roundScores).join(', ')} pts
              </div>
            )} */}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:flex-row gap-8 max-w-7xl mx-auto">          {/* Left Sidebar - Multiplayer Info (Desktop Only) */}
          <div className="lg:w-80 space-y-4">
            <RoomStatus 
              gameState={gameState}
              winner={winner}
              players={players}
            />
            <PlayersLeaderboard 
              players={Array.from(players.values())} 
              currentPlayerId={currentPlayer?.id || ''} 
            />
          </div>

          {/* Main Game Area (Desktop) */}
          <div className="flex-1 max-w-2xl mx-auto lg:mx-0">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {(currentPlayer?.currentRow || 0) + 1}/6 | Status: {currentPlayer?.gameStatus || 'waiting'}
              </div>
            </div>

            {/* Game Grid */}
            <div className="mb-8">
              {/* Debug information */}
              <div className="text-xs text-gray-500 mb-2">
                Debug - Guesses: {JSON.stringify(guesses)} | Evaluations length: {evaluations.length}
              </div>
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentPlayer?.currentRow || 0}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>

            {/* Game Status Messages */}
            {currentPlayer?.gameStatus === 'won' && (
              <div className="text-center mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
              </div>
            )}

            {currentPlayer?.gameStatus === 'lost' && (
              <div className="text-center mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
              </div>
            )}            {/* Ready/Control Buttons */}
            {gameRoomState.gameState === 'waiting' && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <div className="mb-4">
                  <button
                    onClick={handleToggleReady}
                    className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {currentPlayer?.isReady ? 'Not Ready' : 'Ready to Play'} 
                    {currentPlayer?.isReady ? ' ❌' : ' ✅'}
                  </button>
                </div>
                <button
                  onClick={handleStartRound}
                  className="btn btn-primary"
                >
                  Start Game 🚀
                </button>
              </div>
            )}

            {gameRoomState.gameState === 'finished'
            //  && !gameComplete
              && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
                  Round {currentRound} Complete!
                </h2>
                <div className="mb-4">
                  <button
                    onClick={handleToggleReady}
                    className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {currentPlayer?.isReady ? 'Not Ready' : 'Ready for Next Round'} 
                    {currentPlayer?.isReady ? ' ❌' : ' ✅'}
                  </button>
                </div>
                <button
                  onClick={handleNextRound}
                  className="btn btn-primary"
                >
                  Start Round {currentRound + 1} 🚀
                </button>
              </div>
            )}

            {/* {gameComplete && (
              <div className="text-center mb-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                  🏆 Game Complete! 🏆
                </h2>
                {overallWinner?.id === currentPlayer?.id ? (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Congratulations! You are the overall winner!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Final Score: {currentPlayer?.totalScore || 0} points
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Game Over! Better luck next time!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Your Final Score: {currentPlayer?.totalScore || 0} points
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      Winner: {overallWinner?.name || 'Unknown'}
                    </p>
                  </div>
                )}
                <div className="mt-4 space-x-4">
                  <button
                    onClick={() => router.push('/')}
                    className="btn btn-secondary"
                  >
                    Back to Home 🏠
                  </button>
                </div>
              </div>
            )}            Virtual Keyboard */}
            <div className="mb-8">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={!currentPlayer || currentPlayer.gameStatus !== 'playing' || gameRoomState.gameState !== 'playing'}
              />
            </div>

            {/* Game Instructions */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>Type letters using your keyboard or click the buttons above</p>
              <p>Press Enter to submit your guess • Press Backspace to delete</p>
            </div>

            {/* Back to Home Button */}
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="btn btn-secondary"
              >
                ← Back to Home
              </button>
            </div>
          </div>          {/* Right Sidebar - Connection Status */}
          <div className="xl:w-80 space-y-4">
            {/* Quick Ready Button for Desktop */}
            {gameState === 'waiting' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Game Status
                </h3>
                <button
                  onClick={handleToggleReady}
                  className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-primary'} w-full`}
                >
                  {currentPlayer?.isReady ? 'Not Ready' : 'Ready to Play'} 
                  {currentPlayer?.isReady ? ' ❌' : ' ✅'}
                </button>
              </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Connection Status
              </h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Room ID:</span>
                  <span className="font-mono text-xs">{roomId}</span>
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
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {(currentPlayer?.currentRow || 0) + 1}/6 | Status: {currentPlayer?.gameStatus || 'waiting'}
              </div>
            </div>

            {/* Game Grid */}
            <div className="mb-6">
              {/* Debug information */}
              <div className="text-xs text-gray-500 mb-2">
                Debug - Guesses: {JSON.stringify(guesses)} | Evaluations length: {evaluations.length}
              </div>
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentPlayer?.currentRow || 0}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>            {/* Game Status Messages */}
            {currentPlayer?.gameStatus === 'won' && (
              <div className="text-center mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
              </div>
            )}

            {currentPlayer?.gameStatus === 'lost' && (
              <div className="text-center mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
              </div>
            )}

            {/* Mobile Ready/Control Buttons */}
            {gameState === 'waiting' && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <div className="mb-4">
                  <button
                    onClick={handleToggleReady}
                    className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-primary'} w-full mb-2`}
                  >
                    {currentPlayer?.isReady ? 'Not Ready' : 'Ready to Play'} 
                    {currentPlayer?.isReady ? ' ❌' : ' ✅'}
                  </button>
                </div>
                <button
                  onClick={handleStartRound}
                  className="btn btn-primary w-full"
                >
                  Start Game 🚀
                </button>
              </div>
            )}

            {gameState === 'finished' && (
              <div className="text-center mb-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
                  Round {currentRound} Complete!
                </h2>
                <div className="mb-4">
                  <button
                    onClick={handleToggleReady}
                    className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-primary'} w-full mb-2`}
                  >
                    {currentPlayer?.isReady ? 'Not Ready' : 'Ready for Next Round'} 
                    {currentPlayer?.isReady ? ' ❌' : ' ✅'}
                  </button>
                </div>
                <button
                  onClick={handleNextRound}
                  className="btn btn-primary w-full"
                >
                  Start Round {currentRound + 1} 🚀
                </button>
              </div>
            )}            {/* Virtual Keyboard */}
            <div className="mb-6">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={!currentPlayer || currentPlayer.gameStatus !== 'playing' || gameRoomState.gameState !== 'playing'}
              />
            </div>

            {/* Game Instructions */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
              <p>Type letters using your keyboard or click the buttons above</p>
              <p>Press Enter to submit your guess • Press Backspace to delete</p>
            </div>
          </div>

          {/* Mobile Boards Section - Bottom */}
          <div className="space-y-6">            {/* Room Status and Leaderboard */}
            <div className="grid grid-cols-1 gap-4">
              <RoomStatus 
                gameState={gameState}
                winner={winner}
                players={players}
              />
              <PlayersLeaderboard 
                players={Array.from(players.values())} 
                currentPlayerId={currentPlayer?.id || ''} 
              />
            </div>

            {/* Back to Home Button */}
            <div className="text-center pt-4">
              <button
                onClick={() => router.push('/')}
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
