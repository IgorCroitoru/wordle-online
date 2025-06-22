import { Server, matchMaker } from 'colyseus';
import { createServer } from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WordleRoom } from './rooms/WordleRoom';
import { WebSocketTransport } from '@colyseus/ws-transport';
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

// Register room handlers
gameServer.define('wordle', WordleRoom).filterBy(["wordleRoomId"])

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available rooms
app.get('/rooms', async (req: Request, res: Response) => {
  try {
    const rooms = await matchMaker.query({ name: 'wordle' });
    res.json({
      rooms: rooms.map((room: any) => ({
        roomId: room.roomId,
        clients: room.clients,
        maxClients: room.maxClients,
        metadata: room.metadata
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

gameServer.listen(port);

console.log(`🎮 Wordle Game Server is running on ws://localhost:${port}`);
console.log(`📊 Monitor: http://localhost:${port}/colyseus`);
