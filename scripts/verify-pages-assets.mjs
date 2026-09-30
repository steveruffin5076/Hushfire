/**
 * After `GITHUB_ACTIONS=true npm run build`, assert animation sheets land under
 * dist/Hushfire/assets/animations/ (Pages subpath deploy).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Vite emits `dist/assets/…`; GitHub Pages serves that tree under `/Hushfire/` via `base`.
const base = path.join(root, 'dist', 'assets', 'animations');

const CHARS = [
  'player_infiltrator',
  'player_breacher',
  'zombie_lurker',
  'zombie_lurker_aggro',
  'zombie_audio_stalker',
  'zombie_bio_carrier',
  'zombie_armored_brute'
];

const REQUIRED = ['walk_sheet.webp', 'walk_sheet.json', 'downed_sheet.webp', 'downed_sheet.json'];
const INFILTRATOR_LOADOUT = [
  'loadouts/pistol/walk_sheet.webp',
  'loadouts/knife/attack_sheet.webp',
  'hit_sheet.webp',
  'downed_sheet.webp',
];

let failed = false;
if (!fs.existsSync(base)) {
  console.error('Missing dist base:', base);
  process.exit(1);
}

for (const char of CHARS) {
  const dir = path.join(base, char);
  if (!fs.existsSync(dir)) {
    console.error('Missing character dir:', dir);
    failed = true;
    continue;
  }
  if (char === 'player_infiltrator') {
    for (const file of INFILTRATOR_LOADOUT) {
      const p = path.join(dir, file);
      if (!fs.existsSync(p)) {
        console.error('Missing', path.relative(root, p));
        failed = true;
      }
    }
    continue;
  }
  for (const file of REQUIRED) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) {
      console.error('Missing', path.relative(root, p));
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('Pages animation assets OK under', path.relative(root, base));
