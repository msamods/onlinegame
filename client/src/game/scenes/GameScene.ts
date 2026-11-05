import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import {
  FOREST_ISLAND_MAP,
  NETWORK_EVENTS,
  WeaponType,
  WEAPON_CONFIGS
} from 'shared';
import { socket } from '../../services/socket';
import { sound } from '../audio/SoundSynth';
import { TouchControls } from '../ui/TouchControls';
import { HUDScene } from './HUDScene';

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  bodySprite: Phaser.GameObjects.Sprite;
  weaponSprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  healthBarBg: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  targetX: number;
  targetY: number;
  targetAngle: number;
}

export class GameScene extends Phaser.Scene {
  private room: Room | null = null;
  private touchControls!: TouchControls;

  // Local Player
  private localSessionId: string = '';
  private localPlayerVisual: PlayerVisual | null = null;
  private remotePlayers = new Map<string, PlayerVisual>();

  // Bullets & Visuals
  private bulletSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private bloodParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Desktop Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;

  // Input timing
  private lastInputSend: number = 0;
  private lastPingTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.room = socket.activeRoom;
    if (!this.room) {
      console.warn('[GameScene] No active room found on create.');
      return;
    }

    this.localSessionId = this.room.sessionId;

    // Start HUD overlay scene
    this.scene.launch('HUDScene');

    // 1. Setup Camera and Map Boundaries
    const mapW = FOREST_ISLAND_MAP.width;
    const mapH = FOREST_ISLAND_MAP.height;
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBackgroundColor('#1e293b');

    // 2. Render Parallax Background & Scenery
    this.renderEnvironment(mapW, mapH);

    // 3. Render Solid Terrain & Obstacles
    this.renderObstacles();

    // 4. Setup Particle Systems
    this.setupParticles();

    // 5. Setup Keyboard & Mouse Input
    this.setupInputs();

    // 6. Setup Mobile Touch Controls
    this.touchControls = new TouchControls();
    const gameContainer = document.getElementById('game-container') || document.body;
    this.touchControls.init(gameContainer);

    // 7. Setup Colyseus Room State Synchronization
    this.setupRoomEvents();

    // Start procedural background ambience
    sound.startAmbientMusic();
  }

  private renderEnvironment(w: number, h: number): void {
    // Sky gradient background
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e3a5f, 0x1e3a5f, 1);
    bgGraphics.fillRect(0, 0, w, h);

    // Distant mountain silhouettes (parallax layer 0.2)
    const mountainGraphics = this.add.graphics();
    mountainGraphics.setScrollFactor(0.2);
    mountainGraphics.fillStyle(0x132338, 0.6);
    mountainGraphics.beginPath();
    mountainGraphics.moveTo(0, h - 300);
    for (let x = 0; x <= w; x += 300) {
      const peakY = h - 600 - (x % 500 === 0 ? 150 : 50);
      mountainGraphics.lineTo(x + 150, peakY);
      mountainGraphics.lineTo(x + 300, h - 300);
    }
    mountainGraphics.lineTo(w, h);
    mountainGraphics.lineTo(0, h);
    mountainGraphics.closePath();
    mountainGraphics.fill();

    // Pine tree silhouettes (parallax layer 0.5)
    const treeGraphics = this.add.graphics();
    treeGraphics.setScrollFactor(0.5);
    treeGraphics.fillStyle(0x0d2818, 0.5);
    for (let x = 50; x < w; x += 180) {
      const treeBase = h - 250;
      treeGraphics.beginPath();
      treeGraphics.moveTo(x, treeBase - 180);
      treeGraphics.lineTo(x - 40, treeBase);
      treeGraphics.lineTo(x + 40, treeBase);
      treeGraphics.closePath();
      treeGraphics.fill();
    }
  }

  private renderObstacles(): void {
    const obstacles = FOREST_ISLAND_MAP.obstacles;

    obstacles.forEach(obs => {
      let textureKey = 'tile_grass';
      if (obs.type === 'bridge') textureKey = 'tile_bridge';
      if (obs.type === 'building' || obs.type === 'tunnel') textureKey = 'tile_bunker';
      if (obs.type === 'platform') textureKey = 'tile_platform';

      // Repeat tile across width and height
      const tileSprite = this.add.tileSprite(
        obs.x + obs.width / 2,
        obs.y + obs.height / 2,
        obs.width,
        obs.height,
        textureKey
      );
      tileSprite.setDepth(5);
    });
  }

  private setupParticles(): void {
    // Blood impact particles
    this.bloodParticles = this.add.particles(0, 0, 'blood_particle', {
      speed: { min: 40, max: 140 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 350,
      gravityY: 400,
      emitting: false
    });
    this.bloodParticles.setDepth(30);

    // Weapon spark particles
    this.sparkParticles = this.add.particles(0, 0, 'spark_particle', {
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      lifespan: 250,
      emitting: false
    });
    this.sparkParticles.setDepth(30);
  }

  private setupInputs(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // Left click to shoot
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.room) {
        this.fireCurrentWeapon();
      }
    });

    // R to reload
    this.keyR.on('down', () => {
      if (this.room) {
        this.room.send(NETWORK_EVENTS.PLAYER_RELOAD, {});
        sound.playReload();
      }
    });

    // Q to switch weapon
    this.keyQ.on('down', () => {
      this.cycleWeapon();
    });
  }

  private fireCurrentWeapon(): void {
    if (!this.room || !this.localPlayerVisual) return;
    const worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
    const angle = Math.atan2(
      worldPoint.y - this.localPlayerVisual.container.y,
      worldPoint.x - this.localPlayerVisual.container.x
    );

    this.room.send(NETWORK_EVENTS.PLAYER_FIRE, { aimAngle: angle });
  }

  private cycleWeapon(): void {
    if (!this.room) return;
    const weapons = [
      WeaponType.PISTOL,
      WeaponType.ASSAULT_RIFLE,
      WeaponType.SHOTGUN,
      WeaponType.SNIPER_RIFLE,
      WeaponType.GRENADE_LAUNCHER
    ];

    const currentLocal = this.room.state.players.get(this.localSessionId);
    if (!currentLocal) return;

    const currentIdx = weapons.indexOf(currentLocal.currentWeapon as WeaponType);
    const nextIdx = (currentIdx + 1) % weapons.length;
    const nextWeapon = weapons[nextIdx];

    this.room.send(NETWORK_EVENTS.PLAYER_SWITCH_WEAPON, { weapon: nextWeapon });
    sound.playReload();
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    // Synchronize Players
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      this.createPlayerVisual(player, sessionId);
    });

    this.room.state.players.onRemove((_player: any, sessionId: string) => {
      const visual = this.remotePlayers.get(sessionId);
      if (visual) {
        visual.container.destroy();
        this.remotePlayers.delete(sessionId);
      }
    });

    // Synchronize Bullets
    this.room.state.bullets.onAdd((bullet: any, id: string) => {
      const texture = bullet.isExplosive ? 'grenade_shell' : 'bullet_tracer';
      const sprite = this.add.sprite(bullet.x, bullet.y, texture);
      sprite.setDepth(20);
      sprite.setRotation(Math.atan2(bullet.vy, bullet.vx));
      this.bulletSprites.set(id, sprite);
    });

    this.room.state.bullets.onRemove((_bullet: any, id: string) => {
      const sprite = this.bulletSprites.get(id);
      if (sprite) {
        sprite.destroy();
        this.bulletSprites.delete(id);
      }
    });

    // Broadcast Handlers
    this.room.onMessage('player_fired', (data: any) => {
      sound.playGunshot(data.weapon);

      // Create Muzzle Flash at barrel
      const flash = this.add.sprite(
        data.x + Math.cos(data.angle) * 32,
        data.y + Math.sin(data.angle) * 32,
        'muzzle_flash'
      );
      flash.setDepth(25);
      flash.setRotation(data.angle);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.4,
        duration: 80,
        onComplete: () => flash.destroy()
      });
    });

    this.room.onMessage('player_hit', (data: any) => {
      sound.playHit();
      const targetVisual = data.victimId === this.localSessionId
        ? this.localPlayerVisual
        : this.remotePlayers.get(data.victimId);

      if (targetVisual) {
        this.bloodParticles.emitParticleAt(targetVisual.container.x, targetVisual.container.y, 8);
        this.sparkParticles.emitParticleAt(targetVisual.container.x, targetVisual.container.y, 4);

        // Flash target red
        this.tweens.add({
          targets: targetVisual.bodySprite,
          alpha: 0.5,
          yoyo: true,
          duration: 60
        });
      }
    });

    this.room.onMessage('bullet_exploded', (data: any) => {
      sound.playExplosion();
      this.cameras.main.shake(200, 0.008);

      const shockwave = this.add.sprite(data.x, data.y, 'explosion_shockwave');
      shockwave.setDepth(26);
      shockwave.setScale(0.2);

      this.tweens.add({
        targets: shockwave,
        scale: (data.radius || 120) / 60,
        alpha: 0,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => shockwave.destroy()
      });

      this.sparkParticles.emitParticleAt(data.x, data.y, 20);
    });

    this.room.onMessage('kill_feed', (data: any) => {
      const hud = this.scene.get('HUDScene') as HUDScene;
      if (hud) {
        hud.addKillFeed(data.killerName, data.victimName, data.weapon);
      }
      if (data.victimId === this.localSessionId) {
        sound.playDeath();
      }
    });

    this.room.onMessage('player_respawned', (data: any) => {
      const visual = data.playerId === this.localSessionId
        ? this.localPlayerVisual
        : this.remotePlayers.get(data.playerId);

      if (visual) {
        visual.container.setPosition(data.x, data.y);
        visual.container.setAlpha(1);

        // Respawn ring effect
        const ring = this.add.circle(data.x, data.y, 10, 0x00e5ff, 0.6);
        ring.setDepth(25);
        this.tweens.add({
          targets: ring,
          radius: 50,
          alpha: 0,
          duration: 500,
          onComplete: () => ring.destroy()
        });
      }
    });
  }

  private createPlayerVisual(player: any, sessionId: string): void {
    const isLocal = sessionId === this.localSessionId;

    const container = this.add.container(player.x, player.y);
    container.setDepth(15);

    // Body Sprite
    const bodySprite = this.add.sprite(0, 0, `soldier_${player.character || 'ranger'}`);
    bodySprite.setOrigin(0.5, 0.5);

    // Weapon Sprite
    const weaponSprite = this.add.sprite(8, 4, `weapon_${player.currentWeapon || 'pistol'}`);
    weaponSprite.setOrigin(0.2, 0.5);

    // Name Tag Text
    const nameText = this.add.text(0, -38, player.username || 'Soldier', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: isLocal ? '#4ade80' : '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);

    // Health Bar
    const healthBarBg = this.add.rectangle(0, -25, 36, 5, 0x1f2937);
    const healthBarFill = this.add.rectangle(-18, -25, 36, 5, isLocal ? 0x22c55e : 0xef4444);
    healthBarFill.setOrigin(0, 0.5);

    container.add([bodySprite, weaponSprite, nameText, healthBarBg, healthBarFill]);

    const visual: PlayerVisual = {
      container,
      bodySprite,
      weaponSprite,
      nameText,
      healthBarBg,
      healthBarFill,
      targetX: player.x,
      targetY: player.y,
      targetAngle: player.aimAngle || 0
    };

    if (isLocal) {
      this.localPlayerVisual = visual;
      this.cameras.main.startFollow(container, true, 0.1, 0.1);
    } else {
      this.remotePlayers.set(sessionId, visual);
    }
  }

  update(time: number, delta: number): void {
    if (!this.room) return;

    // 1. Process and Send Local Player Input
    this.handleLocalInput(time);

    // 2. Interpolate and Update Local Visuals
    this.updateLocalVisual();

    // 3. Interpolate and Update Remote Players
    this.updateRemotePlayers(delta);

    // 4. Update Active Bullets Positions
    this.updateBullets();

    // 5. Update HUD and MiniMap
    this.updateHUD(time);
  }

  private handleLocalInput(time: number): void {
    if (!this.room || !this.localPlayerVisual) return;

    // Desktop Key checks
    let left = this.cursors?.left.isDown || this.keyA?.isDown;
    let right = this.cursors?.right.isDown || this.keyD?.isDown;
    let jump = this.cursors?.up.isDown || this.cursors?.space.isDown || this.keyW?.isDown;

    // Mobile Touch checks
    if (this.touchControls) {
      left = left || this.touchControls.state.left;
      right = right || this.touchControls.state.right;
      jump = jump || this.touchControls.state.jump;

      if (this.touchControls.state.isShooting) {
        this.room.send(NETWORK_EVENTS.PLAYER_FIRE, { aimAngle: this.touchControls.state.aimAngle });
      }

      if (this.touchControls.state.wantsReload) {
        this.touchControls.state.wantsReload = false;
        this.room.send(NETWORK_EVENTS.PLAYER_RELOAD, {});
        sound.playReload();
      }

      if (this.touchControls.state.wantsSwitchWeapon) {
        this.touchControls.state.wantsSwitchWeapon = false;
        this.cycleWeapon();
      }
    }

    // Aim Angle calculation
    let aimAngle = 0;
    if (this.touchControls && this.touchControls.state.aimAngle !== 0) {
      aimAngle = this.touchControls.state.aimAngle;
    } else {
      const worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
      aimAngle = Math.atan2(
        worldPoint.y - this.localPlayerVisual.container.y,
        worldPoint.x - this.localPlayerVisual.container.x
      );
    }

    // Send input packet at ~30 Hz
    if (time - this.lastInputSend >= 33) {
      this.lastInputSend = time;
      this.room.send(NETWORK_EVENTS.PLAYER_INPUT, {
        left: !!left,
        right: !!right,
        jump: !!jump,
        aimAngle
      });
    }

    // Ping server periodically
    if (time - this.lastPingTime >= 2000) {
      this.lastPingTime = time;
      this.room.send(NETWORK_EVENTS.PING, { timestamp: Date.now() });
    }
  }

  private updateLocalVisual(): void {
    if (!this.room || !this.localPlayerVisual) return;
    const serverState = this.room.state.players.get(this.localSessionId);
    if (!serverState) return;

    // Smoothly reconcile local position towards authoritative server position
    this.localPlayerVisual.container.x = Phaser.Math.Linear(
      this.localPlayerVisual.container.x,
      serverState.x,
      0.35
    );
    this.localPlayerVisual.container.y = Phaser.Math.Linear(
      this.localPlayerVisual.container.y,
      serverState.y,
      0.35
    );

    // Aim rotation
    const worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
    const angle = this.touchControls?.state.aimAngle || Math.atan2(
      worldPoint.y - this.localPlayerVisual.container.y,
      worldPoint.x - this.localPlayerVisual.container.x
    );

    this.localPlayerVisual.weaponSprite.setRotation(angle);

    // Flip sprite when aiming backwards
    const isAimingLeft = Math.abs(angle) > Math.PI / 2;
    this.localPlayerVisual.bodySprite.setFlipX(isAimingLeft);
    this.localPlayerVisual.weaponSprite.setFlipY(isAimingLeft);

    // Update weapon texture if changed
    const expectedTex = `weapon_${serverState.currentWeapon}`;
    if (this.localPlayerVisual.weaponSprite.texture.key !== expectedTex) {
      this.localPlayerVisual.weaponSprite.setTexture(expectedTex);
    }

    // Update health bar over head
    const healthRatio = Math.max(0, serverState.health / serverState.maxHealth);
    this.localPlayerVisual.healthBarFill.setScale(healthRatio, 1);

    // Fade when dead
    this.localPlayerVisual.container.setAlpha(serverState.isDead ? 0.3 : 1);
  }

  private updateRemotePlayers(delta: number): void {
    if (!this.room) return;

    this.room.state.players.forEach((player: any, sessionId: string) => {
      if (sessionId === this.localSessionId) return;

      const visual = this.remotePlayers.get(sessionId);
      if (!visual) return;

      // Smooth position interpolation (Lerp)
      visual.container.x = Phaser.Math.Linear(visual.container.x, player.x, 0.25);
      visual.container.y = Phaser.Math.Linear(visual.container.y, player.y, 0.25);

      visual.weaponSprite.setRotation(player.aimAngle || 0);

      const isAimingLeft = Math.abs(player.aimAngle || 0) > Math.PI / 2;
      visual.bodySprite.setFlipX(isAimingLeft);
      visual.weaponSprite.setFlipY(isAimingLeft);

      // Weapon texture
      const expectedTex = `weapon_${player.currentWeapon}`;
      if (visual.weaponSprite.texture.key !== expectedTex) {
        visual.weaponSprite.setTexture(expectedTex);
      }

      // Health
      const healthRatio = Math.max(0, player.health / player.maxHealth);
      visual.healthBarFill.setScale(healthRatio, 1);

      visual.container.setAlpha(player.isDead ? 0.3 : 1);
    });
  }

  private updateBullets(): void {
    if (!this.room) return;

    this.room.state.bullets.forEach((bullet: any, id: string) => {
      const sprite = this.bulletSprites.get(id);
      if (sprite) {
        sprite.setPosition(bullet.x, bullet.y);
      }
    });
  }

  private updateHUD(time: number): void {
    if (!this.room) return;
    const hud = this.scene.get('HUDScene') as HUDScene;
    if (!hud) return;

    const localState = this.room.state.players.get(this.localSessionId);
    if (localState) {
      hud.updateHealth(localState.health, localState.maxHealth);
      hud.updateWeaponAndAmmo(localState.currentWeapon, localState.ammo, localState.isReloading);
      hud.updateStats(localState.kills, localState.deaths, localState.ping || 18);

      // Mini map dots
      const otherPlayers: { x: number; y: number; isDead: boolean }[] = [];
      this.room.state.players.forEach((p: any, sid: string) => {
        if (sid !== this.localSessionId) {
          otherPlayers.push({ x: p.x, y: p.y, isDead: p.isDead });
        }
      });
      hud.updateMiniMap(
        { x: localState.x, y: localState.y },
        otherPlayers,
        FOREST_ISLAND_MAP.width,
        FOREST_ISLAND_MAP.height
      );
    }
  }

  cleanUp(): void {
    if (this.touchControls) {
      this.touchControls.destroy();
    }
  }
}
