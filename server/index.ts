import { Server, matchMaker } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import type { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { WordleRoom } from './rooms/WordleRoom';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { getAvailableLanguages, dictionaryManager } from './words';
import { RoomManager } from './RoomManager';
const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Create HTTP & WebSocket servers
const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server})
});

// Get RoomManager instance
const roomManager = RoomManager.getInstance();
// Register room handlers
 gameServer.define('wordle', WordleRoom)
//   .filterBy(["wordleRoomId", "language"]);

// Custom endpoint to create a room with generated unique ID
const createRoomHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { playerName, persistentId ,language = 'en' } = req.body;
    
    if (!playerName) {
      res.status(400).json({ error: 'Player name is required' });
      return;
    }

    const result = await roomManager.createRoomWithUniqueId(playerName, persistentId, language);
    res.json(result);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

app.post('/create-room', createRoomHandler);

// Custom endpoint to join existing room by wordleRoomId
const joinRoomHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { wordleRoomId, playerName, persistentId, language = 'en' } = req.body;
    
    if (!wordleRoomId || !playerName) {
      res.status(400).json({ error: 'Room ID and player name are required' });
      return;
    }

    const result = await roomManager.joinRoomByCode(wordleRoomId, playerName, persistentId, language);
    res.json(result);
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(404).json({ error: 'Room not found or failed to join' });
  }
};

app.post('/join-room', joinRoomHandler);

// Health check endpoint
const healthCheckHandler: RequestHandler = (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

app.get('/health', healthCheckHandler);

// Get available languages
const languagesHandler: RequestHandler = (req: Request, res: Response) => {
  try {
    const languages = getAvailableLanguages();
    res.json({
      languages,
      statistics: dictionaryManager.getStatistics()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get languages' });
  }
};

app.get('/languages', languagesHandler);

// Get available rooms
const roomsHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const rooms = await roomManager.getAllRooms();
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rooms' });
  }
};

app.get('/rooms', roomsHandler);

gameServer.listen(port);

console.log(`🎮 Wordle Game Server is running on ws://localhost:${port}`);
console.log(`📊 Monitor: http://localhost:${port}/colyseus`);
