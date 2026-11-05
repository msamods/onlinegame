import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { db } from './database/index.js';
import { GameRoom } from './rooms/GameRoom.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { roomRouter } from './routes/rooms.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/rooms', roomRouter);

// System Health & Diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: {
      connected: db.isConnected,
      engine: 'MariaDB / MySQL',
      url: process.env.DATABASE_URL ? 'configured' : 'missing'
    }
  });
});

// Serve Frontend Web Client Static Files (Built with Vite)
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'client/dist');
const finalDistPath = fs.existsSync(clientDistPath) ? clientDistPath : altClientDistPath;

if (fs.existsSync(finalDistPath)) {
  console.log(`[Server] Serving production web client from: ${finalDistPath}`);
  app.use(express.static(finalDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(finalDistPath, 'index.html'));
  });
}

const server = http.createServer(app);

// Colyseus Game Server Setup
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register Game Rooms
gameServer.define('game_room', GameRoom)
  .enableRealtimeListing();

// Boot application
async function bootstrap() {
  console.log('====================================================');
  console.log('   2D MULTIPLAYER SHOOTER SERVER (MINI MILITIA)     ');
  console.log('====================================================');

  // Attempt MariaDB connection (resilient fallback if offline)
  await db.connect();

  server.listen(PORT, HOST, () => {
    console.log(`[Server] Express API listening on http://${HOST}:${PORT}`);
    console.log(`[Server] Colyseus Game WebSocket active on ws://${HOST}:${PORT}`);
    console.log(`[Server] Ready for client connections.`);
  });
}

bootstrap().catch(err => {
  console.error('[Server Fatal] Bootstrap failure:', err);
  process.exit(1);
});
