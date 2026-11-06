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
  thrusterSprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  healthBarBg: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  targetX: number;
  targetY: number;
  targetAngle: number;
  walkCycle: number;
  lastDustTime: number;
  lastSmokeTime: number;
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
  private dustParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Desktop Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private key4!: Phaser.Input.Keyboard.Key;
  private key5!: Phaser.Input.Keyboard.Key;

  // Direct Native Keyboard State (immune to browser focus & layout issues)
  private activeKeys = new Set<string>();
  private boundKeyDownHandler?: (e: KeyboardEvent) => void;
  private boundKeyUpHandler?: (e: KeyboardEvent) => void;
  private boundBlurHandler?: () => void;

  // Mouse & Shooting state
  private isPointerShooting: boolean = false;
  private lastShotTime: number = 0;
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

    // Prevent default context menu on right click so right click shoots cleanly!
    this.input.mouse?.disableContextMenu();
    window.addEventListener('contextmenu', (e) => e.preventDefault());

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

    // Footstep dust particles
    this.dustParticles = this.add.particles(0, 0, 'footstep_dust', {
      speed: { min: 10, max: 35 },
      angle: { min: 180, max: 360 },
      scale: { start: 1.0, end: 0.1 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      emitting: false
    });
    this.dustParticles.setDepth(12);

    // Smoke particles for barrel and jetpack
    this.smokeParticles = this.add.particles(0, 0, 'smoke_puff', {
      speed: { min: 15, max: 40 },
      scale: { start: 0.8, end: 1.8 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      emitting: false
    });
    this.smokeParticles.setDepth(22);
  }

  private setupInputs(): void {
    // 1. Ensure canvas is focusable and focused
    window.focus();
    if (this.game.canvas) {
      this.game.canvas.setAttribute('tabindex', '0');
      this.game.canvas.style.outline = 'none';
      this.game.canvas.focus();
    }

    // 2. Setup Phaser's internal keyboard plugin if available
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

      this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
      this.key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
      this.key5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);

      this.keyR.on('down', () => this.handleReload());
      this.keyQ.on('down', () => this.cycleWeapon(-1));
      this.keyE.on('down', () => this.cycleWeapon(1));
      this.key1.on('down', () => this.selectWeapon(WeaponType.PISTOL));
      this.key2.on('down', () => this.selectWeapon(WeaponType.ASSAULT_RIFLE));
      this.key3.on('down', () => this.selectWeapon(WeaponType.SHOTGUN));
      this.key4.on('down', () => this.selectWeapon(WeaponType.SNIPER_RIFLE));
      this.key5.on('down', () => this.selectWeapon(WeaponType.GRENADE_LAUNCHER));
    }

    // 3. Direct Native Window Keyboard Listeners (100% immune to Phaser focus quirks)
    this.boundKeyDownHandler = (e: KeyboardEvent) => {
      // Don't hijack keys when user is intentionally typing inside an input element
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      this.activeKeys.add(e.code);
      this.activeKeys.add(e.key.toLowerCase());

      // Direct hotkey responses
      if (e.code === 'KeyR' || e.key.toLowerCase() === 'r') {
        this.handleReload();
      } else if (e.code === 'KeyQ' || e.key.toLowerCase() === 'q') {
        this.cycleWeapon(-1);
      } else if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') {
        this.cycleWeapon(1);
      } else if (e.code === 'Digit1' || e.key === '1' || e.code === 'Numpad1') {
        this.selectWeapon(WeaponType.PISTOL);
      } else if (e.code === 'Digit2' || e.key === '2' || e.code === 'Numpad2') {
        this.selectWeapon(WeaponType.ASSAULT_RIFLE);
      } else if (e.code === 'Digit3' || e.key === '3' || e.code === 'Numpad3') {
        this.selectWeapon(WeaponType.SHOTGUN);
      } else if (e.code === 'Digit4' || e.key === '4' || e.code === 'Numpad4') {
        this.selectWeapon(WeaponType.SNIPER_RIFLE);
      } else if (e.code === 'Digit5' || e.key === '5' || e.code === 'Numpad5') {
        this.selectWeapon(WeaponType.GRENADE_LAUNCHER);
      }
    };

    this.boundKeyUpHandler = (e: KeyboardEvent) => {
      this.activeKeys.delete(e.code);
      this.activeKeys.delete(e.key.toLowerCase());
    };

    this.boundBlurHandler = () => {
      this.activeKeys.clear();
    };

    window.addEventListener('keydown', this.boundKeyDownHandler);
    window.addEventListener('keyup', this.boundKeyUpHandler);
    window.addEventListener('blur', this.boundBlurHandler);

    this.events.once('shutdown', () => {
      if (this.boundKeyDownHandler) window.removeEventListener('keydown', this.boundKeyDownHandler);
      if (this.boundKeyUpHandler) window.removeEventListener('keyup', this.boundKeyUpHandler);
      if (this.boundBlurHandler) window.removeEventListener('blur', this.boundBlurHandler);
    });

    // 4. Mouse Listeners: Both Left Click AND Right Click trigger shooting + regain focus!
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      window.focus();
      if (this.game.canvas) {
        this.game.canvas.focus();
      }
      // If any form field other than chat is focused, blur it to return keyboard control to game
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.id !== 'chat-input' && activeEl.blur) {
        activeEl.blur();
      }

      if (pointer.leftButtonDown() || pointer.rightButtonDown() || pointer.isDown) {
        this.isPointerShooting = true;
        this.tryFireWeapon(this.time.now);
      }
    });

    this.input.on('pointerup', () => {
      const p = this.input.activePointer;
      if (!p.leftButtonDown() && !p.rightButtonDown() && !p.isDown) {
        this.isPointerShooting = false;
      }
    });
  }

  private safeSend(type: string, message: any): void {
    if (!this.room) return;
    try {
      const ws = (this.room as any).connection?.transport?.ws;
      if (ws && ws.readyState !== WebSocket.OPEN) return;
      this.room.send(type, message);
    } catch {
      // Ignored if disconnecting
    }
  }

  private handleReload(): void {
    if (this.room) {
      this.safeSend(NETWORK_EVENTS.PLAYER_RELOAD, {});
      sound.playReload();
    }
  }

  private tryFireWeapon(time: number): void {
    if (!this.room || !this.localPlayerVisual) return;
    const localState = this.room.state.players.get(this.localSessionId);
    if (!localState || localState.isDead || localState.isReloading || localState.ammo <= 0) return;

    const config = WEAPON_CONFIGS[localState.currentWeapon as WeaponType] || WEAPON_CONFIGS[WeaponType.PISTOL];
    if (time - this.lastShotTime < config.fireRateMs) return;

    this.lastShotTime = time;
    this.fireCurrentWeapon();
  }

  private fireCurrentWeapon(): void {
    if (!this.room || !this.localPlayerVisual) return;
    const worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
    const angle = this.touchControls?.state.isShooting && this.touchControls?.state.aimAngle !== 0
      ? this.touchControls.state.aimAngle
      : Math.atan2(
          worldPoint.y - this.localPlayerVisual.container.y,
          worldPoint.x - this.localPlayerVisual.container.x
        );

    this.safeSend(NETWORK_EVENTS.PLAYER_FIRE, { aimAngle: angle });
  }

  private selectWeapon(weapon: WeaponType): void {
    if (!this.room) return;
    const localState = this.room.state.players.get(this.localSessionId);
    if (localState && localState.currentWeapon !== weapon) {
      this.safeSend(NETWORK_EVENTS.PLAYER_SWITCH_WEAPON, { weapon });
      sound.playReload();
    }
  }

  private cycleWeapon(direction: number = 1): void {
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
    const nextIdx = (currentIdx + direction + weapons.length) % weapons.length;
    const nextWeapon = weapons[nextIdx];

    this.safeSend(NETWORK_EVENTS.PLAYER_SWITCH_WEAPON, { weapon: nextWeapon });
    sound.playReload();
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    // Synchronize Players: Process existing players already in state + dynamically added players
    this.room.state.players.forEach((player: any, sessionId: string) => {
      this.createPlayerVisual(player, sessionId);
    });

    this.room.state.players.onAdd((player: any, sessionId: string) => {
      if (sessionId === this.localSessionId && this.localPlayerVisual) return;
      if (this.remotePlayers.has(sessionId)) return;
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
    this.room.state.bullets.forEach((bullet: any, id: string) => {
      if (!this.bulletSprites.has(id)) {
        const texture = bullet.isExplosive ? 'grenade_shell' : 'bullet_tracer';
        const sprite = this.add.sprite(bullet.x, bullet.y, texture);
        sprite.setDepth(20);
        sprite.setRotation(Math.atan2(bullet.vy, bullet.vx));
        this.bulletSprites.set(id, sprite);
      }
    });

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

    // Handle pong responses from server to calculate round-trip latency
    this.room.onMessage(NETWORK_EVENTS.PONG, (data: any) => {
      const sentTime = Number(data?.timestamp || 0);
      if (sentTime > 0) {
        const ping = Math.max(1, Date.now() - sentTime);
        const hud = this.scene.get('HUDScene') as HUDScene;
        if (hud) {
          const localState = this.room?.state?.players.get(this.localSessionId);
          hud.updateStats(localState?.kills || 0, localState?.deaths || 0, ping);
        }
      }
    });

    // Handle disconnect gracefully
    this.room.onLeave((code) => {
      console.warn(`[GameScene] Disconnected from room with status: ${code}`);
    });

    // Broadcast Handlers: Realistic Gun recoil, dynamic light halo, muzzle smoke & brass shell ejection!
    this.room.onMessage('player_fired', (data: any) => {
      sound.playGunshot(data.weapon);

      const shooter = data.playerId === this.localSessionId
        ? this.localPlayerVisual
        : this.remotePlayers.get(data.playerId);

      // 1. Realistic Gun Recoil Kick
      if (shooter) {
        const recoilKick = data.weapon === 'sniper_rifle' ? 14 : data.weapon === 'shotgun' ? 12 : 7;
        const rx = -Math.cos(data.angle) * recoilKick;
        const ry = -Math.sin(data.angle) * recoilKick;
        shooter.weaponSprite.setPosition(8 + rx, 4 + ry);
        this.tweens.add({
          targets: shooter.weaponSprite,
          x: 8,
          y: 4,
          duration: 85,
          ease: 'Quad.easeOut'
        });
      }

      // 2. Muzzle Flash Starburst
      const muzzleDist = data.weapon === 'sniper_rifle' ? 44 : 32;
      const muzzleX = data.x + Math.cos(data.angle) * muzzleDist;
      const muzzleY = data.y + Math.sin(data.angle) * muzzleDist;

      const flash = this.add.sprite(muzzleX, muzzleY, 'muzzle_flash');
      flash.setDepth(26);
      flash.setRotation(data.angle);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.5,
        duration: 75,
        onComplete: () => flash.destroy()
      });

      // 3. Dynamic Muzzle Light Glow (Illuminates soldier and surroundings!)
      const light = this.add.sprite(muzzleX, muzzleY, 'muzzle_light');
      light.setDepth(24);
      light.setScale(1.5);
      light.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: light,
        alpha: 0,
        scale: 2.2,
        duration: 90,
        ease: 'Quad.easeOut',
        onComplete: () => light.destroy()
      });

      // 4. Barrel Smoke Puff
      const smoke = this.add.sprite(muzzleX, muzzleY, 'smoke_puff');
      smoke.setDepth(23);
      smoke.setAlpha(0.65);
      this.tweens.add({
        targets: smoke,
        x: muzzleX + Math.cos(data.angle) * 25,
        y: muzzleY + Math.sin(data.angle) * 25 - 12,
        scale: 2.0,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => smoke.destroy()
      });

      // 5. Spent Brass Shell Casing Ejection
      const casing = this.add.sprite(data.x, data.y, 'casing_brass');
      casing.setDepth(22);
      const ejectAngle = data.angle + Math.PI * (Math.random() * 0.4 + 0.6);
      const ejectDist = 70 + Math.random() * 40;
      this.tweens.add({
        targets: casing,
        x: data.x + Math.cos(ejectAngle) * ejectDist,
        y: data.y + Math.sin(ejectAngle) * ejectDist + 28,
        angle: Math.random() * 720 - 360,
        duration: 450,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: casing,
            alpha: 0,
            duration: 600,
            onComplete: () => casing.destroy()
          });
        }
      });

      // 6. Camera Recoil Kick for Local Player
      if (data.playerId === this.localSessionId) {
        const shakeIntensity = data.weapon === 'sniper_rifle' ? 0.007 : data.weapon === 'grenade_launcher' ? 0.008 : data.weapon === 'shotgun' ? 0.005 : 0.002;
        this.cameras.main.shake(90, shakeIntensity);
      }
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
      this.cameras.main.shake(220, 0.009);

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

    // Jetpack Thruster Flame (positioned under boots)
    const thrusterSprite = this.add.sprite(0, 26, 'thruster_flame');
    thrusterSprite.setOrigin(0.5, 0);
    thrusterSprite.setVisible(false);

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

    container.add([thrusterSprite, bodySprite, weaponSprite, nameText, healthBarBg, healthBarFill]);

    const visual: PlayerVisual = {
      container,
      bodySprite,
      weaponSprite,
      thrusterSprite,
      nameText,
      healthBarBg,
      healthBarFill,
      targetX: player.x,
      targetY: player.y,
      targetAngle: player.aimAngle || 0,
      walkCycle: 0,
      lastDustTime: 0,
      lastSmokeTime: 0
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

    // 2. Animate and Update Local Player Visuals (Walking, Jetpack, Aim)
    this.updateLocalVisual(time, delta);

    // 3. Interpolate and Animate Remote Players
    this.updateRemotePlayers(time, delta);

    // 4. Update Active Bullets Positions
    this.updateBullets();

    // 5. Update HUD and MiniMap
    this.updateHUD(time);
  }

  private handleLocalInput(time: number): void {
    if (!this.room || !this.localPlayerVisual) return;

    // Check if player is actively typing inside chat or an input field
    const activeEl = document.activeElement;
    const isTypingInField = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    // Desktop Key checks: supports standard QWERTY, AZERTY, CapsLock, Arrow keys, and Spacebar
    let left = false;
    let right = false;
    let jump = false;

    if (!isTypingInField) {
      left = this.activeKeys.has('KeyA') ||
             this.activeKeys.has('a') ||
             this.activeKeys.has('ArrowLeft') ||
             (this.cursors?.left?.isDown ?? false) ||
             (this.keyA?.isDown ?? false);

      right = this.activeKeys.has('KeyD') ||
              this.activeKeys.has('d') ||
              this.activeKeys.has('ArrowRight') ||
              (this.cursors?.right?.isDown ?? false) ||
              (this.keyD?.isDown ?? false);

      jump = this.activeKeys.has('KeyW') ||
             this.activeKeys.has('w') ||
             this.activeKeys.has('ArrowUp') ||
             this.activeKeys.has('Space') ||
             this.activeKeys.has(' ') ||
             (this.cursors?.up?.isDown ?? false) ||
             (this.cursors?.space?.isDown ?? false) ||
             (this.keyW?.isDown ?? false);
    }

    // Mobile Touch checks
    if (this.touchControls) {
      left = left || this.touchControls.state.left;
      right = right || this.touchControls.state.right;
      jump = jump || this.touchControls.state.jump;

      if (this.touchControls.state.wantsReload) {
        this.touchControls.state.wantsReload = false;
        this.room.send(NETWORK_EVENTS.PLAYER_RELOAD, {});
        sound.playReload();
      }

      if (this.touchControls.state.wantsSwitchWeapon) {
        this.touchControls.state.wantsSwitchWeapon = false;
        this.cycleWeapon(1);
      }
    }

    // Auto-fire while holding mouse button (Left OR Right click) or touch fire
    const isShooting = this.isPointerShooting || this.touchControls?.state.isShooting;
    if (isShooting) {
      this.tryFireWeapon(time);
    }

    // Aim Angle calculation
    let aimAngle = 0;
    if (this.touchControls && this.touchControls.state.isShooting && this.touchControls.state.aimAngle !== 0) {
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
      this.safeSend(NETWORK_EVENTS.PLAYER_INPUT, {
        left: !!left,
        right: !!right,
        jump: !!jump,
        aimAngle
      });
    }

    // Ping server periodically
    if (time - this.lastPingTime >= 2000) {
      this.lastPingTime = time;
      this.safeSend(NETWORK_EVENTS.PING, { timestamp: Date.now() });
    }
  }

  private updateLocalVisual(time: number, delta: number): void {
    if (!this.room || !this.localPlayerVisual) return;
    const serverState = this.room.state.players.get(this.localSessionId);
    if (!serverState) return;

    const vis = this.localPlayerVisual;

    // Smoothly reconcile local position towards authoritative server position
    vis.container.x = Phaser.Math.Linear(vis.container.x, serverState.x, 0.35);
    vis.container.y = Phaser.Math.Linear(vis.container.y, serverState.y, 0.35);

    // Aim rotation
    const worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
    const angle = this.touchControls?.state.isShooting && this.touchControls?.state.aimAngle !== 0
      ? this.touchControls.state.aimAngle
      : Math.atan2(
          worldPoint.y - vis.container.y,
          worldPoint.x - vis.container.x
        );

    vis.weaponSprite.setRotation(angle);

    // Flip sprite when aiming backwards
    const isAimingLeft = Math.abs(angle) > Math.PI / 2;
    vis.bodySprite.setFlipX(isAimingLeft);
    vis.weaponSprite.setFlipY(isAimingLeft);

    // Walking & Running Animation Cycle
    if (serverState.isMoving && !serverState.isDead) {
      vis.walkCycle += delta * 0.016;
      vis.bodySprite.y = Math.sin(vis.walkCycle) * 3;
      vis.bodySprite.setAngle((isAimingLeft ? -6 : 6) * Math.cos(vis.walkCycle));

      // Emit footstep dust when running on ground
      if (!serverState.isJumping && time - vis.lastDustTime > 160) {
        vis.lastDustTime = time;
        this.dustParticles.emitParticleAt(vis.container.x, vis.container.y + 26, 1);
      }
    } else {
      // Idle breathing bob
      vis.bodySprite.y = Math.sin(time * 0.003) * 1.5;
      vis.bodySprite.setAngle(0);
    }

    // Jetpack Thruster Flame & Smoke Animation
    if (serverState.isJumping && !serverState.isDead) {
      vis.thrusterSprite.setVisible(true);
      vis.thrusterSprite.setScale(1 + Math.random() * 0.25, 1 + Math.random() * 0.35);
      if (time - vis.lastSmokeTime > 120) {
        vis.lastSmokeTime = time;
        this.smokeParticles.emitParticleAt(vis.container.x, vis.container.y + 28, 1);
      }
    } else {
      vis.thrusterSprite.setVisible(false);
    }

    // Update weapon texture if changed
    const expectedTex = `weapon_${serverState.currentWeapon}`;
    if (vis.weaponSprite.texture.key !== expectedTex) {
      vis.weaponSprite.setTexture(expectedTex);
    }

    // Update health bar over head
    const healthRatio = Math.max(0, serverState.health / serverState.maxHealth);
    vis.healthBarFill.setScale(healthRatio, 1);

    // Fade when dead
    vis.container.setAlpha(serverState.isDead ? 0.3 : 1);
  }

  private updateRemotePlayers(time: number, delta: number): void {
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

      // Remote walking animation
      if (player.isMoving && !player.isDead) {
        visual.walkCycle += delta * 0.016;
        visual.bodySprite.y = Math.sin(visual.walkCycle) * 3;
        visual.bodySprite.setAngle((isAimingLeft ? -6 : 6) * Math.cos(visual.walkCycle));
      } else {
        visual.bodySprite.y = Math.sin(time * 0.003) * 1.5;
        visual.bodySprite.setAngle(0);
      }

      // Remote jetpack thruster
      if (player.isJumping && !player.isDead) {
        visual.thrusterSprite.setVisible(true);
        visual.thrusterSprite.setScale(1 + Math.random() * 0.25, 1 + Math.random() * 0.35);
      } else {
        visual.thrusterSprite.setVisible(false);
      }

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
