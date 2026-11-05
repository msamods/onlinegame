import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { WeaponType } from 'shared';

export class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('string') userId: string = '';
  @type('string') username: string = '';
  @type('string') character: string = 'ranger';
  @type('string') color: string = '#2e7d32';
  @type('string') team: string = 'none';

  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('number') aimAngle: number = 0;

  @type('number') health: number = 100;
  @type('number') maxHealth: number = 100;
  @type('boolean') isDead: boolean = false;

  @type('number') kills: number = 0;
  @type('number') deaths: number = 0;

  @type('string') currentWeapon: string = WeaponType.PISTOL;
  @type('number') ammo: number = 12;
  @type('boolean') isReloading: boolean = false;

  @type('boolean') facingLeft: boolean = false;
  @type('boolean') isMoving: boolean = false;
  @type('boolean') isJumping: boolean = false;
  @type('number') ping: number = 0;
}

export class BulletState extends Schema {
  @type('string') id: string = '';
  @type('string') ownerId: string = '';
  @type('string') weaponType: string = WeaponType.PISTOL;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('number') damage: number = 20;
  @type('boolean') isExplosive: boolean = false;
  @type('number') radius: number = 100;
  @type('number') createdAt: number = 0;
}

export class ChatMessageState extends Schema {
  @type('string') id: string = '';
  @type('string') senderId: string = '';
  @type('string') senderName: string = '';
  @type('string') text: string = '';
  @type('number') timestamp: number = 0;
  @type('boolean') isSystem: boolean = false;
}

export class GameState extends Schema {
  @type('string') roomCode: string = '';
  @type('string') roomName: string = 'Forest Island Public';
  @type('string') roomType: string = 'deathmatch';
  @type('string') mapName: string = 'Forest Island';
  @type('number') maxPlayers: number = 16;

  @type('number') redScore: number = 0;
  @type('number') blueScore: number = 0;

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: BulletState }) bullets = new MapSchema<BulletState>();
  @type([ChatMessageState]) chatMessages = new ArraySchema<ChatMessageState>();
}

