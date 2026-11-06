import { Room, Client } from 'colyseus';
import { GameState, PlayerState, BulletState, ChatMessageState } from './schema/GameState.js';
import { PhysicsEngine } from '../systems/PhysicsEngine.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import {
  NETWORK_EVENTS,
  PlayerInputPayload,
  WeaponType,
  FOREST_ISLAND_MAP,
  CHARACTER_SKINS
} from 'shared';
import { verifyToken } from '../auth/jwt.js';

export interface RoomOptions {
  roomName?: string;
  roomType?: string;
  mapName?: string;
  maxPlayers?: number;
  isPrivate?: boolean;
  roomCode?: string;
}

export class GameRoom extends Room<GameState> {
  private physics!: PhysicsEngine;
  private combat!: CombatSystem;
  private playerInputs = new Map<string, { left: boolean; right: boolean; jump: boolean; aimAngle: number }>();

  // Chat anti-spam rate limiter
  private chatCooldowns = new Map<string, number>();

  onCreate(options: RoomOptions) {
    this.setState(new GameState());
    this.physics = new PhysicsEngine();
    this.combat = new CombatSystem();

    this.maxClients = options.maxPlayers || 16;
    this.state.roomName = options.roomName || 'Forest Island Public';
    this.state.roomType = options.roomType || 'deathmatch';
    this.state.mapName = options.mapName || 'Forest Island';
    this.state.maxPlayers = this.maxClients;
    this.state.roomCode = options.roomCode || Math.random().toString(36).substring(2, 8).toUpperCase();

    // Register Network Handlers
    this.onMessage(NETWORK_EVENTS.PLAYER_INPUT, (client, data: PlayerInputPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) return;

      this.playerInputs.set(client.sessionId, {
        left: !!data.left,
        right: !!data.right,
        jump: !!data.jump,
        aimAngle: typeof data.aimAngle === 'number' ? data.aimAngle : 0
      });
      player.aimAngle = data.aimAngle;
    });

    this.onMessage(NETWORK_EVENTS.PLAYER_FIRE, (client, data: { aimAngle?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const now = Date.now();
      if (!this.combat.canFire(player, now)) return;

      const aimAngle = typeof data?.aimAngle === 'number' ? data.aimAngle : player.aimAngle;
      const newBullets = this.combat.fireWeapon(player, aimAngle, now);

      newBullets.forEach(b => {
        this.state.bullets.set(b.id, b);
      });

      // Broadcast fire event with origin and weapon for client sound & muzzle flash
      this.broadcast('player_fired', {
        playerId: player.id,
        weapon: player.currentWeapon,
        x: player.x,
        y: player.y,
        angle: aimAngle
      });
    });

    this.onMessage(NETWORK_EVENTS.PLAYER_RELOAD, client => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.combat.startReload(player);
    });

    this.onMessage(NETWORK_EVENTS.PLAYER_SWITCH_WEAPON, (client, data: { weapon: WeaponType }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.combat.switchWeapon(player, data.weapon);
    });

    this.onMessage(NETWORK_EVENTS.CHAT_MESSAGE, (client, data: { text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !data?.text) return;

      const now = Date.now();
      const lastChat = this.chatCooldowns.get(client.sessionId) || 0;
      if (now - lastChat < 800) {
        // Rate limit: 800ms
        return;
      }
      this.chatCooldowns.set(client.sessionId, now);

      // Sanitize & length limit
      const cleanText = data.text.trim().substring(0, 120);
      if (cleanText.length === 0) return;

      const msg = new ChatMessageState();
      msg.id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      msg.senderId = player.id;
      msg.senderName = player.username;
      msg.text = cleanText;
      msg.timestamp = now;
      msg.isSystem = false;

      this.state.chatMessages.push(msg);
      // Keep chat history bounded
      if (this.state.chatMessages.length > 50) {
        this.state.chatMessages.shift();
      }
    });

    this.onMessage(NETWORK_EVENTS.PING, (client, data: { timestamp: number | bigint }) => {
      try {
        const clientTimestamp = Number(data?.timestamp ?? Date.now());
        client.send(NETWORK_EVENTS.PONG, { timestamp: clientTimestamp });
        const player = this.state.players.get(client.sessionId);
        if (player && clientTimestamp > 0) {
          player.ping = Math.max(0, Date.now() - clientTimestamp);
        }
      } catch (err) {
        console.warn(`[GameRoom ${this.roomId}] Ping error handled:`, err);
      }
    });

    // Start Simulation Tick (30 updates per second) and Network Patch Rate (20 updates/sec)
    this.setPatchRate(50);
    this.setSimulationInterval(dt => this.update(dt / 1000), 1000 / 30);

    console.log(`[GameRoom ${this.roomId}] Created with code ${this.state.roomCode}`);
  }

  // Authorize player or fallback to guest
  onAuth(_client: Client, options: any) {
    if (options?.token) {
      const payload = verifyToken(options.token);
      if (payload) {
        return {
          userId: payload.userId,
          username: payload.username,
          character: options.character || 'ranger',
          color: options.color || '#2e7d32'
        };
      }
    }
    // Guest soldier fallback
    const guestNum = Math.floor(1000 + Math.random() * 9000);
    return {
      userId: `guest_${Date.now()}`,
      username: options.username?.trim() || `Soldier_${guestNum}`,
      character: options.character || 'ranger',
      color: options.color || '#2e7d32'
    };
  }

  onJoin(client: Client, options: any, auth: any) {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.userId = auth.userId;
    player.username = auth.username;
    player.character = auth.character || 'ranger';
    player.color = auth.color || '#2e7d32';

    // Assign team for Team Deathmatch
    if (this.state.roomType === 'team_deathmatch') {
      let redCount = 0;
      let blueCount = 0;
      this.state.players.forEach(p => {
        if (p.team === 'red') redCount++;
        if (p.team === 'blue') blueCount++;
      });
      player.team = redCount <= blueCount ? 'red' : 'blue';
    } else {
      player.team = 'none';
    }

    // Spawn player at map spawn point
    const spawns = FOREST_ISLAND_MAP.spawnPoints;
    const matchingSpawns = spawns.filter(s => player.team === 'none' || s.team === player.team || s.team === 'neutral');
    const selectedSpawn = matchingSpawns.length > 0 
      ? matchingSpawns[Math.floor(Math.random() * matchingSpawns.length)]
      : spawns[0];

    player.x = selectedSpawn.x;
    player.y = selectedSpawn.y;
    player.health = 100;
    player.maxHealth = 100;
    player.currentWeapon = WeaponType.PISTOL;
    player.ammo = 12;

    this.state.players.set(client.sessionId, player);
    this.playerInputs.set(client.sessionId, { left: false, right: false, jump: false, aimAngle: 0 });

    // Broadcast system notification
    this.sendSystemChat(`${player.username} joined the battle.`);
    console.log(`[GameRoom ${this.roomId}] Player joined: ${player.username} (${client.sessionId})`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.sendSystemChat(`${player.username} left the battle.`);
    }

    this.state.players.delete(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.chatCooldowns.delete(client.sessionId);
    this.combat.cleanupPlayer(client.sessionId);

    console.log(`[GameRoom ${this.roomId}] Player left: ${client.sessionId}`);
  }

  onDispose() {
    console.log(`[GameRoom ${this.roomId}] Room disposed.`);
  }

  // Main Server Simulation Loop
  private update(dt: number) {
    const now = Date.now();

    // 1. Update all players physics and movement
    this.state.players.forEach(player => {
      const input = this.playerInputs.get(player.id) || { left: false, right: false, jump: false, aimAngle: 0 };
      this.physics.updatePlayer(player, input, dt);
    });

    // 2. Update all active bullets & handle collisions
    const bulletsToRemove: string[] = [];

    this.state.bullets.forEach(bullet => {
      // Check bullet lifetime (max 3 seconds)
      if (now - bullet.createdAt > 3000) {
        bulletsToRemove.push(bullet.id);
        return;
      }

      // Move bullet and check solid terrain collision
      const hitTerrain = this.physics.updateBullet(bullet, dt);

      if (hitTerrain) {
        bulletsToRemove.push(bullet.id);

        if (bullet.isExplosive) {
          this.handleExplosion(bullet);
        }
        return;
      }

      // Check player hits (if not explosive direct hit)
      if (!bullet.isExplosive) {
        let hitPlayer: PlayerState | null = null;
        this.state.players.forEach(target => {
          if (hitPlayer) return;
          // Friendly fire protection in Team Deathmatch
          if (this.state.roomType === 'team_deathmatch') {
            const shooter = this.state.players.get(bullet.ownerId);
            if (shooter && shooter.team === target.team && shooter.team !== 'none') {
              return;
            }
          }

          if (this.physics.checkBulletPlayerHit(bullet, target)) {
            hitPlayer = target;
          }
        });

        if (hitPlayer) {
          bulletsToRemove.push(bullet.id);
          const shooter = this.state.players.get(bullet.ownerId) || null;
          const killEvent = this.combat.applyDamage(hitPlayer, bullet.damage, shooter, respawned => {
            this.broadcast('player_respawned', { playerId: respawned.id, x: respawned.x, y: respawned.y });
          });

          this.broadcast('player_hit', {
            victimId: (hitPlayer as PlayerState).id,
            shooterId: bullet.ownerId,
            damage: bullet.damage,
            health: (hitPlayer as PlayerState).health
          });

          if (killEvent) {
            this.handleKill(killEvent);
          }
        }
      } else {
        // Explosive direct projectile contact
        let hitDirect = false;
        this.state.players.forEach(target => {
          if (hitDirect || target.id === bullet.ownerId || target.isDead) return;
          if (this.physics.checkBulletPlayerHit(bullet, target)) {
            hitDirect = true;
          }
        });

        if (hitDirect) {
          bulletsToRemove.push(bullet.id);
          this.handleExplosion(bullet);
        }
      }
    });

    bulletsToRemove.forEach(id => {
      this.state.bullets.delete(id);
    });
  }

  private handleExplosion(bullet: BulletState) {
    this.broadcast('bullet_exploded', {
      x: bullet.x,
      y: bullet.y,
      radius: bullet.radius || 120
    });

    const playerMap = new Map<string, PlayerState>();
    this.state.players.forEach(p => playerMap.set(p.id, p));

    const hits = this.physics.checkExplosionHits(bullet, playerMap);
    const shooter = this.state.players.get(bullet.ownerId) || null;

    hits.forEach(({ player, damage }) => {
      if (this.state.roomType === 'team_deathmatch' && shooter && shooter.team === player.team && shooter.team !== 'none') {
        return; // No friendly splash damage
      }

      const killEvent = this.combat.applyDamage(player, damage, shooter, respawned => {
        this.broadcast('player_respawned', { playerId: respawned.id, x: respawned.x, y: respawned.y });
      });

      this.broadcast('player_hit', {
        victimId: player.id,
        shooterId: bullet.ownerId,
        damage,
        health: player.health
      });

      if (killEvent) {
        this.handleKill(killEvent);
      }
    });
  }

  private handleKill(event: any) {
    this.broadcast('kill_feed', event);
    this.sendSystemChat(`${event.killerName} eliminated ${event.victimName} with ${event.weapon}.`);

    // Update team scores
    const killer = this.state.players.get(event.killerId);
    if (killer) {
      if (killer.team === 'red') this.state.redScore += 1;
      if (killer.team === 'blue') this.state.blueScore += 1;
    }
  }

  private sendSystemChat(text: string) {
    const msg = new ChatMessageState();
    msg.id = `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    msg.senderId = 'system';
    msg.senderName = 'COMMAND';
    msg.text = text;
    msg.timestamp = Date.now();
    msg.isSystem = true;

    this.state.chatMessages.push(msg);
    if (this.state.chatMessages.length > 50) {
      this.state.chatMessages.shift();
    }
  }
}
