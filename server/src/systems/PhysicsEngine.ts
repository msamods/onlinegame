import { FOREST_ISLAND_MAP, RectObstacle } from 'shared';
import { PlayerState, BulletState } from '../rooms/schema/GameState.js';

export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 56;
export const MOVE_SPEED = 280;
export const JUMP_VELOCITY = -520;
export const GRAVITY = 1100;
export const MAX_FALL_SPEED = 850;

export class PhysicsEngine {
  private mapWidth: number = FOREST_ISLAND_MAP.width;
  private mapHeight: number = FOREST_ISLAND_MAP.height;
  private obstacles: RectObstacle[] = FOREST_ISLAND_MAP.obstacles;

  public updatePlayer(
    player: PlayerState,
    input: { left: boolean; right: boolean; jump: boolean },
    dt: number
  ): void {
    if (player.isDead) return;

    // Horizontal Movement
    let targetVx = 0;
    if (input.left) {
      targetVx = -MOVE_SPEED;
      player.facingLeft = true;
      player.isMoving = true;
    } else if (input.right) {
      targetVx = MOVE_SPEED;
      player.facingLeft = false;
      player.isMoving = true;
    } else {
      player.isMoving = false;
    }

    player.vx = targetVx;

    // Vertical Movement (Gravity & Mini-Militia Jetpack Thrust)
    if (input.jump) {
      if (!player.isJumping) {
        // Initial impulse from ground
        player.vy = JUMP_VELOCITY;
        player.isJumping = true;
      } else {
        // Continuous upward jetpack boost while holding jump
        player.vy -= 1600 * dt;
        if (player.vy < JUMP_VELOCITY) {
          player.vy = JUMP_VELOCITY;
        }
      }
    } else {
      player.vy += GRAVITY * dt;
      if (player.vy > MAX_FALL_SPEED) {
        player.vy = MAX_FALL_SPEED;
      }
    }

    // Attempt Horizontal Movement with Collision
    const newX = player.x + player.vx * dt;
    const playerHalfW = PLAYER_WIDTH / 2;
    const playerHalfH = PLAYER_HEIGHT / 2;

    // Inset top and bottom of horizontal box by 4px so standing on ground or near ceiling doesn't block walking!
    const horizontalBox = {
      x: newX - playerHalfW,
      y: player.y - playerHalfH + 4,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT - 8
    };

    let collidedH = false;
    for (const obs of this.obstacles) {
      if (this.checkAABB(horizontalBox, obs)) {
        collidedH = true;
        break;
      }
    }

    if (!collidedH) {
      player.x = newX;
    } else {
      player.vx = 0;
    }

    // Attempt Vertical Movement with Collision
    const newY = player.y + player.vy * dt;
    const verticalBox = {
      x: player.x - playerHalfW + 2,
      y: newY - playerHalfH,
      width: PLAYER_WIDTH - 4,
      height: PLAYER_HEIGHT
    };

    let onGround = false;
    let collidedV = false;

    for (const obs of this.obstacles) {
      if (this.checkAABB(verticalBox, obs)) {
        collidedV = true;
        // Moving downwards onto a platform/ground
        if (player.vy > 0 && player.y <= obs.y) {
          player.y = obs.y - playerHalfH - 0.05;
          player.vy = 0;
          onGround = true;
        } else if (player.vy < 0) {
          // Bumping head from below
          player.y = obs.y + obs.height + playerHalfH + 0.05;
          player.vy = 0;
        }
        break;
      }
    }

    if (!collidedV) {
      player.y = newY;
      player.isJumping = true;
    } else if (onGround) {
      player.isJumping = false;
    }

    // World bounds clamping
    if (player.x < playerHalfW) {
      player.x = playerHalfW;
      player.vx = 0;
    } else if (player.x > this.mapWidth - playerHalfW) {
      player.x = this.mapWidth - playerHalfW;
      player.vx = 0;
    }

    // Bottom map boundary (fall off world / respawn guard)
    if (player.y > this.mapHeight - 40) {
      player.y = this.mapHeight - 40;
      player.vy = 0;
      player.isJumping = false;
    }
  }

  public updateBullet(bullet: BulletState, dt: number): boolean {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    // Grenade launcher has slight ballistic gravity
    if (bullet.isExplosive) {
      bullet.vy += 380 * dt;
    }

    // Check map boundaries
    if (
      bullet.x < 0 ||
      bullet.x > this.mapWidth ||
      bullet.y < 0 ||
      bullet.y > this.mapHeight
    ) {
      return true; // remove bullet
    }

    // Check collision with solid map terrain
    const bulletBox = { x: bullet.x - 4, y: bullet.y - 4, width: 8, height: 8 };
    for (const obs of this.obstacles) {
      if (this.checkAABB(bulletBox, obs)) {
        return true; // hit obstacle
      }
    }

    return false;
  }

  public checkBulletPlayerHit(bullet: BulletState, player: PlayerState): boolean {
    if (player.isDead || player.id === bullet.ownerId) return false;

    const playerBox = {
      x: player.x - PLAYER_WIDTH / 2,
      y: player.y - PLAYER_HEIGHT / 2,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT
    };

    const bulletBox = {
      x: bullet.x - 6,
      y: bullet.y - 6,
      width: 12,
      height: 12
    };

    return this.checkAABB(bulletBox, playerBox);
  }

  public checkExplosionHits(bullet: BulletState, players: Map<string, PlayerState>): { player: PlayerState; damage: number }[] {
    const hits: { player: PlayerState; damage: number }[] = [];
    const radius = bullet.radius || 120;

    players.forEach(player => {
      if (player.isDead) return;
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= radius) {
        // Falloff damage based on proximity
        const falloff = 1 - (dist / radius) * 0.6; // minimum 40% at edge
        const calculatedDamage = Math.round(bullet.damage * falloff);
        hits.push({ player, damage: calculatedDamage });
      }
    });

    return hits;
  }

  private checkAABB(
    boxA: { x: number; y: number; width: number; height: number },
    boxB: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      boxA.x < boxB.x + boxB.width &&
      boxA.x + boxA.width > boxB.x &&
      boxA.y < boxB.y + boxB.height &&
      boxA.y + boxA.height > boxB.y
    );
  }
}

