// Shared Constants and Data Models

export enum WeaponType {
  PISTOL = 'pistol',
  ASSAULT_RIFLE = 'assault_rifle',
  SHOTGUN = 'shotgun',
  SNIPER_RIFLE = 'sniper_rifle',
  GRENADE_LAUNCHER = 'grenade_launcher'
}

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  damage: number;
  fireRateMs: number; // minimum time between shots in ms
  magazineSize: number;
  reloadTimeMs: number;
  bulletSpeed: number;
  bulletLifetimeMs: number;
  bulletCount: number; // 1 for bullet, 6 for shotgun
  spreadAngle: number; // in radians
  recoil: number;
  range: number;
  isExplosive?: boolean;
  explosionRadius?: number;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  [WeaponType.PISTOL]: {
    id: WeaponType.PISTOL,
    name: 'Tactical Pistol',
    damage: 22,
    fireRateMs: 250,
    magazineSize: 12,
    reloadTimeMs: 1200,
    bulletSpeed: 950,
    bulletLifetimeMs: 1500,
    bulletCount: 1,
    spreadAngle: 0.04,
    recoil: 3,
    range: 800
  },
  [WeaponType.ASSAULT_RIFLE]: {
    id: WeaponType.ASSAULT_RIFLE,
    name: 'M4 Carbine',
    damage: 18,
    fireRateMs: 120,
    magazineSize: 30,
    reloadTimeMs: 1800,
    bulletSpeed: 1100,
    bulletLifetimeMs: 1800,
    bulletCount: 1,
    spreadAngle: 0.08,
    recoil: 5,
    range: 1100
  },
  [WeaponType.SHOTGUN]: {
    id: WeaponType.SHOTGUN,
    name: 'Combat Shotgun',
    damage: 15, // per pellet x 6 = 90 max close range
    fireRateMs: 650,
    magazineSize: 6,
    reloadTimeMs: 2200,
    bulletSpeed: 850,
    bulletLifetimeMs: 900,
    bulletCount: 6,
    spreadAngle: 0.28,
    recoil: 12,
    range: 650
  },
  [WeaponType.SNIPER_RIFLE]: {
    id: WeaponType.SNIPER_RIFLE,
    name: 'AWP Sniper',
    damage: 85,
    fireRateMs: 1100,
    magazineSize: 5,
    reloadTimeMs: 2500,
    bulletSpeed: 1600,
    bulletLifetimeMs: 2500,
    bulletCount: 1,
    spreadAngle: 0.01,
    recoil: 16,
    range: 1800
  },
  [WeaponType.GRENADE_LAUNCHER]: {
    id: WeaponType.GRENADE_LAUNCHER,
    name: 'Grenade Launcher',
    damage: 75,
    fireRateMs: 950,
    magazineSize: 4,
    reloadTimeMs: 2600,
    bulletSpeed: 600,
    bulletLifetimeMs: 2000,
    bulletCount: 1,
    spreadAngle: 0.06,
    recoil: 14,
    range: 900,
    isExplosive: true,
    explosionRadius: 130
  }
};

export enum GameMode {
  FREE_ROAM = 'free_roam',
  DEATHMATCH = 'deathmatch',
  TEAM_DEATHMATCH = 'team_deathmatch',
  PRIVATE_MATCH = 'private_match'
}

export interface CharacterSkin {
  id: string;
  name: string;
  role: string;
  description: string;
  primaryColor: string;
  accentColor: string;
}

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'ranger',
    name: 'Forest Ranger',
    role: 'Assault Specialist',
    description: 'Special forces ranger equipped for woodland and jungle warfare.',
    primaryColor: '#2e7d32', // forest green
    accentColor: '#1b5e20'
  },
  {
    id: 'commando',
    name: 'Spec-Ops Commando',
    role: 'Urban Infiltration',
    description: 'Black-ops veteran with tactical visor and heavy combat suit.',
    primaryColor: '#37474f', // slate dark grey
    accentColor: '#212121'
  },
  {
    id: 'desert_recon',
    name: 'Desert Recon',
    role: 'Scout & Marksman',
    description: 'Arid climate specialist trained in high-mobility reconnaissance.',
    primaryColor: '#d7ccc8', // tan khaki
    accentColor: '#8d6e63'
  },
  {
    id: 'arctic_sniper',
    name: 'Arctic Hunter',
    role: 'Long Range Precision',
    description: 'Sub-zero sniper cloaked in snow-white ghillie insulation.',
    primaryColor: '#eceff1', // arctic white/grey
    accentColor: '#90a4ae'
  },
  {
    id: 'cyber_merc',
    name: 'Cyber Mercenary',
    role: 'Heavy Vanguard',
    description: 'Heavily armored contractor outfitted with cybernetic HUD.',
    primaryColor: '#1a237e', // deep navy
    accentColor: '#00e5ff' // cyan glow
  }
];

// World Geometry and Map Definition for "Forest Island"
export interface RectObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ground' | 'platform' | 'bridge' | 'building' | 'tunnel' | 'water';
  color?: string;
}

export interface SpawnPoint {
  x: number;
  y: number;
  team?: 'red' | 'blue' | 'neutral';
}

export const FOREST_ISLAND_MAP = {
  id: 'forest_island',
  name: 'Forest Island',
  width: 3200,
  height: 1400,
  gravity: 980,
  spawnPoints: [
    { x: 300, y: 1000, team: 'red' },
    { x: 600, y: 850, team: 'red' },
    { x: 1200, y: 650, team: 'neutral' },
    { x: 1600, y: 550, team: 'neutral' },
    { x: 2100, y: 850, team: 'blue' },
    { x: 2850, y: 1000, team: 'blue' },
    { x: 1400, y: 1200, team: 'neutral' }
  ] as SpawnPoint[],
  // Solid collision obstacles
  obstacles: [
    // Bottom Bedrock Ground across whole map
    { x: 0, y: 1280, width: 3200, height: 120, type: 'ground' },

    // Left Shore & Forest Hills
    { x: 0, y: 1080, width: 750, height: 200, type: 'ground' },
    { x: 150, y: 920, width: 320, height: 40, type: 'platform' },
    { x: 450, y: 780, width: 280, height: 40, type: 'platform' },

    // Left Watchtower & Camp
    { x: 80, y: 720, width: 140, height: 20, type: 'building' },
    { x: 140, y: 740, width: 20, height: 180, type: 'building' }, // tower pillar
    { x: 50, y: 540, width: 200, height: 20, type: 'building' }, // tower top

    // Central Bunker / Hill Fortress
    { x: 950, y: 1050, width: 1300, height: 230, type: 'tunnel' }, // tunnel ground
    { x: 1050, y: 750, width: 1100, height: 50, type: 'ground' }, // bunker roof / central hill ground
    { x: 1050, y: 800, width: 60, height: 250, type: 'building' }, // bunker left wall
    { x: 2090, y: 800, width: 60, height: 250, type: 'building' }, // bunker right wall
    // Bunker interior platforms
    { x: 1250, y: 950, width: 250, height: 25, type: 'platform' },
    { x: 1650, y: 950, width: 250, height: 25, type: 'platform' },

    // Central Suspension Bridge across canyon/river
    { x: 1250, y: 580, width: 700, height: 30, type: 'bridge' },
    { x: 1220, y: 480, width: 30, height: 100, type: 'building' }, // bridge left tower
    { x: 1950, y: 480, width: 30, height: 100, type: 'building' }, // bridge right tower

    // Central High Overlook
    { x: 1480, y: 420, width: 240, height: 25, type: 'platform' },

    // Right Forest Outpost & Hill
    { x: 2450, y: 1080, width: 750, height: 200, type: 'ground' },
    { x: 2480, y: 780, width: 280, height: 40, type: 'platform' },
    { x: 2750, y: 920, width: 320, height: 40, type: 'platform' },

    // Right Watchtower
    { x: 2980, y: 720, width: 140, height: 20, type: 'building' },
    { x: 3040, y: 740, width: 20, height: 180, type: 'building' },
    { x: 2950, y: 540, width: 200, height: 20, type: 'building' }
  ] as RectObstacle[]
};

// Network Protocol Constants
export const NETWORK_EVENTS = {
  PLAYER_INPUT: 'player_input',
  PLAYER_FIRE: 'player_fire',
  PLAYER_RELOAD: 'player_reload',
  PLAYER_SWITCH_WEAPON: 'player_switch_weapon',
  CHAT_MESSAGE: 'chat_message',
  PING: 'ping',
  PONG: 'pong'
} as const;

export interface PlayerInputPayload {
  left: boolean;
  right: boolean;
  jump: boolean;
  aimAngle: number; // in radians
  clientTick: number;
}

export interface PlayerFirePayload {
  aimAngle: number;
  originX: number;
  originY: number;
}

