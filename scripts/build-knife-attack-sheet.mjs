/**
 * Stitches knife_attack_frames/*.png into player_infiltrator attack_sheet.
 * Usage: node scripts/build-knife-attack-sheet.mjs [path-to-knife_attack_frames]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const frameDir =
  process.argv[2] ??
  path.join(root, '.tmp_knife_attack', 'knife_attack_frames');

const FRAME_W = 556;
const FRAME_H = 304;
const FRAME_NAMES = [
  'knife_01_ready.png',
  'knife_02_windup.png',
  'knife_03_slash_start.png',
  'knife_04_slash_peak.png',
  'knife_05_followthrough.png',
  'knife_06_recovery.png'
];

const outDir = path.join(root, 'public', 'assets', 'animations', 'player_infiltrator');

async function frameBuffer(name) {
  const file = path.join(frameDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return sharp(file)
    .resize(FRAME_W, FRAME_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  const frames = await Promise.all(FRAME_NAMES.map(frameBuffer));
  const sheet = await sharp({
    create: {
      width: FRAME_W * frames.length,
      height: FRAME_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(frames.map((buf, i) => ({ input: buf, left: i * FRAME_W, top: 0 })))
    .webp({ quality: 92, effort: 6 })
    .toBuffer();

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'attack_sheet.webp'), sheet);

  const meta = {
    frame_width: FRAME_W,
    frame_height: FRAME_H,
    layout: 'row',
    clips: [
      {
        name: 'knife_attack',
        frames: FRAME_NAMES.length,
        frame_ms: [70, 55, 50, 50, 55, 65],
        loop: false,
        events: { strike: 3 }
      }
    ],
    pivots_cell_px: { torso: [137.3, 139.2] },
    note: 'Operative 1 knife swing — geometry matches walk_sheet anchor',
    image: 'attack_sheet.webp'
  };
  fs.writeFileSync(path.join(outDir, 'attack_sheet.json'), JSON.stringify(meta, null, 2));
  console.log('Wrote', path.join(outDir, 'attack_sheet.webp'), `(${(sheet.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
