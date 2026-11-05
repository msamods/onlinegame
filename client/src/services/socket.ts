import { Client, Room } from 'colyseus.js';
import { api } from './api';

export class SocketService {
  private static instance: SocketService;
  public client: Client;
  public activeRoom: Room | null = null;

  private constructor() {
    // Determine server websocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = '3001';
    const endpoint = `${protocol}//${host}:${port}`;
    this.client = new Client(endpoint);
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public async joinPublicRoom(options: {
    character?: string;
    color?: string;
    username?: string;
  }): Promise<Room> {
    if (this.activeRoom) {
      this.leaveRoom();
    }

    const token = api.getToken();
    const joinOptions = {
      token,
      ...options
    };

    this.activeRoom = await this.client.joinOrCreate('game_room', joinOptions);
    return this.activeRoom;
  }

  public async joinRoomById(roomId: string, options: {
    character?: string;
    color?: string;
    username?: string;
    password?: string;
  }): Promise<Room> {
    if (this.activeRoom) {
      this.leaveRoom();
    }

    const token = api.getToken();
    const joinOptions = {
      token,
      ...options
    };

    this.activeRoom = await this.client.joinById(roomId, joinOptions);
    return this.activeRoom;
  }

  public async createCustomRoom(options: {
    roomName: string;
    roomType: string;
    mapName?: string;
    maxPlayers?: number;
    password?: string;
    character?: string;
    color?: string;
    username?: string;
  }): Promise<Room> {
    if (this.activeRoom) {
      this.leaveRoom();
    }

    const token = api.getToken();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const createOptions = {
      token,
      ...options,
      roomCode,
      isPrivate: true
    };

    this.activeRoom = await this.client.create('game_room', createOptions);
    return this.activeRoom;
  }

  public leaveRoom() {
    if (this.activeRoom) {
      this.activeRoom.leave();
      this.activeRoom = null;
    }
  }
}

export const socket = SocketService.getInstance();

