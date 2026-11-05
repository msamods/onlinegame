import Phaser from 'phaser';
import { WeaponType, WEAPON_CONFIGS } from 'shared';

export interface KillFeedItem {
  killerName: string;
  victimName: string;
  weapon: string;
  time: number;
}

export class HUDScene extends Phaser.Scene {
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private pingText!: Phaser.GameObjects.Text;
  private reloadBanner!: Phaser.GameObjects.Container;
  private killFeedContainer!: Phaser.GameObjects.Container;
  private miniMapGraphics!: Phaser.GameObjects.Graphics;

  private killFeed: KillFeedItem[] = [];

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // 1. Health Bar & Tactical Badge (Bottom Left)
    const hudBottomLeft = this.add.container(25, height - 75);

    const hudBg = this.add.rectangle(0, 0, 240, 60, 0x111827, 0.85);
    hudBg.setStrokeStyle(2, 0x374151);
    hudBg.setOrigin(0, 0);

    const healthBg = this.add.rectangle(15, 15, 210, 16, 0x1f2937);
    healthBg.setOrigin(0, 0);

    this.healthBarFill = this.add.rectangle(15, 15, 210, 16, 0x22c55e);
    this.healthBarFill.setOrigin(0, 0);

    this.healthText = this.add.text(120, 23, '100 / 100 HP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.weaponText = this.add.text(15, 36, 'TACTICAL PISTOL', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#9ca3af'
    });

    hudBottomLeft.add([hudBg, healthBg, this.healthBarFill, this.healthText, this.weaponText]);

    // 2. Ammo Counter (Bottom Right)
    const hudBottomRight = this.add.container(width - 180, height - 75);
    const ammoBg = this.add.rectangle(0, 0, 155, 60, 0x111827, 0.85);
    ammoBg.setStrokeStyle(2, 0x374151);
    ammoBg.setOrigin(0, 0);

    const ammoLabel = this.add.text(78, 14, 'AMMO', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#6b7280'
    }).setOrigin(0.5);

    this.ammoText = this.add.text(78, 36, '12 / 12', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#fbbf24'
    }).setOrigin(0.5);

    hudBottomRight.add([ammoBg, ammoLabel, this.ammoText]);

    // 3. Stats & Ping (Top Left)
    const hudTopLeft = this.add.container(25, 20);
    const statsBg = this.add.rectangle(0, 0, 190, 48, 0x111827, 0.85);
    statsBg.setStrokeStyle(2, 0x374151);
    statsBg.setOrigin(0, 0);

    this.statsText = this.add.text(12, 10, 'KILLS: 0  |  DEATHS: 0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f3f4f6'
    });

    this.pingText = this.add.text(12, 28, 'PING: -- ms', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      color: '#10b981'
    });

    hudTopLeft.add([statsBg, this.statsText, this.pingText]);

    // 4. Reload Banner (Center screen, hidden initially)
    this.reloadBanner = this.add.container(width / 2, height / 2 + 70);
    const reloadBg = this.add.rectangle(0, 0, 140, 28, 0xd97706, 0.9);
    reloadBg.setStrokeStyle(1, 0xfbbf24);
    const reloadLabel = this.add.text(0, 0, 'RELOADING...', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.reloadBanner.add([reloadBg, reloadLabel]);
    this.reloadBanner.setVisible(false);

    // 5. Kill Feed Container (Top Right)
    this.killFeedContainer = this.add.container(width - 240, 20);

    // 6. Mini Map (Top Center-Left)
    this.miniMapGraphics = this.add.graphics();
    this.miniMapGraphics.setPosition(230, 20);

    // Handle responsive window resize
    this.scale.on('resize', this.handleResize, this);
  }

  public updateHealth(current: number, max: number): void {
    const pct = Math.max(0, Math.min(1, current / max));
    this.healthBarFill.width = 210 * pct;
    this.healthText.setText(`${Math.round(current)} / ${max} HP`);

    if (pct > 0.5) {
      this.healthBarFill.fillColor = 0x22c55e; // green
    } else if (pct > 0.25) {
      this.healthBarFill.fillColor = 0xeab308; // yellow
    } else {
      this.healthBarFill.fillColor = 0xef4444; // red
    }
  }

  public updateWeaponAndAmmo(weapon: string, ammo: number, isReloading: boolean): void {
    const config = WEAPON_CONFIGS[weapon as WeaponType];
    const weaponName = config ? config.name.toUpperCase() : weapon.toUpperCase();
    const maxAmmo = config ? config.magazineSize : 12;

    this.weaponText.setText(weaponName);
    this.ammoText.setText(`${ammo} / ${maxAmmo}`);

    if (ammo <= 2) {
      this.ammoText.setColor('#ef4444');
    } else {
      this.ammoText.setColor('#fbbf24');
    }

    this.reloadBanner.setVisible(isReloading);
  }

  public updateStats(kills: number, deaths: number, ping: number): void {
    this.statsText.setText(`KILLS: ${kills}  |  DEATHS: ${deaths}`);
    this.pingText.setText(`PING: ${ping} ms`);
    if (ping > 120) {
      this.pingText.setColor('#ef4444');
    } else if (ping > 70) {
      this.pingText.setColor('#eab308');
    } else {
      this.pingText.setColor('#10b981');
    }
  }

  public addKillFeed(killer: string, victim: string, weapon: string): void {
    const item: KillFeedItem = {
      killerName: killer,
      victimName: victim,
      weapon: weapon.replace('_', ' ').toUpperCase(),
      time: Date.now()
    };

    this.killFeed.unshift(item);
    if (this.killFeed.length > 5) {
      this.killFeed.pop();
    }
    this.renderKillFeed();
  }

  private renderKillFeed(): void {
    this.killFeedContainer.removeAll(true);
    const now = Date.now();

    this.killFeed.forEach((kf, idx) => {
      const age = now - kf.time;
      if (age > 6000) return;

      const y = idx * 24;
      const bg = this.add.rectangle(0, y, 220, 20, 0x111827, 0.75);
      bg.setStrokeStyle(1, 0x374151);
      bg.setOrigin(0, 0);

      const text = this.add.text(8, y + 3, `${kf.killerName} -> [${kf.weapon}] -> ${kf.victimName}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#f9fafb'
      });

      this.killFeedContainer.add([bg, text]);
    });
  }

  public updateMiniMap(
    localPos: { x: number; y: number },
    otherPlayers: { x: number; y: number; isDead: boolean }[],
    mapW: number,
    mapH: number
  ): void {
    this.miniMapGraphics.clear();

    const mw = 120;
    const mh = 50;

    // Border & background
    this.miniMapGraphics.fillStyle(0x111827, 0.8);
    this.miniMapGraphics.fillRect(0, 0, mw, mh);
    this.miniMapGraphics.lineStyle(1, 0x374151);
    this.miniMapGraphics.strokeRect(0, 0, mw, mh);

    // Other players (red/grey dots)
    otherPlayers.forEach(p => {
      if (p.isDead) return;
      const nx = (p.x / mapW) * mw;
      const ny = (p.y / mapH) * mh;
      this.miniMapGraphics.fillStyle(0xef4444, 1);
      this.miniMapGraphics.fillCircle(nx, ny, 2.5);
    });

    // Local player (bright green dot)
    const lx = (localPos.x / mapW) * mw;
    const ly = (localPos.y / mapH) * mh;
    this.miniMapGraphics.fillStyle(0x10b981, 1);
    this.miniMapGraphics.fillCircle(lx, ly, 3.5);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    // Re-anchor responsive elements
    this.scene.restart();
  }
}

