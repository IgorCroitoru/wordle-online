'use client';

import React, { createContext, useContext, useCallback, useRef, useEffect, useState, ReactNode } from 'react';
import { Client, getStateCallbacks, JoinOptions, Room } from "colyseus.js";
import {
  WordleGameState,
  Player,
  RoomGameState,
  TileState,
  GameStatus,
  IPlayerData,
  SOCKET_MESSAGES,
  PrivatePlayerGuessData,
} from "../types";


interface RoomJoinOptions {
  playerName: string;
  wordleRoomId?: string;
  persistentId?: string; // For reconnection
}

interface WordleGameContextType {
  setWrongWord: (word: { word: string; row: number } | null) => void;
  wrongWord: { word: string; row: number } | null;
  currentRow: number;
  languageId: string;
  wordleRoomId: string | null;
  room: Room<WordleGameState> | null;
  isConnected: boolean;
  currentPlayer: IPlayerData | null;
  players: Map<string, Player>;
  currentRound: number;
  gameState: RoomGameState;
  winner: string | undefined;
  guesses: string[];
  joinRoom: (options: RoomJoinOptions & JoinOptions) => Promise<void>;
  createRoom: (options: RoomJoinOptions & JoinOptions) => Promise<void>;
  makeGuess: (guess: string) => void;
  setReady: (ready: boolean) => void;
  startRound: () => void;
  nextRound: () => void;
  disconnect: () => void;
  error: string | null;
}

const WordleGameContext = createContext<WordleGameContextType | undefined>(undefined);

interface WordleGameProviderProps {
  children: ReactNode;
}

export const WordleGameProvider: React.FC<WordleGameProviderProps> = ({ children }) => {
  const [currentRow, setCurrentRow] = useState<number>(0);
  const [room, setRoom] = useState<Room<WordleGameState> | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [languageId, setLanguageId] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [winner, setWinner] = useState<string | undefined>(undefined);
  const [gameState, setGameState] = useState<RoomGameState>("waiting");
  const [wordleRoomId, setWordleRoomId] = useState<string | null>(null);
  const [wrongWord, setWrongWord] = useState<{word:string,row:number} | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(
    new Map<string, Player>()
  );
  const clientRef = useRef<Client | null>(null);
  const connectionAttemptRef = useRef<string | null>(null); // Track current connection attempt

  useEffect(() => {
    console.log("Current player updated:", currentPlayer);
  }, [currentPlayer]);

  useEffect(() => {
    // Initialize Colyseus client
    const serverUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:2567";

    clientRef.current = new Client(serverUrl);

    return () => {
      console.log("Cleaning up Colyseus client...");
      console.log(room);
      if (room && room.connection.isOpen && !isConnecting) {
        console.log("Leaving room before cleanup:", room.name);
        console.log(room, room.connection.isOpen, !isConnecting);
        room.leave().then(() => {
          console.log("Room left and cleaned up");
        });
      }
      clientRef.current = null;
    };
  }, [room, isConnecting]);
  // Reusable function to bind room events and state listeners
  const bindRoomEvents = useCallback((newRoom: Room<WordleGameState>) => {
    const $ = getStateCallbacks(newRoom);
    
    // Player state listeners
    $(newRoom.state).players.onAdd((player, sessionId) => {
      console.log("Player added:", player, sessionId);
      
      $(player).onChange(() => {
        console.log("Player changed:", player, sessionId);
        if (sessionId === newRoom.sessionId) {
          console.log("Current player updated:", player);
          setCurrentPlayer(player.toJSON() as IPlayerData);
        }
      });

      $(player).progress.onChange((value: string, index: number) => {
        console.log("Player progress updated:", value, index);
        setPlayers((prev) => {
          const newMap = new Map(prev);
          const existingPlayer = newMap.get(sessionId);
          if (existingPlayer) {
            existingPlayer.progress[index] = value as TileState;
          } else {
            newMap.set(sessionId, player);
          }
          return newMap;
        });
      });

      $(player).listen("gameStatus", (value: string) => {
        setPlayers((prev) => {
          const newMap = new Map(prev);
          const existingPlayer = newMap.get(sessionId);
          if (existingPlayer) {
            existingPlayer.gameStatus = value as GameStatus;
          } else {
            newMap.set(sessionId, player);
          }
          return newMap;
        });
      });

      $(player).listen("currentRow", (value: number) => {
        if (sessionId === newRoom.sessionId) {
            setCurrentRow(value);
        }
        setPlayers((prev) => {
          const newMap = new Map(prev);
          const existingPlayer = newMap.get(sessionId);
          if (existingPlayer) {
            existingPlayer.currentRow = value;
          } else {
            newMap.set(sessionId, player);
          }
          return newMap;
        });
      });
      
      $(player).listen("isReady", (value: boolean) => {
        setPlayers((prev) => {
          const newMap = new Map(prev);
          const existingPlayer = newMap.get(sessionId);
          if (existingPlayer) {
            existingPlayer.isReady = value;
          } else {
            newMap.set(sessionId, player);
          }
          return newMap;
        });
      });

      console.log("Adding player to state:", player, sessionId);
      setPlayers((prev) => new Map(prev).set(sessionId, player));

      // Update current player if it's us
      if (sessionId === newRoom.sessionId) {
        console.log("Setting current player:", player);
        setCurrentPlayer(player.toJSON() as IPlayerData);
      }
    });

    $(newRoom.state).players.onRemove((player, sessionId) => {
      console.log("Player removed:", player, sessionId);
      setPlayers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });

      // Clear current player if it's us
      if (sessionId === newRoom.sessionId) {
        setCurrentPlayer(null);
      }
    });

    // Game state listeners
    $(newRoom.state).listen("languageId", (value: string) => {
      setLanguageId(value);
    })
    $(newRoom.state).onChange(() => {
      console.log("Game state changed:", newRoom.state);
      setGameState(newRoom.state.gameState);
      setCurrentRound(newRoom.state.currentRound);
      setWinner(newRoom.state.winner);
      
      const playersMap = new Map<string, Player>();
      newRoom.state.players.forEach((player, sessionId) => {
        playersMap.set(sessionId, player);
      });
      setPlayers(playersMap);
    });

    newRoom.onMessage(SOCKET_MESSAGES.INVALID_WORD, (data: { word: string, row: number }) => {
        setWrongWord({ word: data.word, row: data.row });
    });
    // Message handlers
    newRoom.onMessage(SOCKET_MESSAGES.PLAYER_GUESSES, (data: PrivatePlayerGuessData) => {
      console.log("Received private player data:", data);
      setGuesses(data.guesses);
      if (data.roundNumber !== currentRound) {
        console.warn(
          `Round number mismatch: received ${data.roundNumber}, expected ${currentRound}`
        );
      }
    });

    newRoom.onMessage(SOCKET_MESSAGES.JOINED_ROOM, (data: {persistentId: string}) => {
      localStorage.setItem("persistentId", data.persistentId);
    });


    // Error and leave handlers
    newRoom.onError((code, message) => {
      console.error("Room error:", code, message);
      setError(`Room error: ${message}`);
    });

    newRoom.onLeave((code, reason) => {
      console.log("Left room with code:", code);
      setLanguageId('');
      setCurrentRow(0);
      setWordleRoomId(null);
      setError(`Left room: ${reason}`);
      setIsConnected(false);
      setRoom(null);
      setCurrentRound(0);
      setWinner(undefined);
      setGameState("waiting");
      setCurrentPlayer(null);
      setPlayers(new Map());
      connectionAttemptRef.current = null;
    });
  }, [currentRound]);

  const leaveRoom = useCallback(async () => {
    if (room && room.connection.isOpen) {
      try {
        await room.leave();
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    }
    setLanguageId('');
    setCurrentRow(0);
    setWordleRoomId(null);
    setRoom(null);
    setIsConnected(false);
    setCurrentPlayer(null);
    setGuesses([]);
    setError(null);
    setGameState("waiting");
    setCurrentRound(0);
    setWinner(undefined);
    setPlayers(new Map());
  }, [room]);

  const createRoom = useCallback(async (options: RoomJoinOptions & JoinOptions) => {
    if (!clientRef.current) {
      throw new Error("Client not initialized");
    }

    if (isConnecting) {
      console.log("Already connecting, ignoring create room request");
      return;
    }

    // Generate a unique attempt ID
    const attemptId = Math.random().toString(36).substring(7);
    connectionAttemptRef.current = attemptId;

    setIsConnecting(true);
    setError(null);

    try {
      // Call backend endpoint to create room
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2567";
      console.log("backendUrl",backendUrl)
      const response = await fetch(`${backendUrl}/create-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: options.playerName,
          language: localStorage.getItem('selectedLanguage') || 'en',
          persistentId: options.persistentId || localStorage.getItem('persistentId'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }

      const {seatReservation, wordleRoomId} = await response.json();

      // Check if this is still the current attempt
      if (connectionAttemptRef.current !== attemptId) {
        console.log("Connection attempt superseded, aborting");
        return;
      }      // Now join the created room using Colyseus client
      const newRoom = await clientRef.current.consumeSeatReservation<WordleGameState>(seatReservation);
      setWordleRoomId(wordleRoomId);
      // Check again if this is still the current attempt
      if (connectionAttemptRef.current !== attemptId) {
        console.log("Connection attempt superseded after join, leaving room");
        await newRoom.leave();
        return;
      }

      console.log("Successfully created and joined room:", newRoom.name, "with ID:", newRoom.roomId);
      
      bindRoomEvents(newRoom);
      setRoom(newRoom);
      setIsConnected(true);
    } catch (error) {
      console.error("Error creating room:", error);
      if (connectionAttemptRef.current === attemptId) {
        setError(error instanceof Error ? error.message : "Failed to create room");
      }
    } finally {
      if (connectionAttemptRef.current === attemptId) {
        setIsConnecting(false);
        connectionAttemptRef.current = null;
      }
    }
  }, [isConnecting, bindRoomEvents]);

  const joinRoom = useCallback(async (options: RoomJoinOptions & JoinOptions) => {
    if (!clientRef.current) {
      throw new Error("Client not initialized");
    }

    if (isConnecting) {
      console.log("Already connecting, ignoring join room request");
      return;
    }

    if (!options.wordleRoomId) {
      throw new Error("Room ID is required to join a room");
    }

    // Generate a unique attempt ID
    const attemptId = Math.random().toString(36).substring(7);
    connectionAttemptRef.current = attemptId;

    setIsConnecting(true);
    setError(null);

    try {
      // Call backend endpoint to join room
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2567";
      const response = await fetch(`${backendUrl}/join-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wordleRoomId: options.wordleRoomId,
          playerName: options.playerName,
          persistentId: options.persistentId || localStorage.getItem('persistentId'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }

      const seatReservation = await response.json();

      // Check if this is still the current attempt
      if (connectionAttemptRef.current !== attemptId) {
        console.log("Connection attempt superseded, aborting");
        return;
      }      // Now join the room using Colyseus client
      const newRoom = await clientRef.current.consumeSeatReservation<WordleGameState>(seatReservation);
      setWordleRoomId(options.wordleRoomId);
      // Check again if this is still the current attempt
      if (connectionAttemptRef.current !== attemptId) {
        console.log("Connection attempt superseded after join, leaving room");
        await newRoom.leave();
        return;
      }

      console.log("Successfully joined room:", newRoom.name, "with ID:", newRoom.roomId);
      
      bindRoomEvents(newRoom);
      setRoom(newRoom);
      setIsConnected(true);
    } catch (error) {
      console.error("Error joining room:", error);
      if (connectionAttemptRef.current === attemptId) {
        setError(error instanceof Error ? error.message : "Failed to join room");
      }
    } finally {
      if (connectionAttemptRef.current === attemptId) {
        setIsConnecting(false);
        connectionAttemptRef.current = null;
      }
    }
  }, [isConnecting, bindRoomEvents]);
  const makeGuess = useCallback((guess: string) => {
    if (room && isConnected) {
      console.log("Making guess:", guess);
      room.send(SOCKET_MESSAGES.GUESS, { guess: guess.toLowerCase() });
    }
  }, [room, isConnected]);

  const setReady = useCallback((ready: boolean) => {
    if (room && isConnected) {
      console.log("Setting ready status:", ready);
      room.send(SOCKET_MESSAGES.READY, { ready });
    }
  }, [room, isConnected]);

  const startRound = useCallback(() => {
    if (room && isConnected) {
      console.log("Starting round");
      room.send(SOCKET_MESSAGES.START_ROUND);
    }
  }, [room, isConnected]);

  const nextRound = useCallback(() => {
    if (room && isConnected) {
      console.log("Next round");
      room.send(SOCKET_MESSAGES.NEXT_ROUND);
    }
  }, [room, isConnected]);

  const disconnect = useCallback(() => {
    console.log("Disconnecting...");
    leaveRoom();
  }, [leaveRoom]);

  const value: WordleGameContextType = {
    languageId,
    setWrongWord,
    wrongWord,
    currentRow,
    wordleRoomId,
    room,
    isConnected,
    currentPlayer,
    players,
    currentRound,
    gameState,
    winner,
    guesses,
    joinRoom,
    createRoom,
    makeGuess,
    setReady,
    startRound,
    nextRound,
    disconnect,
    error,
  };

  return (
    <WordleGameContext.Provider value={value}>
      {children}
    </WordleGameContext.Provider>
  );
};

export const useWordleGame = (): WordleGameContextType => {
  const context = useContext(WordleGameContext);
  if (context === undefined) {
    throw new Error('useWordleGame must be used within a WordleGameProvider');
  }
  return context;
};
