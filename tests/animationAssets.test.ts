import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CHARS = [
  'player_infiltrator',
  'player_breacher',
  'zombie_lurker',
  'zombie_lurker_aggro',
  'zombie_audio_stalker',
  'zombie_bio_carrier',
  'zombie_armored_brute'
];

describe('animation pack assets in public/', () => {
  it('ships knife attack sheet for player infiltrator', () => {
    const dir = path.join(process.cwd(), 'public', 'assets', 'animations', 'player_infiltrator');
    expect(fs.existsSync(path.join(dir, 'attack_sheet.webp'))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'attack_sheet.json'), 'utf8'));
    expect(meta.clips[0].frames).toBe(8);
    expect(meta.image).toBe('attack_sheet.webp');
  });

  it('ships walk and downed sheets for every character', () => {
    const root = path.join(process.cwd(), 'public', 'assets', 'animations');
    for (const id of CHARS) {
      const dir = path.join(root, id);
      expect(fs.existsSync(path.join(dir, 'walk_sheet.webp')), `${id} walk webp`).toBe(true);
      expect(fs.existsSync(path.join(dir, 'walk_sheet.json')), `${id} walk json`).toBe(true);
      expect(fs.existsSync(path.join(dir, 'downed_sheet.webp')), `${id} downed webp`).toBe(true);
    }
  });
});
