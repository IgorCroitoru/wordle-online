import { useEffect, useState, useCallback, useRef } from "react";
import { Client, getStateCallbacks, JoinOptions, Room } from "colyseus.js";
import {
  WordleGameState,
  Player,
  TileState,
  RoomGameState,
} from "../../server/schemas/WordleGameState";
interface RoomJoinOptions {
  playerName: string;
  wordleRoomId?: string;
}
interface GameHookReturn {
  room: Room<WordleGameState> | null;
  isConnected: boolean;
  currentPlayer: Player | null;
  players: Map<string, Player>;
  currentRound: number;
  gameState: RoomGameState;
  winner: string | undefined;
  joinRoom: (
    room: string,
    options: RoomJoinOptions & JoinOptions
  ) => Promise<void>;
  makeGuess: (guess: string) => void;
  setReady: (ready: boolean) => void;
  startRound: () => void;
  nextRound: () => void;
  disconnect: () => void;
  error: string | null;
}

export const useWordleGame = (): GameHookReturn => {
  const [room, setRoom] = useState<Room<WordleGameState> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [winner, setWinner] = useState<string | undefined>(undefined);
  const [gameState, setGameState] = useState<RoomGameState>("waiting");
  const [players, setPlayers] = useState<Map<string, Player>>(
    new Map<string, Player>()
  );
  const clientRef = useRef<Client | null>(null);
  const connectionAttemptRef = useRef<string | null>(null); // Track current connection attempt

  useEffect(() => {
    // Initialize Colyseus client
    const serverUrl =
      process.env.NODE_ENV === "production"
        ? "wss://your-production-server.com"
        : "ws://localhost:2567";

    clientRef.current = new Client(serverUrl);

    return () => {
      if (room) {
        room.leave();
      }
      clientRef.current = null;
    };
  }, []);
  const joinRoom = useCallback(
    async (
      roomName: string,
      options: JoinOptions & RoomJoinOptions,
      retryCount = 0
    ) => {
      const attemptKey = `${roomName}-${options.wordleRoomId}-${options.playerName}`;

      console.log("Joining room:", roomName);
      if (!clientRef.current) return;

      // Prevent multiple connections to the same room
      if (isConnecting) {
        console.log("Already connecting, skipping...");
        return;
      }

      if (connectionAttemptRef.current === attemptKey) {
        console.log("Connection attempt already in progress for:", attemptKey);
        return;
      }

      // Check if already connected to this room
      if (room && room.connection.isOpen) {
        console.log("Already connected to room:", room.roomId);
        return;
      }

      setIsConnecting(true);
      connectionAttemptRef.current = attemptKey;

      try {
        console.log(`🔗 Joining room: ${roomName}...`);
        const newRoom = await clientRef.current.joinOrCreate<WordleGameState>(
          roomName,
          options
        );
        console.log("✅ Joined room:", newRoom.name, newRoom.roomId);
        setRoom(newRoom);
        setIsConnected(true);
        const $ = getStateCallbacks(newRoom);

        $(newRoom.state).players.onAdd((player, sessionId) => {
          console.log("Player added:", player, sessionId);
          $(player).progress.onChange((value, index) => {
            console.log("Player progress updated:", value, index);
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.progress[index] = value;
              } else {
                player.progress[index] = value; // Ensure progress is initialized
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          });
          $(player).progress.onRemove((value, index) => {
            console.log("Player progress removed:", value, index);
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.progress[index] = value;
              } else {
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          })
          $(player).listen("progress", (value) => {
            console.log("Progress updated:", value);
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.progress = value;
              } else {
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          });
          $(player).listen("gameStatus", (value) => {
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.gameStatus = value;
              } else {
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          });
          $(player).listen("currentRow", (value) => {
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
          $(player).listen("completionTime", (value) => {
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.completionTime = value;
              } else {
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          });
          $(player).listen("isReady", (value) => {
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
          $(player).listen("name", (value) => {
            setPlayers((prev) => {
              const newMap = new Map(prev);
              const existingPlayer = newMap.get(sessionId);
              if (existingPlayer) {
                existingPlayer.name = value;
              } else {
                newMap.set(sessionId, player);
              }
              return newMap;
            });
          });

          setPlayers((prev) => new Map(prev).set(sessionId, player));

          // Update current player if it's us
          if (sessionId === newRoom.sessionId) {
            setCurrentPlayer(player);
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
        // $(newRoom.state).players.onChange((player, sessionId) => {
        //     console.log("Player changed:", player, sessionId);
        //   setPlayers((prev) => new Map(prev).set(sessionId, player));

        //   // Update current player if it's us
        //   if (sessionId === newRoom.sessionId) {
        //     setCurrentPlayer(player);
        //   }
        // });
        $(newRoom.state).listen("currentRound", (value) => {
          setCurrentRound(value);
        });
        $(newRoom.state).listen("gameState", (value) => {
          setGameState(value);
        });
        $(newRoom.state).listen("winner", (value) => {
          setWinner(value);
        });

        newRoom.onError((code, message) => {
          console.error("Room error:", code, message);
          setError(`Room error: ${message}`);
        });
        newRoom.onLeave((code) => {
          console.log("Left room with code:", code);
          setIsConnected(false);
          setRoom(null);
          setCurrentRound(1);
          setWinner(undefined);
          setGameState("waiting");
          setCurrentPlayer(null);
          setPlayers(new Map());
          connectionAttemptRef.current = null; // Clear connection attempt
        });
      } catch (error) {
        console.error("❌ Error joining room:", error);

        // Handle authentication failure
        setError(
          error instanceof Error ? error.message : "Failed to join room"
        );

        // setJoinError(true);      } finally {
        setIsConnecting(false);
        connectionAttemptRef.current = null; // Clear connection attempt
      }
    },
    [] // Remove problematic dependencies to prevent recreation
  );
  const leaveRoom = useCallback(async () => {
    if (room && room.connection.isOpen && !isConnecting) {
      console.log("👋 Leaving room:", room.name);
      await room.leave();
      setIsConnected(false);
      console.log("Before setting room to null");
      setRoom(null);
      console.log("Room is null");
    }
  }, []); // Remove dependencies to prevent recreation

  const makeGuess = useCallback(
    (guess: string) => {
      if (room && guess.length === 5) {
        room.send("guess", { guess: guess.toUpperCase() });
      }
    },
    [room]
  );

  const setReady = useCallback(
    (ready: boolean) => {
      if (room) {
        room.send("ready", { ready });
      }
    },
    [room]
  );

  const startRound = useCallback(() => {
    if (room) {
      room.send("startRound", {});
    }
  }, [room]);

  const nextRound = useCallback(() => {
    if (room) {
      room.send("nextRound", {});
    }
  }, [room]);

  const disconnect = useCallback(() => {
    if (room) {
      room.leave();
    }
  }, [room]);

  // Debug effect to track state changes
  useEffect(() => {
    console.log("Hook state changed:", {
      isConnected,
      isConnecting,
      hasRoom: !!room,
      roomId: room?.roomId,
      connectionAttempt: connectionAttemptRef.current,
    });
  }, [isConnected, isConnecting, room]);

  return {
    currentRound,
    gameState,
    winner,
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
  };
};
