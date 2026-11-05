import { WeaponType, WEAPON_CONFIGS, WeaponConfig, FOREST_ISLAND_MAP } from 'shared';
import { PlayerState, BulletState } from '../rooms/schema/GameState.js';
import { db } from '../database/index.js';

export interface KillFeedEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon: string;
  timestamp: number;
}

export class CombatSystem {
  // Cooldowns and timers tracked on server
  private lastFireTimes = new Map<string, number>();
  private reloadTimeouts = new Map<string, NodeJS.Timeout>();
  private respawnTimeouts = new Map<string, NodeJS.Timeout>();

  public canFire(player: PlayerState, now: number): boolean {
    if (player.isDead || player.isReloading || player.ammo <= 0) {
      return false;
    }

    const config = WEAPON_CONFIGS[player.currentWeapon as WeaponType] || WEAPON_CONFIGS[WeaponType.PISTOL];
    const lastFire = this.lastFireTimes.get(player.id) || 0;

    return (now - lastFire) >= config.fireRateMs;
  }

  public fireWeapon(
    player: PlayerState,
    aimAngle: number,
    now: number
  ): BulletState[] {
    const config = WEAPON_CONFIGS[player.currentWeapon as WeaponType] || WEAPON_CONFIGS[WeaponType.PISTOL];
    this.lastFireTimes.set(player.id, now);
    player.ammo -= 1;

    // Auto trigger reload if ammo depleted
    if (player.ammo <= 0) {
      this.startReload(player);
    }

    const bullets: BulletState[] = [];
    const count = config.bulletCount || 1;

    for (let i = 0; i < count; i++) {
      // Calculate spread
      let angle = aimAngle;
      if (config.spreadAngle > 0) {
        const offset = (Math.random() - 0.5) * config.spreadAngle;
        angle += offset;
      }

      const bullet = new BulletState();
      bullet.id = `b_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      bullet.ownerId = player.id;
      bullet.weaponType = player.currentWeapon;
      // Gun muzzle offset from center of player
      const barrelDist = 28;
      bullet.x = player.x + Math.cos(angle) * barrelDist;
      bullet.y = player.y + Math.sin(angle) * barrelDist;
      bullet.vx = Math.cos(angle) * config.bulletSpeed;
      bullet.vy = Math.sin(angle) * config.bulletSpeed;
      bullet.damage = config.damage;
      bullet.isExplosive = !!config.isExplosive;
      bullet.radius = config.explosionRadius || 0;
      bullet.createdAt = now;

      bullets.push(bullet);
    }

    return bullets;
  }

  public startReload(player: PlayerState): boolean {
    if (player.isDead || player.isReloading) return false;

    const config = WEAPON_CONFIGS[player.currentWeapon as WeaponType] || WEAPON_CONFIGS[WeaponType.PISTOL];
    if (player.ammo >= config.magazineSize) return false;

    player.isReloading = true;

    // Clear existing timer if any
    const existing = this.reloadTimeouts.get(player.id);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      player.ammo = config.magazineSize;
      player.isReloading = false;
      this.reloadTimeouts.delete(player.id);
    }, config.reloadTimeMs);

    this.reloadTimeouts.set(player.id, timeout);
    return true;
  }

  public switchWeapon(player: PlayerState, newWeapon: WeaponType): void {
    if (player.isDead || !WEAPON_CONFIGS[newWeapon] || player.currentWeapon === newWeapon) {
      return;
    }

    // Cancel active reload
    const existing = this.reloadTimeouts.get(player.id);
    if (existing) {
      clearTimeout(existing);
      this.reloadTimeouts.delete(player.id);
    }

    player.currentWeapon = newWeapon;
    player.isReloading = false;
    const config = WEAPON_CONFIGS[newWeapon];
    player.ammo = config.magazineSize;
  }

  public applyDamage(
    victim: PlayerState,
    damage: number,
    killer: PlayerState | null,
    onRespawn: (player: PlayerState) => void
  ): KillFeedEvent | null {
    if (victim.isDead) return null;

    victim.health = Math.max(0, victim.health - damage);

    if (victim.health <= 0) {
      victim.isDead = true;
      victim.deaths += 1;
      victim.vx = 0;
      victim.vy = 0;

      let killEvent: KillFeedEvent | null = null;
      if (killer && killer.id !== victim.id) {
        killer.kills += 1;
        killEvent = {
          killerId: killer.id,
          killerName: killer.username,
          victimId: victim.id,
          victimName: victim.username,
          weapon: killer.currentWeapon,
          timestamp: Date.now()
        };

        // Persist stats if real user IDs are associated
        if (killer.userId) {
          db.recordMatchStats(killer.userId, 1, 0, false).catch(e =>
            console.error('[Combat] Failed to record killer stat:', e)
          );
        }
      }

      if (victim.userId) {
        db.recordMatchStats(victim.userId, 0, 1, false).catch(e =>
          console.error('[Combat] Failed to record victim stat:', e)
        );
      }

      // Schedule respawn after 3.5 seconds
      const respawnTimer = setTimeout(() => {
        this.respawnPlayer(victim);
        onRespawn(victim);
        this.respawnTimeouts.delete(victim.id);
      }, 3500);

      this.respawnTimeouts.set(victim.id, respawnTimer);
      return killEvent;
    }

    return null;
  }

  public respawnPlayer(player: PlayerState): void {
    player.health = player.maxHealth;
    player.isDead = false;
    player.isReloading = false;

    const config = WEAPON_CONFIGS[player.currentWeapon as WeaponType] || WEAPON_CONFIGS[WeaponType.PISTOL];
    player.ammo = config.magazineSize;

    // Pick random spawn point
    const spawns = FOREST_ISLAND_MAP.spawnPoints;
    const spawn = spawns[Math.floor(Math.random() * spawns.length)];
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
  }

  public cleanupPlayer(playerId: string): void {
    this.lastFireTimes.delete(playerId);
    const rTimeout = this.reloadTimeouts.get(playerId);
    if (rTimeout) {
      clearTimeout(rTimeout);
      this.reloadTimeouts.delete(playerId);
    }
    const respawnTimeout = this.respawnTimeouts.get(playerId);
    if (respawnTimeout) {
      clearTimeout(respawnTimeout);
      this.respawnTimeouts.delete(playerId);
    }
  }
}

