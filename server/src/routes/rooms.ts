import { Router, Request, Response } from 'express';
import { db } from '../database/index.js';
import { matchMaker } from 'colyseus';
import { authMiddleware, AuthenticatedRequest } from '../auth/jwt.js';

export const roomRouter = Router();

// List public active rooms and server statistics
roomRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const activeRooms = await matchMaker.query({ isPrivate: { $ne: true } });

    // Format room listings with real player counts and metadata
    const rooms = activeRooms.map(r => ({
      roomId: r.roomId,
      roomName: (r.metadata as any)?.roomName || 'Forest Island Public',
      roomType: (r.metadata as any)?.roomType || 'deathmatch',
      mapName: (r.metadata as any)?.mapName || 'Forest Island',
      playersCount: r.clients,
      maxPlayers: r.maxClients || 16,
      roomCode: (r.metadata as any)?.roomCode || '',
      hasPassword: !!(r.metadata as any)?.password
    }));

    res.json(rooms);
  } catch (err: any) {
    console.error('[Rooms] Query error:', err);
    res.status(500).json({ error: 'Failed to retrieve active rooms' });
  }
});

// Create Private Room
roomRouter.post('/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomName, roomType, mapName, maxPlayers, password } = req.body;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const createdBy = req.user!.userId;

    // Persist room record in database
    await db.createGameRoom({
      id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      room_code: roomCode,
      room_name: roomName || `${req.user!.username}'s Tactical Room`,
      room_type: roomType || 'private_match',
      map_name: mapName || 'Forest Island',
      maximum_players: maxPlayers || 12,
      created_by: createdBy
    });

    // Create room reservation in Colyseus
    const room = await matchMaker.createRoom('game_room', {
      roomName: roomName || `${req.user!.username}'s Tactical Room`,
      roomType: roomType || 'private_match',
      mapName: mapName || 'Forest Island',
      maxPlayers: maxPlayers || 12,
      isPrivate: true,
      roomCode,
      password: password ? String(password) : undefined
    });

    res.status(201).json({
      message: 'Private room created successfully',
      roomId: room.roomId,
      roomCode,
      roomName: roomName || `${req.user!.username}'s Tactical Room`
    });
  } catch (err: any) {
    console.error('[Rooms] Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join by Room Code
roomRouter.post('/join-by-code', async (req: Request, res: Response) => {
  try {
    const { roomCode, password } = req.body;
    if (!roomCode) {
      res.status(400).json({ error: 'Room code is required' });
      return;
    }

    const cleanCode = roomCode.trim().toUpperCase();
    const activeRooms = await matchMaker.query({});
    const targetRoom = activeRooms.find(r => (r.metadata as any)?.roomCode === cleanCode);

    if (!targetRoom) {
      res.status(404).json({ error: 'Room not found or no longer active' });
      return;
    }

    const roomMetadata = targetRoom.metadata as any;
    if (roomMetadata?.password && roomMetadata.password !== password) {
      res.status(401).json({ error: 'Incorrect room password' });
      return;
    }

    res.json({
      roomId: targetRoom.roomId,
      roomCode: cleanCode,
      roomName: roomMetadata?.roomName,
      roomType: roomMetadata?.roomType
    });
  } catch (err: any) {
    console.error('[Rooms] Join by code error:', err);
    res.status(500).json({ error: 'Failed to find room with provided code' });
  }
});

