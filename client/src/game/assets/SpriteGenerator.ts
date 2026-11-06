import Phaser from 'phaser';
import { CHARACTER_SKINS } from 'shared';

export class SpriteGenerator {
  public static generateAllTextures(scene: Phaser.Scene): void {
    const tm = scene.textures;

    // 1. Generate Soldier Characters
    CHARACTER_SKINS.forEach(skin => {
      this.generateSoldierTexture(tm, skin.id, skin.primaryColor, skin.accentColor);
    });

    // 2. Generate Weapons
    this.generateWeaponTextures(tm);

    // 3. Generate Projectiles & Effects
    this.generateEffectTextures(tm);

    // 4. Generate Environment Tiles
    this.generateEnvironmentTextures(tm);

    console.log('[SpriteGenerator] All procedural textures successfully baked into Phaser TextureManager.');
  }

  private static generateSoldierTexture(
    tm: Phaser.Textures.TextureManager,
    key: string,
    primaryColor: string,
    accentColor: string
  ): void {
    if (tm.exists(`soldier_${key}`)) return;

    const w = 48;
    const h = 60;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Center coordinates
    const cx = w / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, h - 3, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boots / Legs
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(cx - 9, h - 14, 7, 11);
    ctx.fillRect(cx + 2, h - 14, 7, 11);

    // Tactical Pants
    ctx.fillStyle = accentColor;
    ctx.fillRect(cx - 10, h - 28, 9, 15);
    ctx.fillRect(cx + 1, h - 28, 9, 15);

    // Torso / Combat Vest
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.roundRect(cx - 12, h - 45, 24, 18, 4);
    ctx.fill();

    // Body Armor Plating / Straps
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 8, h - 42, 16, 5);
    ctx.fillRect(cx - 9, h - 35, 18, 4);

    // Head / Face
    ctx.fillStyle = '#ffcc80'; // skin tone base
    ctx.beginPath();
    ctx.arc(cx, h - 48, 9, 0, Math.PI * 2);
    ctx.fill();

    // Soldier Headgear per skin
    if (key === 'ranger') {
      // Green Tactical Beret & Radio Headset
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(cx + 2, h - 55, 11, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Eyes / Glasses
      ctx.fillStyle = '#111';
      ctx.fillRect(cx + 1, h - 49, 4, 3);
    } else if (key === 'commando') {
      // Gas Mask / Tactical Visor
      ctx.fillStyle = '#212121';
      ctx.fillRect(cx - 6, h - 52, 14, 11);
      // Red twin filter lenses
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(cx + 1, h - 50, 4, 3);
      ctx.fillRect(cx + 6, h - 50, 3, 3);
    } else if (key === 'desert_recon') {
      // Desert Cap & Aviator Goggles
      ctx.fillStyle = accentColor;
      ctx.fillRect(cx - 8, h - 56, 17, 5);
      // Amber Goggles
      ctx.fillStyle = '#ffab00';
      ctx.fillRect(cx, h - 51, 8, 4);
    } else if (key === 'arctic_sniper') {
      // White Snow Parka Hood
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.arc(cx, h - 51, 11, Math.PI, 0);
      ctx.fill();
      // Ice Blue Goggles
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(cx + 1, h - 49, 6, 3);
    } else if (key === 'cyber_merc') {
      // Futuristic Helmet & Cyan Visor
      ctx.fillStyle = '#1a237e';
      ctx.beginPath();
      ctx.arc(cx, h - 50, 10, 0, Math.PI * 2);
      ctx.fill();
      // Cyan Visor Glow
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 4;
      ctx.fillRect(cx - 1, h - 51, 9, 4);
      ctx.shadowBlur = 0;
    }

    // Hands / Weapon hold socket
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(cx + 12, h - 34, 4, 0, Math.PI * 2);
    ctx.fill();

    tm.addCanvas(`soldier_${key}`, canvas);
  }

  private static generateWeaponTextures(tm: Phaser.Textures.TextureManager): void {
    // 1. Pistol (28x16)
    if (!tm.exists('weapon_pistol')) {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 18;
      const ctx = c.getContext('2d')!;
      // Slide
      ctx.fillStyle = '#37474f';
      ctx.fillRect(8, 2, 18, 7);
      // Barrel tip
      ctx.fillStyle = '#263238';
      ctx.fillRect(26, 4, 4, 4);
      // Grip
      ctx.fillStyle = '#212121';
      ctx.fillRect(8, 9, 6, 8);
      // Trigger guard
      ctx.strokeStyle = '#607d8b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, 9, 5, 4);
      tm.addCanvas('weapon_pistol', c);
    }

    // 2. Assault Rifle M4 (48x20)
    if (!tm.exists('weapon_assault_rifle')) {
      const c = document.createElement('canvas');
      c.width = 50;
      c.height = 22;
      const ctx = c.getContext('2d')!;
      // Stock
      ctx.fillStyle = '#212121';
      ctx.fillRect(2, 6, 10, 7);
      // Receiver
      ctx.fillStyle = '#37474f';
      ctx.fillRect(12, 5, 18, 9);
      // Curved Magazine
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath();
      ctx.moveTo(18, 14);
      ctx.lineTo(24, 21);
      ctx.lineTo(28, 20);
      ctx.lineTo(23, 14);
      ctx.fill();
      // Handguard & Barrel
      ctx.fillStyle = '#455a64';
      ctx.fillRect(30, 7, 14, 5);
      // Flash Hider
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(44, 8, 4, 3);
      // Carry handle / Scope rail
      ctx.fillStyle = '#263238';
      ctx.fillRect(15, 2, 12, 3);
      tm.addCanvas('weapon_assault_rifle', c);
    }

    // 3. Combat Shotgun (46x18)
    if (!tm.exists('weapon_shotgun')) {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 20;
      const ctx = c.getContext('2d')!;
      // Wooden/Polymer Stock
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(2, 5, 12, 7);
      // Receiver
      ctx.fillStyle = '#263238';
      ctx.fillRect(14, 5, 14, 8);
      // Long Twin Barrels
      ctx.fillStyle = '#37474f';
      ctx.fillRect(28, 5, 18, 5);
      // Pump Slide
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(24, 10, 10, 5);
      tm.addCanvas('weapon_shotgun', c);
    }

    // 4. AWP Sniper Rifle (60x20)
    if (!tm.exists('weapon_sniper_rifle')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 22;
      const ctx = c.getContext('2d')!;
      // Olive Drab Sniper Stock
      ctx.fillStyle = '#33691e';
      ctx.fillRect(2, 7, 16, 7);
      // Receiver & Bolt Action
      ctx.fillStyle = '#263238';
      ctx.fillRect(18, 6, 16, 8);
      // Scope Mount & Large Telescopic Scope
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(15, 1, 22, 5);
      ctx.fillStyle = '#00e5ff'; // scope lens gleam
      ctx.fillRect(35, 2, 2, 3);
      // Long Heavy Barrel
      ctx.fillStyle = '#37474f';
      ctx.fillRect(34, 8, 24, 4);
      // Muzzle Brake
      ctx.fillStyle = '#212121';
      ctx.fillRect(58, 7, 5, 6);
      tm.addCanvas('weapon_sniper_rifle', c);
    }

    // 5. Grenade Launcher (46x24)
    if (!tm.exists('weapon_grenade_launcher')) {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 26;
      const ctx = c.getContext('2d')!;
      // Heavy Stock
      ctx.fillStyle = '#212121';
      ctx.fillRect(2, 8, 10, 8);
      // Revolving Drum Magazine
      ctx.fillStyle = '#455a64';
      ctx.beginPath();
      ctx.arc(20, 13, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb300'; // brass cartridge indicators
      ctx.fillRect(18, 9, 4, 3);
      ctx.fillRect(18, 15, 4, 3);
      // Wide Bore Barrel
      ctx.fillStyle = '#37474f';
      ctx.fillRect(28, 8, 16, 10);
      // Flared Muzzle
      ctx.fillStyle = '#263238';
      ctx.fillRect(44, 7, 4, 12);
      tm.addCanvas('weapon_grenade_launcher', c);
    }
  }

  private static generateEffectTextures(tm: Phaser.Textures.TextureManager): void {
    // Muzzle Flash (28x28)
    if (!tm.exists('muzzle_flash')) {
      const c = document.createElement('canvas');
      c.width = 28;
      c.height = 28;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(14, 14, 2, 14, 14, 13);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#ffeb3b');
      grad.addColorStop(0.7, '#ff5722');
      grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(14, 14, 13, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('muzzle_flash', c);
    }

    // Bullet Tracer (16x6)
    if (!tm.exists('bullet_tracer')) {
      const c = document.createElement('canvas');
      c.width = 18;
      c.height = 6;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 18, 0);
      grad.addColorStop(0, 'rgba(255, 235, 59, 0)');
      grad.addColorStop(0.4, '#ffeb3b');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 1, 18, 4);
      tm.addCanvas('bullet_tracer', c);
    }

    // Grenade Shell (14x10)
    if (!tm.exists('grenade_shell')) {
      const c = document.createElement('canvas');
      c.width = 14;
      c.height = 10;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#2e7d32'; // army olive green
      ctx.beginPath();
      ctx.roundRect(1, 1, 12, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#ffd54f'; // brass rim
      ctx.fillRect(3, 1, 3, 8);
      tm.addCanvas('grenade_shell', c);
    }

    // Explosion Shockwave (140x140)
    if (!tm.exists('explosion_shockwave')) {
      const c = document.createElement('canvas');
      c.width = 140;
      c.height = 140;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(70, 70, 8, 70, 70, 68);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#fff176');
      grad.addColorStop(0.5, '#ff7043');
      grad.addColorStop(0.8, '#d84315');
      grad.addColorStop(1, 'rgba(216, 67, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(70, 70, 68, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('explosion_shockwave', c);
    }

    // Spark Particle (6x6)
    if (!tm.exists('spark_particle')) {
      const c = document.createElement('canvas');
      c.width = 6;
      c.height = 6;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffca28';
      ctx.beginPath();
      ctx.arc(3, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('spark_particle', c);
    }

    // Blood Particle (6x6)
    if (!tm.exists('blood_particle')) {
      const c = document.createElement('canvas');
      c.width = 6;
      c.height = 6;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#c62828';
      ctx.beginPath();
      ctx.arc(3, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('blood_particle', c);
    }

    // Spent Brass Shell Casing (8x4)
    if (!tm.exists('casing_brass')) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 4;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(0, 0, 7, 4);
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(6, 0, 2, 4);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(0, 1, 2, 2);
      tm.addCanvas('casing_brass', c);
    }

    // Dynamic Muzzle Light Glow (128x128)
    if (!tm.exists('muzzle_light')) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255, 245, 157, 0.9)');
      grad.addColorStop(0.25, 'rgba(255, 179, 0, 0.45)');
      grad.addColorStop(0.65, 'rgba(255, 109, 0, 0.15)');
      grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('muzzle_light', c);
    }

    // Gun Smoke & Jetpack Smoke (16x16)
    if (!tm.exists('smoke_puff')) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(8, 8, 2, 8, 8, 8);
      grad.addColorStop(0, 'rgba(224, 224, 224, 0.7)');
      grad.addColorStop(0.5, 'rgba(189, 189, 189, 0.35)');
      grad.addColorStop(1, 'rgba(158, 158, 158, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(8, 8, 8, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('smoke_puff', c);
    }

    // Jetpack Thruster Flame (12x20)
    if (!tm.exists('thruster_flame')) {
      const c = document.createElement('canvas');
      c.width = 12;
      c.height = 20;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 20);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#00e5ff');
      grad.addColorStop(0.7, '#0288d1');
      grad.addColorStop(1, 'rgba(2, 136, 209, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(11, 0);
      ctx.lineTo(6, 20);
      ctx.closePath();
      ctx.fill();
      tm.addCanvas('thruster_flame', c);
    }

    // Footstep Dust (8x8)
    if (!tm.exists('footstep_dust')) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = 'rgba(161, 136, 127, 0.6)';
      ctx.beginPath();
      ctx.arc(4, 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      tm.addCanvas('footstep_dust', c);
    }
  }

  private static generateEnvironmentTextures(tm: Phaser.Textures.TextureManager): void {
    // Grass/Dirt Ground Tile (64x64)
    if (!tm.exists('tile_grass')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      // Dirt body
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(4, 20, 16, 8);
      ctx.fillRect(36, 40, 20, 10);
      // Lush grass surface
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(0, 0, 64, 16);
      ctx.fillStyle = '#388e3c';
      for (let i = 0; i < 64; i += 8) {
        ctx.fillRect(i, 12, 5, 6);
      }
      tm.addCanvas('tile_grass', c);
    }

    // Metal Bunker Tile (64x64)
    if (!tm.exists('tile_bunker')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#37474f';
      ctx.fillRect(0, 0, 64, 64);
      // Plate borders
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
      // Rivets
      ctx.fillStyle = '#90a4ae';
      [[6, 6], [58, 6], [6, 58], [58, 58]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      // Hazard diagonal stripe at bottom
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(10, 48, 44, 4);
      tm.addCanvas('tile_bunker', c);
    }

    // Suspension Bridge Plank (64x30)
    if (!tm.exists('tile_bridge')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 30;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(0, 0, 64, 30);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(20, 0, 3, 30);
      ctx.fillRect(42, 0, 3, 30);
      // Steel suspension cable
      ctx.fillStyle = '#78909c';
      ctx.fillRect(0, 2, 64, 3);
      tm.addCanvas('tile_bridge', c);
    }

    // Wooden Watchtower Platform (64x30)
    if (!tm.exists('tile_platform')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 30;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(0, 0, 64, 18);
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(0, 0, 64, 5);
      // Under-beam brackets
      ctx.fillStyle = '#2e1c14';
      ctx.fillRect(8, 18, 10, 12);
      ctx.fillRect(46, 18, 10, 12);
      tm.addCanvas('tile_platform', c);
    }
  }
}

