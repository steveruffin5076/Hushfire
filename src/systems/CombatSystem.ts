import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { Point, Raycaster, Segment } from '../lighting/Raycaster';
import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, AMMO_MODIFIERS } from '../config/weapons';
import { NoiseSystem } from './NoiseSystem';
import { MapManager } from './MapManager';
import { angleBetween } from './Geometry';

export interface Decal {
  x: number;
  y: number;
  r: number;
  color: string;
  kind: 'blood' | 'toxic';
  /** Random rotation so repeat splatters don't look stamped. */
  angle: number;
}

export function bloodDecal(x: number, y: number, r: number, color: string): Decal {
  return { x, y, r, color, kind: 'blood', angle: Math.random() * Math.PI * 2 };
}

export interface CombatEvents {
  onZombieKilled?: (zombie: Zombie, killer: Player) => void;
}

const MELEE_RANGE = 46;
const MELEE_ARC_RAD = (70 * Math.PI) / 180;
const KNIFE_BACKSTAB_DAMAGE = 400;
/** A backstab needs the attacker inside this rear cone of the zombie (120° wide, centered on its back). */
const BACKSTAB_REAR_ARC_RAD = (120 * Math.PI) / 180;
/** Cosmetic push on a non-lethal hit — decays in Zombie.updateJuice, never wall-checked. */
const HIT_KNOCKBACK_PX_PER_SEC = 90;
/** How long a hit's white flash lasts — exported so the renderer can fade it by the same duration. */
export const HIT_FLASH_SEC = 0.08;

export class CombatSystem {
  constructor(private map: MapManager, private noise: NoiseSystem, private events: CombatEvents = {}) {}

  fire(player: Player, zombies: Zombie[], decals: Decal[], projectiles: Projectile[]) {
    if (!player.canFire()) return;

    const weapon = WEAPON_REGISTRY[player.activeWeaponId];
    const muzzleMod = MUZZLE_MODIFIERS[player.activeMuzzle];
    const ammoMod = AMMO_MODIFIERS[player.activeAmmoType];

    player.consumeShot();

    const soundRadius = weapon.baseSoundRadiusPx * muzzleMod.soundMult * ammoMod.soundMult;
    player.noiseRadius = Math.max(player.noiseRadius, soundRadius);
    this.noise.emit({ x: player.x, y: player.y, radius: soundRadius, type: weapon.isSilentByDefault ? 'footstep' : 'gunshot' });

    const damage = weapon.baseDamage * muzzleMod.dmgMult * ammoMod.dmgMult;

    if (weapon.id === 'knife') {
      this.meleeAttack(player, zombies, damage, ammoMod.armorPen, decals);
      return;
    }

    if (weapon.id === 'crossbow') {
      projectiles.push(new Projectile(player.x, player.y, player.angle, damage, player.id, ammoMod.armorPen));
      return;
    }

    const pelletCount = weapon.pelletCount ?? 1;
    const spreadRad = pelletCount > 1 ? (18 * Math.PI) / 180 : 0.015;

    for (let i = 0; i < pelletCount; i++) {
      const jitter = pelletCount > 1 ? (Math.random() - 0.5) * spreadRad : (Math.random() - 0.5) * spreadRad;
      const angle = player.angle + jitter;
      this.hitscan(player, angle, damage / pelletCount, ammoMod.armorPen, zombies, decals);
    }
  }

  private hitscan(player: Player, angle: number, damage: number, armorPen: number, zombies: Zombie[], decals: Decal[]) {
    const dir: Point = { x: Math.cos(angle) * 1000, y: Math.sin(angle) * 1000 };
    const origin: Point = { x: player.x, y: player.y };

    let maxT = 1.0;
    for (const seg of this.map.walls) {
      const hit = Raycaster.getIntersection(origin, dir, seg);
      if (hit) {
        const t = Math.hypot(hit.x - origin.x, hit.y - origin.y) / 1000;
        if (t < maxT) maxT = t;
      }
    }

    let closestZombie: Zombie | null = null;
    let closestT = maxT;

    for (const zombie of zombies) {
      if (!zombie.alive) continue;
      const t = this.rayCircleIntersection(origin, angle, zombie, closestT);
      if (t !== null && t < closestT) {
        closestT = t;
        closestZombie = zombie;
      }
    }

    if (closestZombie) {
      this.applyDamage(closestZombie, angle, damage, player, armorPen);
      decals.push(bloodDecal(closestZombie.x, closestZombie.y, 8, '#880E0E'));
    }
  }

  private rayCircleIntersection(origin: Point, angle: number, zombie: Zombie, maxT: number): number | null {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const toCenterX = zombie.x - origin.x;
    const toCenterY = zombie.y - origin.y;
    const proj = toCenterX * dx + toCenterY * dy;
    if (proj < 0 || proj / 1000 > maxT) return null;
    const closestX = origin.x + dx * proj;
    const closestY = origin.y + dy * proj;
    const distSq = (zombie.x - closestX) ** 2 + (zombie.y - closestY) ** 2;
    if (distSq > zombie.radius * zombie.radius) return null;
    return proj / 1000;
  }

  private meleeAttack(player: Player, zombies: Zombie[], damage: number, armorPen: number, decals: Decal[]) {
    for (const zombie of zombies) {
      if (!zombie.alive) continue;
      const dist = Math.hypot(zombie.x - player.x, zombie.y - player.y);
      if (dist > MELEE_RANGE) continue;

      const angleTo = Math.atan2(zombie.y - player.y, zombie.x - player.x);
      if (angleBetween(angleTo, player.angle) > MELEE_ARC_RAD / 2) continue;

      const isBackstab = this.isBehind(player, zombie);
      this.applyDamage(zombie, angleTo, isBackstab ? KNIFE_BACKSTAB_DAMAGE : damage, player, armorPen);
      decals.push(bloodDecal(zombie.x, zombie.y, 6, '#5A0B0B'));
    }
  }

  /**
   * True when the attacker stands in the zombie's rear cone — judged by where
   * they are, not which way they face. The old version compared facings and
   * was inverted: it granted the backstab when the two faced each other.
   */
  isBehind(attacker: Point, zombie: Zombie): boolean {
    const zombieToAttacker = Math.atan2(attacker.y - zombie.y, attacker.x - zombie.x);
    return angleBetween(zombieToAttacker, zombie.angle + Math.PI) < BACKSTAB_REAR_ARC_RAD / 2;
  }

  private applyDamage(zombie: Zombie, hitAngle: number, rawDamage: number, attacker: Player, armorPen: number) {
    let damage = rawDamage;

    if (zombie.def.isArmoredFront) {
      // hitAngle is the direction the shot travels, so a frontal hit travels against the zombie's facing.
      const isFrontalHit = angleBetween(hitAngle, zombie.angle + Math.PI) < Math.PI / 2;
      if (isFrontalHit) {
        const penetration = Math.max(0, armorPen);
        damage *= 0.25 + penetration * 0.75;
      }
    }

    zombie.takeDamage(damage);
    zombie.alert('ENRAGED', { x: attacker.x, y: attacker.y });

    if (!zombie.alive) {
      zombie.startDying();
      attacker.killCount++;
      if (zombie.archetype === 'bio_carrier' && !zombie.hasExploded) {
        zombie.hasExploded = true;
        this.noise.emit({ x: zombie.x, y: zombie.y, radius: 400, type: 'explosion' });
      }
      this.events.onZombieKilled?.(zombie, attacker);
    } else {
      // Survived the hit — sell the impact with a flash and a small punch along the hit direction.
      zombie.hitFlashTimer = HIT_FLASH_SEC;
      zombie.knockbackX += Math.cos(hitAngle) * HIT_KNOCKBACK_PX_PER_SEC;
      zombie.knockbackY += Math.sin(hitAngle) * HIT_KNOCKBACK_PX_PER_SEC;
    }
  }

  updateProjectiles(dt: number, projectiles: Projectile[], zombies: Zombie[], players: Player[], decals: Decal[]) {
    for (const bolt of projectiles) {
      if (bolt.stuck) continue;
      bolt.update(dt);

      for (const seg of this.map.walls) {
        if (this.segmentBlocksPoint(seg, bolt)) {
          bolt.stick();
          break;
        }
      }

      if (bolt.stuck) continue;

      for (const zombie of zombies) {
        if (!zombie.alive) continue;
        const dist = Math.hypot(zombie.x - bolt.x, zombie.y - bolt.y);
        if (dist < zombie.radius + bolt.radius) {
          const owner = players.find(p => p.id === bolt.ownerId);
          const hitAngle = Math.atan2(zombie.y - bolt.y, zombie.x - bolt.x);
          if (owner) {
            this.applyDamage(zombie, hitAngle, bolt.damage, owner, bolt.armorPen);
          } else {
            zombie.takeDamage(bolt.damage);
            zombie.alert('ENRAGED', { x: bolt.x, y: bolt.y });
          }
          decals.push(bloodDecal(zombie.x, zombie.y, 8, '#880E0E'));
          bolt.stick();
          break;
        }
      }
    }
  }

  private segmentBlocksPoint(seg: Segment, bolt: Projectile): boolean {
    const abx = seg.p2.x - seg.p1.x;
    const aby = seg.p2.y - seg.p1.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return false;
    let t = ((bolt.x - seg.p1.x) * abx + (bolt.y - seg.p1.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = seg.p1.x + abx * t;
    const cy = seg.p1.y + aby * t;
    const dist = Math.hypot(bolt.x - cx, bolt.y - cy);
    return dist < bolt.radius + 2;
  }
}
