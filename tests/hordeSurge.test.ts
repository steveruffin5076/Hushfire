import { describe, it, expect } from 'vitest';
import { surgeInterval, surgeSize, pickSurgeArchetype, rawSurgeSpawnPoint, SURGE_START_INTERVAL_SEC, SURGE_MIN_INTERVAL_SEC } from '../src/systems/HordeSurge';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS } from '../src/config/sectors';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';

const ENTITY_RADIUS = 16;

describe('horde surge pacing', () => {
  it('starts at 10s and tightens to 4s by the end of the 120s holdout', () => {
    expect(surgeInterval(0)).toBe(SURGE_START_INTERVAL_SEC);
    expect(surgeInterval(60)).toBe(7);
    expect(surgeInterval(120)).toBe(SURGE_MIN_INTERVAL_SEC);
    expect(surgeInterval(500)).toBe(SURGE_MIN_INTERVAL_SEC);
  });

  it('never speeds back up', () => {
    for (let t = 0; t < 150; t += 5) expect(surgeInterval(t + 5)).toBeLessThanOrEqual(surgeInterval(t));
  });

  it('sends more waves than the old flat 10s pace over a full holdout', () => {
    let waves = 0;
    for (let t = surgeInterval(0); t <= 120; t += surgeInterval(t)) waves++;
    expect(waves).toBeGreaterThan(120 / 10);
  });

  it('doubles the wave in co-op', () => {
    expect(surgeSize(false)).toBe(1);
    expect(surgeSize(true)).toBe(2);
  });
});

describe('surge mix', () => {
  it('follows the weights, with brutes rare but present', () => {
    const counts: Record<string, number> = {};
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const a = pickSurgeArchetype(i / N);
      counts[a] = (counts[a] ?? 0) + 1;
    }
    expect(counts.lurker).toBe(400);
    expect(counts.audio_stalker).toBe(250);
    expect(counts.bio_carrier).toBe(250);
    expect(counts.armored_brute).toBe(100);
  });

  it('handles the edges of the roll', () => {
    expect(pickSurgeArchetype(0)).toBe('lurker');
    expect(pickSurgeArchetype(0.999999)).toBe('armored_brute');
  });
});

describe('surge spawn safety', () => {
  it('raw edge rolls can land inside Sector 3 off-roof blockers', () => {
    const map = new MapManager();
    map.loadSector(2);
    let trapped = 0;
    for (let i = 0; i < 500; i++) {
      const p = rawSurgeSpawnPoint(() => i / 500);
      if (map.sector.boxes.some(box => map.isInsideBox(p, box))) trapped++;
    }
    expect(trapped).toBeGreaterThan(0);
  });

  it('rollSurgeSpawn always returns a walkable point on Sector 3', () => {
    const map = new MapManager();
    map.loadSector(2);
    const goal = map.extractionZone;
    for (let i = 0; i < 300; i++) {
      const spawn = map.rollSurgeSpawn(() => (i * 37) % 997 / 997);
      expect(map.isFreePosition(spawn, ENTITY_RADIUS), `spawn ${spawn.x},${spawn.y}`).toBe(true);
      expect(map.nav.findPath(spawn, goal).length, `no path from ${spawn.x},${spawn.y}`).toBeGreaterThan(0);
    }
  });
});

describe('difficulty curve', () => {
  it('each sector opens with more zombie HP than the one before', () => {
    const hp = SECTORS.map(s => s.zombies.reduce((sum, z) => sum + ZOMBIE_REGISTRY[z.archetype].maxHealth, 0));
    for (let i = 1; i < hp.length; i++) expect(hp[i], `sector ${i + 1}`).toBeGreaterThan(hp[i - 1]);
  });
});
