import { matchMaker } from '@colyseus/core';

export class RoomManager {
  private static instance: RoomManager;
  
  private constructor() {}

  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Generates a unique 5-character room code
   */
  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Checks if a room with the given GuessMateRoomId already exists
   */
  private async isRoomCodeTaken(guessMateRoomId: string): Promise<boolean> {
    try {
      const existingRooms = await matchMaker.query({ 
        name: 'guessMate',
        guessMateRoomId: guessMateRoomId
      });
      return existingRooms.length > 0;
    } catch (error) {
      console.error('Error checking room existence:', error);
      return false;
    }
  }

  /**
   * Generates a unique room ID that doesn't conflict with existing rooms
   * Tries up to 10 times to avoid infinite loops
   */
  async generateUniqueRoomId(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const roomId = this.generateRoomCode();
      const isTaken = await this.isRoomCodeTaken(roomId);
      
      if (!isTaken) {
        console.log(`Generated unique room ID: ${roomId} (attempt ${attempts + 1})`);
        return roomId;
      }
      
      attempts++;
      console.log(`Room ID ${roomId} is taken, trying again... (attempt ${attempts})`);
    }

    // Fallback: if we can't find a unique ID after max attempts, 
    // append timestamp to ensure uniqueness
    const fallbackId = this.generateRoomCode() + Date.now().toString().slice(-2);
    console.warn(`Could not generate unique room ID after ${maxAttempts} attempts, using fallback: ${fallbackId}`);
    return fallbackId;
  }

  /**
   * Creates a new room with a unique ID
   */
  async createRoomWithUniqueId(playerName: string,  persistentId?: string, language: string = 'en') {
    try {
      const guessMateRoomId = await this.generateUniqueRoomId();
      
      const seatReservation = await matchMaker.create('guessMate', {
        guessMateRoomId,
        language,
        playerName,
        persistentId
      });

      return {seatReservation, guessMateRoomId}
    } catch (error) {
      console.error('Error creating room with unique ID:', error);
      throw error;
    }
  }

  /**
   * Joins an existing room by guessMateRoomId
   */
  async joinRoomByCode(guessMateRoomId: string, playerName: string, persistentId?: string,language: string = 'en') {
    try {
      // Find room by guessMateRoomId
      const availableRooms = await matchMaker.query();
        const filteredRooms = availableRooms.filter((room) => 
            room.metadata?.guessMateRoomId === guessMateRoomId && 
            room.name === "guessMate"
        );

      if (filteredRooms.length === 0) {
        throw new Error('Room not found');
      }

      const targetRoom = filteredRooms[0];
      
      // Join the existing room
      const seatReservation = await matchMaker.joinById(targetRoom.roomId, {
        playerName,
        language,
        persistentId
      });

      return seatReservation;
    } catch (error) {
      console.error('Error joining room by code:', error);
      throw error;
    }
  }

  /**
   * Gets all available rooms
   */
  async getAllRooms() {
    try {
      const rooms = await matchMaker.query({ name: 'guessMate' });
      return rooms.map((room: any) => ({
        roomId: room.roomId,
        guessMateRoomId: room.metadata?.guessMateRoomId || 'unknown',
        clients: room.clients,
        maxClients: room.maxClients,
        metadata: room.metadata
      }));
    } catch (error) {
      console.error('Error getting all rooms:', error);
      throw error;
    }
  }
}
