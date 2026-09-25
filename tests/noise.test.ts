import { describe, it, expect, beforeEach } from 'vitest';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { MapManager } from '../src/systems/MapManager';
import { Zombie } from '../src/entities/Zombie';
import { WALL_SOUND_DAMPENING } from '../src/config/constants';

// Sector 1's open strip left of its first wall column (x 310) gives clear line
// of sight from (100, 360) out to ~x 300.
const origin = { x: 100, y: 360 };

describe('NoiseSystem.propagate', () => {
  let map: MapManager;
  let noise: NoiseSystem;

  beforeEach(() => {
    map = new MapManager();
    noise = new NoiseSystem();
  });

  const shoot = (radius: number, zombie: Zombie, type: 'gunshot' | 'explosion' = 'gunshot') => {
    noise.emit({ ...origin, radius, type });
    noise.propagate([zombie], map);
  };

  it('enrages a zombie right next to a loud sound', () => {
    const z = new Zombie(origin.x + 20, origin.y, 0, 'lurker');
    shoot(400, z);
    expect(z.state).toBe('ENRAGED');
  });

  it('only makes a mid-range zombie suspicious', () => {
    // intensity = 1 - 150/300 = 0.5: above awareness (0.38), below enrage (0.8).
    const z = new Zombie(origin.x + 150, origin.y, 0, 'lurker');
    shoot(300, z);
    expect(z.state).toBe('SUSPICIOUS');
  });

  it('does not wake a zombie outside the sound radius', () => {
    const z = new Zombie(origin.x + 180, origin.y, 0, 'lurker');
    shoot(150, z);
    expect(z.state).toBe('DORMANT');
  });

  it('muffles sound through walls', () => {
    // Behind the x 310-395 wall: 2 wall faces crossed.
    const z = new Zombie(420, 150, 0, 'lurker');
    const from = { x: 280, y: 150 };
    expect(map.countWallsCrossed(from, z)).toBe(2);
    const radius = 300;
    // Open-air this would be intensity 1 - 140/300 ≈ 0.53 (suspicious).
    // With 2 walls the radius shrinks to 300 * (1 - WALL_SOUND_DAMPENING)^2, below 140.
    expect(radius * Math.pow(1 - WALL_SOUND_DAMPENING, 2)).toBeLessThan(140);
    noise.emit({ ...from, radius, type: 'gunshot' });
    noise.propagate([z], map);
    expect(z.state).toBe('DORMANT');
  });

  it('always enrages on an explosion within range', () => {
    const z = new Zombie(origin.x + 180, origin.y, 0, 'lurker');
    shoot(200, z, 'explosion');
    expect(z.state).toBe('ENRAGED');
  });

  it('propagateScreams returns positions and alerts nearby dormant zombies', () => {
    const screamer = new Zombie(400, 360, 0, 'lurker');
    screamer.alert('ENRAGED', { x: 400, y: 360 });
    const nearby = new Zombie(430, 360, 0, 'lurker');
    const heard = NoiseSystem.propagateScreams([screamer, nearby]);
    expect(heard).toHaveLength(1);
    expect(heard[0]).toEqual({ x: 400, y: 360 });
    expect(nearby.state).toBe('ENRAGED');
  });

  it('ignores silent events and clears the queue after propagating', () => {
    const z = new Zombie(origin.x + 10, origin.y, 0, 'lurker');
    noise.emit({ ...origin, radius: 0, type: 'footstep' });
    noise.propagate([z], map);
    expect(z.state).toBe('DORMANT');

    noise.emit({ ...origin, radius: 400, type: 'gunshot' });
    noise.propagate([], map);
    noise.propagate([z], map);
    expect(z.state).toBe('DORMANT');
  });
});
