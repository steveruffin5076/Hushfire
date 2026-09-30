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
  it('ships operative loadouts and shared sheets for player infiltrator', () => {
    const dir = path.join(process.cwd(), 'public', 'assets', 'animations', 'player_infiltrator');
    expect(fs.existsSync(path.join(dir, 'downed_sheet.webp'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'hit_sheet.webp'))).toBe(true);

    const knifeAttack = path.join(dir, 'loadouts', 'knife', 'attack_sheet.json');
    expect(fs.existsSync(knifeAttack)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(knifeAttack, 'utf8'));
    expect(meta.clips[0].frames).toBe(8);
    expect(meta.frame_width).toBe(556);
    expect(meta.image).toBe('attack_sheet.webp');

    for (const loadout of ['knife', 'pistol', 'rifle']) {
      const lb = path.join(dir, 'loadouts', loadout);
      expect(fs.existsSync(path.join(lb, 'walk_sheet.webp')), loadout).toBe(true);
      expect(fs.existsSync(path.join(lb, 'idle_sheet.webp')), loadout).toBe(true);
    }
  });

  it('ships walk and downed sheets for every character', () => {
    const root = path.join(process.cwd(), 'public', 'assets', 'animations');
    for (const id of CHARS) {
      const dir = path.join(root, id);
      if (id === 'player_infiltrator') {
        const walk = path.join(dir, 'loadouts', 'pistol', 'walk_sheet.webp');
        expect(fs.existsSync(walk), `${id} loadout walk`).toBe(true);
      } else {
        expect(fs.existsSync(path.join(dir, 'walk_sheet.webp')), `${id} walk webp`).toBe(true);
        expect(fs.existsSync(path.join(dir, 'walk_sheet.json')), `${id} walk json`).toBe(true);
      }
      expect(fs.existsSync(path.join(dir, 'downed_sheet.webp')), `${id} downed webp`).toBe(true);
    }
  });
});
