/**
 * Copies animation sheets from extracted pack → public/assets/animations/
 * and emits WebP (quality 92) for smaller deploys. Run once after updating the zip:
 *   node scripts/import-anim-pack.mjs [path-to-extracted-pack]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packRoot = process.argv[2] ?? path.join(root, '.tmp_anim_pack');
const outRoot = path.join(root, 'public', 'assets', 'animations');

const CHAR_DIRS = [
  'player_infiltrator',
  'player_breacher',
  'zombie_armored_brute',
  'zombie_audio_stalker',
  'zombie_bio_carrier',
  'zombie_lurker',
  'zombie_lurker_aggro'
];

const SHEETS = ['walk_sheet', 'downed_sheet', 'attack_sheet', 'recoil_sheet', 'hit_sheet'];

async function main() {
  if (!fs.existsSync(packRoot)) {
    console.error('Pack folder not found:', packRoot);
    process.exit(1);
  }

  for (const char of CHAR_DIRS) {
    const srcDir = path.join(packRoot, 'sprites', char);
    const destDir = path.join(outRoot, char);
    if (!fs.existsSync(srcDir)) {
      console.warn('skip missing', char);
      continue;
    }
    fs.mkdirSync(destDir, { recursive: true });

    for (const base of SHEETS) {
      const png = path.join(srcDir, `${base}.png`);
      const json = path.join(srcDir, `${base}.json`);
      if (!fs.existsSync(png)) continue;

      const webp = path.join(destDir, `${base}.webp`);
      await sharp(png).webp({ quality: 92, effort: 6 }).toFile(webp);

      if (fs.existsSync(json)) {
        const meta = JSON.parse(fs.readFileSync(json, 'utf8'));
        meta.image = `${base}.webp`;
        fs.writeFileSync(path.join(destDir, `${base}.json`), JSON.stringify(meta, null, 2));
      }
      const kb = (fs.statSync(webp).size / 1024).toFixed(0);
      console.log(`${char}/${base}.webp  ${kb} KB`);
    }
  }
  console.log('Done →', outRoot);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
