'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  GameGrid, 
  Keyboard, 
  TileState, 
  PlayerProgress, 
  PlayersLeaderboard, 
  RoomStatus,
  Player,
  RoomData 
} from '@/components/GameComponents';

export default function GameRoom() {
  const params = useParams();
  const router = useRouter();  const roomId = params.roomId as string;
  const [playerName, setPlayerName] = useState('');
  const [currentPlayerId] = useState(() => Math.random().toString(36).substring(2, 8));
    // Multi-round game state
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds] = useState(3); // Can be configurable later
  const [roundScores, setRoundScores] = useState<Record<string, number[]>>({});
  const [overallWinner, setOverallWinner] = useState<string | null>(null);
  const [gameComplete, setGameComplete] = useState(false);
  
  // Single round game state
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [evaluations, setEvaluations] = useState<TileState[][]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>({});
  const [roundStatus, setRoundStatus] = useState<'playing' | 'finished'>('playing');
  // Mock multiplayer data with round support
  const [roomData] = useState<RoomData>({
    id: roomId,
    gameState: 'playing',
    currentRound: 1,
    totalRounds: 3,
    players: [
      {
        id: currentPlayerId,
        name: playerName || 'You',
        currentRow: 0,
        gameStatus: 'playing',
        isReady: true,
        roundScores: [6, 4], // Scores from previous rounds
        totalScore: 10,
        progress: Array(6).fill(null).map(() => Array(5).fill('empty' as TileState))
      },
      {
        id: 'player2',
        name: 'Alice',
        currentRow: 2,
        gameStatus: 'playing',
        isReady: true,
        roundScores: [7, 3],
        totalScore: 10,
        progress: [
          ['absent', 'absent', 'present', 'absent', 'absent'],
          ['correct', 'absent', 'present', 'absent', 'correct'],
          ...Array(4).fill(null).map(() => Array(5).fill('empty' as TileState))
        ]
      },
      {
        id: 'player3',
        name: 'Bob',
        currentRow: 1,
        gameStatus: 'playing',
        isReady: true,
        roundScores: [5, 6],
        totalScore: 11,
        progress: [
          ['absent', 'present', 'absent', 'correct', 'absent'],
          ...Array(5).fill(null).map(() => Array(5).fill('empty' as TileState))
        ]
      },
      {
        id: 'player4',
        name: 'Charlie',
        currentRow: 3,
        gameStatus: 'won',
        completionTime: 45000,
        isReady: true,
        roundScores: [6, 7],
        totalScore: 13,
        progress: [
          ['absent', 'present', 'absent', 'absent', 'present'],
          ['present', 'absent', 'correct', 'absent', 'present'],
          ['correct', 'correct', 'correct', 'correct', 'correct'],
          ...Array(3).fill(null).map(() => Array(5).fill('empty' as TileState))
        ]
      }
    ],
    winner: 'player4'
  });

  useEffect(() => {
    // Get player name from localStorage
    const savedName = localStorage.getItem('playerName');
    if (!savedName) {
      router.push('/');
      return;
    }
    setPlayerName(savedName);
    
    // Update the current player's name in room data
    roomData.players.find(p => p.id === currentPlayerId)!.name = savedName;
  }, [router]);

  const handleLetterClick = (letter: string) => {
    if (gameStatus !== 'playing' || currentGuess.length >= 5) return;
    setCurrentGuess(currentGuess + letter);
  };

  const handleBackspace = () => {
    if (gameStatus !== 'playing') return;
    setCurrentGuess(currentGuess.slice(0, -1));
  };
  const handleEnter = () => {
    if (gameStatus !== 'playing' || currentGuess.length !== 5) return;
    
    // For now, just add the guess without evaluation
    // In the real game, this would be handled by the server
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    
    // Mock evaluation (all absent for now - in real game, this would come from server)
    const mockEvaluation: TileState[] = Array(5).fill('absent');
    setEvaluations([...evaluations, mockEvaluation]);
    
    setCurrentGuess('');
    const newRow = currentRow + 1;
    setCurrentRow(newRow);
      // Mock win condition (different word for each round)
    const currentWord = getCurrentRoundWord();
    const won = currentGuess.toUpperCase() === currentWord;
    
    if (won) {
      setGameStatus('won');
      finishCurrentRound(true);
    } else if (newRow >= 6) {
      setGameStatus('lost');
      finishCurrentRound(false);
    }
  };

  // Scoring system: 7 points for row 1, 6 for row 2, etc. 0 for loss
  const calculateScore = (won: boolean, completedRow: number): number => {
    if (!won) return 0;
    return Math.max(7 - completedRow, 1); // 7 points for row 0, down to 1 point for row 5
  };

  const getTotalScore = (playerId: string): number => {
    const scores = roundScores[playerId] || [];
    return scores.reduce((total, score) => total + score, 0);
  };
  const startNewRound = () => {
    // Add a small delay for better UX
    setTimeout(() => {
      // Reset single round state
      setCurrentGuess('');
      setGuesses([]);
      setCurrentRow(0);
      setEvaluations([]);
      setGameStatus('playing');
      setLetterStates({});
      setRoundStatus('playing');
      
      // Move to next round
      setCurrentRound(prev => prev + 1);
    }, 500);
  };  const finishCurrentRound = (won: boolean) => {
    const score = calculateScore(won, currentRow);
    
    // Update round scores
    setRoundScores(prev => ({
      ...prev,
      [currentPlayerId]: [...(prev[currentPlayerId] || []), score]
    }));

    setRoundStatus('finished');

    // Check if this was the final round
    if (currentRound >= totalRounds) {
      setGameComplete(true);
      
      // Calculate final scores for all players
      const finalScores = roomData.players.map(player => {
        const playerRoundScores = roundScores[player.id] || [];
        // Add current player's score from this round
        const scores = player.id === currentPlayerId 
          ? [...playerRoundScores, score]
          : [...playerRoundScores];
        
        // Add any remaining scores from player's existing data
        const existingTotal = player.totalScore || 0;
        const calculatedTotal = scores.reduce((sum, s) => sum + s, 0);
        
        return {
          id: player.id,
          name: player.name,
          totalScore: Math.max(existingTotal, calculatedTotal)
        };
      });
      
      // Find the winner (player with highest total score)
      const winner = finalScores.reduce((best, current) => 
        current.totalScore > best.totalScore ? current : best
      );
      
      setOverallWinner(winner.id);
    }
  };
  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameStatus !== 'playing' || roundStatus === 'finished' || overallWinner) return;
      
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
  }, [currentGuess, currentRow, gameStatus, roundStatus, overallWinner]);

  const resetGameForNewMatch = () => {
    setCurrentRound(1);
    setRoundScores({});
    setOverallWinner(null);
    setGameComplete(false);
    setRoundStatus('playing');
    setCurrentGuess('');
    setGuesses([]);
    setCurrentRow(0);
    setEvaluations([]);
    setGameStatus('playing');
    setLetterStates({});
  };

  // Helper function to get current round status display
  const getRoundStatusDisplay = () => {
    if (overallWinner) return '🏆 Game Complete';
    if (roundStatus === 'finished' && currentRound < totalRounds) return `✅ Round ${currentRound} Complete`;
    if (roundStatus === 'playing') return `🎯 Round ${currentRound} in Progress`;
    return `Round ${currentRound}`;
  };

  // Mock word list for different rounds (in real implementation, this would come from server)
  const mockWordsForRounds = ['HELLO', 'WORLD', 'GAMES', 'PARTY', 'MAGIC'];
  
  const getCurrentRoundWord = () => {
    return mockWordsForRounds[currentRound - 1] || 'HELLO';
  };

  if (!playerName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">        {/* Header */}
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
                Round {currentRound} of {totalRounds}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                Your Score: {getTotalScore(currentPlayerId)} pts
              </span>
            </div>
            
            {/* Round Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentRound / totalRounds) * 100}%` }}
              />
            </div>
              {/* Round Status */}
            <div className="text-center mb-2">
              <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                {getRoundStatusDisplay()}
              </span>
            </div>
            
            {/* Round Scores */}
            {roundScores[currentPlayerId] && roundScores[currentPlayerId].length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Previous rounds: {roundScores[currentPlayerId].join(', ')} pts
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:flex-row gap-8 max-w-7xl mx-auto">
          {/* Left Sidebar - Multiplayer Info (Desktop Only) */}
          <div className="lg:w-80 space-y-4">
            <RoomStatus roomData={roomData} />
            <PlayersLeaderboard 
              players={roomData.players} 
              currentPlayerId={currentPlayerId} 
            />
          </div>

          {/* Main Game Area (Desktop) */}
          <div className="flex-1 max-w-2xl mx-auto lg:mx-0">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {currentRow + 1}/6 | Status: {gameStatus}
              </div>
            </div>            {/* Game Grid */}
            <div className="mb-8">
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentRow}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>

            {/* Game Status Messages */}
            {gameStatus === 'won' && (
              <div className="text-center mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  You scored {calculateScore(true, currentRow)} points this round!
                </p>
              </div>
            )}

            {gameStatus === 'lost' && (
              <div className="text-center mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                  You scored 0 points this round.
                </p>
              </div>
            )}

            {/* Round Transition UI */}
            {roundStatus === 'finished' && !overallWinner && currentRound < totalRounds && (
              <div className="text-center mb-6 p-6 bg-blue-100 dark:bg-blue-900 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
                  Round {currentRound} Complete!
                </h2>
                <p className="text-blue-700 dark:text-blue-300 mb-4">
                  Your total score: {getTotalScore(currentPlayerId)} points
                </p>
                <button
                  onClick={startNewRound}
                  className="btn btn-primary bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg font-semibold"
                >
                  Start Round {currentRound + 1} 🚀
                </button>
              </div>
            )}

            {/* Overall Game Complete */}
            {overallWinner && (
              <div className="text-center mb-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                  🏆 Game Complete! 🏆
                </h2>
                {overallWinner === currentPlayerId ? (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Congratulations! You are the overall winner!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Final Score: {getTotalScore(currentPlayerId)} points
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Game Over! Better luck next time!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Your Final Score: {getTotalScore(currentPlayerId)} points
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      Winner: {roomData.players.find(p => p.id === overallWinner)?.name}
                    </p>
                  </div>
                )}
                <div className="mt-4 space-x-4">
                  <button
                    onClick={() => {
                      // Reset for new game
                      resetGameForNewMatch();
                    }}
                    className="btn btn-primary bg-green-600 hover:bg-green-700"
                  >
                    Play Again 🔄
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="btn btn-secondary"
                  >
                    Back to Home 🏠
                  </button>
                </div>
              </div>
            )}            {/* Virtual Keyboard */}
            <div className="mb-8">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={gameStatus !== 'playing' || roundStatus === 'finished' || !!overallWinner}
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
          </div>

          {/* Right Sidebar - Other Players Progress (Desktop Only) */}
          <div className="xl:w-80 space-y-4">
            {/* <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Other Players
            </h3>
            {roomData.players
              .filter(player => player.id !== currentPlayerId)
              .map(player => (
                <PlayerProgress 
                  key={player.id} 
                  player={player}
                  className="mb-4"
                />
              ))
            } */}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Game Area - Top Priority */}
          <div className="mb-8">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Row: {currentRow + 1}/6 | Status: {gameStatus}
              </div>
            </div>

            {/* Game Grid */}
            <div className="mb-6">
              <GameGrid
                guesses={guesses}
                currentGuess={currentGuess}
                currentRow={currentRow}
                evaluations={evaluations}
                maxRows={6}
                className="mb-6"
              />
            </div>            {/* Game Status Messages */}
            {gameStatus === 'won' && (
              <div className="text-center mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                  🎉 Congratulations! You won!
                </h2>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  You scored {calculateScore(true, currentRow)} points this round!
                </p>
              </div>
            )}

            {gameStatus === 'lost' && (
              <div className="text-center mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
                  😔 Game Over! Better luck next time!
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                  You scored 0 points this round.
                </p>
              </div>
            )}

            {/* Round Transition UI */}
            {roundStatus === 'finished' && !overallWinner && currentRound < totalRounds && (
              <div className="text-center mb-6 p-6 bg-blue-100 dark:bg-blue-900 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
                  Round {currentRound} Complete!
                </h2>
                <p className="text-blue-700 dark:text-blue-300 mb-4">
                  Your total score: {getTotalScore(currentPlayerId)} points
                </p>
                <button
                  onClick={startNewRound}
                  className="btn btn-primary bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg font-semibold"
                >
                  Start Round {currentRound + 1} 🚀
                </button>
              </div>
            )}

            {/* Overall Game Complete */}
            {overallWinner && (
              <div className="text-center mb-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                  🏆 Game Complete! 🏆
                </h2>
                {overallWinner === currentPlayerId ? (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Congratulations! You are the overall winner!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Final Score: {getTotalScore(currentPlayerId)} points
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl text-yellow-700 dark:text-yellow-300 mb-2">
                      Game Over! Better luck next time!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Your Final Score: {getTotalScore(currentPlayerId)} points
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      Winner: {roomData.players.find(p => p.id === overallWinner)?.name}
                    </p>
                  </div>
                )}
                <div className="mt-4 space-x-4">
                  <button
                    onClick={() => {
                      // Reset for new game
                      resetGameForNewMatch();
                    }}
                    className="btn btn-primary bg-green-600 hover:bg-green-700"
                  >
                    Play Again 🔄
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="btn btn-secondary"
                  >
                    Back to Home 🏠
                  </button>
                </div>
              </div>
            )}            {/* Virtual Keyboard */}
            <div className="mb-6">
              <Keyboard
                onLetterClick={handleLetterClick}
                onEnter={handleEnter}
                onBackspace={handleBackspace}
                letterStates={letterStates}
                disabled={gameStatus !== 'playing' || roundStatus === 'finished' || !!overallWinner}
              />
            </div>

            {/* Game Instructions */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
              <p>Type letters using your keyboard or click the buttons above</p>
              <p>Press Enter to submit your guess • Press Backspace to delete</p>
            </div>
          </div>

          {/* Mobile Boards Section - Bottom */}
          <div className="space-y-6">
            {/* Room Status and Leaderboard */}
            <div className="grid grid-cols-1 gap-4">
              <RoomStatus roomData={roomData} />
              <PlayersLeaderboard 
                players={roomData.players} 
                currentPlayerId={currentPlayerId} 
              />
            </div>

            {/* Other Players Progress */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                Other Players Progress
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roomData.players
                  .filter(player => player.id !== currentPlayerId)
                  .map(player => (
                    <PlayerProgress 
                      key={player.id} 
                      player={player}
                    />
                  ))
                }
              </div>
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
