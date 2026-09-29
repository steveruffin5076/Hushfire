import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { ThrownGrenade } from '../entities/ThrownGrenade';
import { MapManager } from './MapManager';
import { NoiseSystem } from './NoiseSystem';
import { CombatSystem, bloodDecal, Decal } from './CombatSystem';
import { Segment } from '../lighting/Raycaster';
import {
  THROW_MAX_RANGE_PX,
  THROW_SPEED_PX_PER_SEC,
  ThrowableKind,
  THROWABLE_EFFECT
} from '../config/throwables';
import { RadialLight } from '../lighting/ShadowRenderer';
import { isSectorAlertingShot } from './HordeSurge';

export interface GroundFire {
  x: number;
  y: number;
  radius: number;
  life: number;
  dps: number;
  ownerId: number;
}

export interface PlacedFlare {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export interface ThrowableEvents {
  onSectorAlertingShot?: (player: Player) => void;
}

export function clampThrowTarget(
  ox: number,
  oy: number,
  targetX: number,
  targetY: number,
  maxRange = THROW_MAX_RANGE_PX
): { x: number; y: number } {
  const dx = targetX - ox;
  const dy = targetY - oy;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxRange || dist === 0) return { x: targetX, y: targetY };
  const s = maxRange / dist;
  return { x: ox + dx * s, y: oy + dy * s };
}

export class ThrowableSystem {
  constructor(
    private map: MapManager,
    private noise: NoiseSystem,
    private combat: CombatSystem,
    private events: ThrowableEvents = {}
  ) {}

  throw(
    player: Player,
    kind: ThrowableKind,
    targetX: number,
    targetY: number,
    inFlight: ThrownGrenade[]
  ): boolean {
    if (!player.canThrow(kind)) return false;
    const clamped = clampThrowTarget(player.x, player.y, targetX, targetY);
    player.consumeThrowable(kind);
    inFlight.push(
      new ThrownGrenade(
        player.x,
        player.y,
        clamped.x,
        clamped.y,
        kind,
        player.id,
        THROW_SPEED_PX_PER_SEC
      )
    );
    return true;
  }

  update(
    dt: number,
    inFlight: ThrownGrenade[],
    zombies: Zombie[],
    players: Player[],
    decals: Decal[],
    fires: GroundFire[],
    flares: PlacedFlare[]
  ) {
    const remaining: ThrownGrenade[] = [];
    for (const g of inFlight) {
      const arrived = g.update(dt);
      let detonate = arrived;
      if (!detonate) {
        for (const seg of this.map.walls) {
          if (this.segmentBlocksPoint(seg, g.x, g.y)) {
            detonate = true;
            break;
          }
        }
      }
      if (detonate) {
        this.detonate(g.kind, g.x, g.y, g.ownerId, zombies, players, decals, fires, flares);
      } else {
        remaining.push(g);
      }
    }
    inFlight.length = 0;
    inFlight.push(...remaining);

    for (const fire of fires) {
      fire.life -= dt;
      for (const z of zombies) {
        if (!z.alive || z.isDying) continue;
        if (Math.hypot(z.x - fire.x, z.y - fire.y) > fire.radius) continue;
        z.takeDamage(fire.dps * dt);
        if (!z.alive) z.startDying();
      }
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      if (fires[i].life <= 0) fires.splice(i, 1);
    }
    for (const flare of flares) flare.life -= dt;
    for (let i = flares.length - 1; i >= 0; i--) {
      if (flares[i].life <= 0) flares.splice(i, 1);
    }
  }

  flareLights(flares: PlacedFlare[]): RadialLight[] {
    return flares.map(f => ({ origin: { x: f.x, y: f.y }, radius: f.radius }));
  }

  private detonate(
    kind: ThrowableKind,
    x: number,
    y: number,
    ownerId: number,
    zombies: Zombie[],
    players: Player[],
    decals: Decal[],
    fires: GroundFire[],
    flares: PlacedFlare[]
  ) {
    const fx = THROWABLE_EFFECT[kind];
    const owner = players.find(p => p.id === ownerId);
    this.noise.emit({
      x,
      y,
      radius: fx.noise,
      type: kind === 'he' || kind === 'incendiary' ? 'gunshot' : kind === 'flashbang' ? 'explosion' : 'footstep'
    });
    if (owner && isSectorAlertingShot(fx.noise, false)) {
      this.events.onSectorAlertingShot?.(owner);
    }

    if (kind === 'flare') {
      const flareFx = THROWABLE_EFFECT.flare;
      flares.push({ x, y, radius: flareFx.radius, life: flareFx.durationSec });
      decals.push({ x, y, r: 14, color: '#FF6B35', kind: 'blood', angle: 0 });
      return;
    }

    if (kind === 'incendiary') {
      const incFx = THROWABLE_EFFECT.incendiary;
      fires.push({ x, y, radius: incFx.radius, life: incFx.burnSec, dps: 18, ownerId });
    }

    for (const z of zombies) {
      if (!z.alive || z.isDying) continue;
      const dist = Math.hypot(z.x - x, z.y - y);
      if (dist > fx.radius) continue;

      if (kind === 'flashbang') {
        const flashFx = THROWABLE_EFFECT.flashbang;
        z.stunTimer = Math.max(z.stunTimer, flashFx.stunSec);
        z.lightExposureTimer = 0;
        z.state = 'SUSPICIOUS';
        z.investigateTarget = { x, y };
        continue;
      }

      const falloff = 1 - dist / fx.radius;
      const baseDamage = kind === 'he' ? THROWABLE_EFFECT.he.damage : kind === 'incendiary' ? THROWABLE_EFFECT.incendiary.damage : 0;
      const dmg = baseDamage * Math.max(0.25, falloff);
      if (dmg > 0 && owner) {
        const angle = Math.atan2(z.y - y, z.x - x);
        this.combat.applyThrowableDamage(z, angle, dmg, owner);
      } else if (dmg > 0) {
        z.takeDamage(dmg);
      }
      decals.push(bloodDecal(z.x, z.y, 10, kind === 'he' ? '#CC2200' : '#FF5500'));
    }

    if (kind === 'he') {
      decals.push({ x, y, r: 22, color: '#FFAA44', kind: 'blood', angle: 0 });
    }
  }

  private segmentBlocksPoint(seg: Segment, px: number, py: number): boolean {
    const abx = seg.p2.x - seg.p1.x;
    const aby = seg.p2.y - seg.p1.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return false;
    let t = ((px - seg.p1.x) * abx + (py - seg.p1.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = seg.p1.x + abx * t;
    const cy = seg.p1.y + aby * t;
    return Math.hypot(px - cx, py - cy) < 8;
  }
}
