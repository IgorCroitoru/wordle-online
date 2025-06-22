'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, LoadingSpinner } from '@/components/ui';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const name = localStorage.getItem('playerName') || '' ;
    setPlayerName(name);
  },[])
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsCreating(true);
    try {
      const newRoomCode = generateRoomCode();
      console.log('Creating room with code:', newRoomCode);
      // Store player name in localStorage for the game
      localStorage.setItem('playerName', playerName.trim());
      // Navigate to the room
      router.push(`/room/${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!roomCode.trim()) {
      alert('Please enter a room code');
      return;
    }

    setIsJoining(true);
    try {
      // Store player name in localStorage for the game
      localStorage.setItem('playerName', playerName.trim());
      // Navigate to the room
      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center fade-in">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Wordle Online
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Play Wordle with friends in real-time!
          </p>
        </div>

        {/* Main Card */}
        <Card className="fade-in">
          <div className="space-y-6">
            {/* Player Name Input */}
            <Input
              label="Your Name"
              placeholder="Enter your name"
              value={playerName}
              onChange={setPlayerName}
              maxLength={20}
            />

            {/* Create Room Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Room
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Start a new game and invite friends to join
              </p>
              <Button
                onClick={handleCreateRoom}
                disabled={!playerName.trim()}
                loading={isCreating}
                className="w-full"
              >
                {!isCreating && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
                {isCreating ? 'Creating Room...' : 'Create Room'}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  or
                </span>
              </div>
            </div>

            {/* Join Room Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Join Existing Room
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter the room code shared by your friend
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Enter room code (e.g., ABC123)"
                  value={roomCode}
                  onChange={(value) => setRoomCode(value.toUpperCase())}
                  maxLength={6}
                />
                <Button
                  variant="secondary"
                  onClick={handleJoinRoom}
                  disabled={!playerName.trim() || !roomCode.trim()}
                  loading={isJoining}
                  className="w-full"
                >
                  {!isJoining && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  )}
                  {isJoining ? 'Joining Room...' : 'Join Room'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* How to Play */}
        <Card className="fade-in">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            How to Play
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start space-x-3">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Create or join a room with friends</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>Everyone gets the same word to guess</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>See others' progress without seeing their letters</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
              <span>First to solve wins!</span>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 fade-in">
          <p>Built with Next.js • Share the room code with friends to play together</p>
        </div>
      </div>
    </div>
  );
}
