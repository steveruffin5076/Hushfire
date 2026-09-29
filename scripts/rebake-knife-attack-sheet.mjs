/**
 * Rebakes player_infiltrator attack_sheet to 556×304 cells (walk/recoil geometry).
 * Source: existing 8×256 horizontal strip in attack_sheet.webp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'assets', 'animations', 'player_infiltrator');
const srcWebp = path.join(outDir, 'attack_sheet.webp');

const CELL_W = 556;
const CELL_H = 304;
const FRAMES = 8;
const SRC_CELL = 256;

async function main() {
  const meta = await sharp(srcWebp).metadata();
  const srcW = meta.width ?? 0;
  if (srcW % SRC_CELL !== 0) {
    throw new Error(`Expected source width multiple of ${SRC_CELL}, got ${srcW}`);
  }
  const frameCount = srcW / SRC_CELL;
  if (frameCount !== FRAMES) {
    throw new Error(`Expected ${FRAMES} source frames, got ${frameCount}`);
  }

  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const buf = await sharp(srcWebp)
      .extract({ left: i * SRC_CELL, top: 0, width: SRC_CELL, height: SRC_CELL })
      .resize(CELL_W, CELL_H, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    frames.push(buf);
  }

  const sheet = await sharp({
    create: {
      width: CELL_W * FRAMES,
      height: CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(frames.map((buf, i) => ({ input: buf, left: i * CELL_W, top: 0 })))
    .webp({ quality: 92, effort: 6 })
    .toBuffer();

  fs.writeFileSync(path.join(outDir, 'attack_sheet.webp'), sheet);

  const json = {
    frame_width: CELL_W,
    frame_height: CELL_H,
    layout: 'row',
    clips: [
      {
        name: 'knife_attack',
        frames: FRAMES,
        frame_ms: 68,
        loop: false,
        events: { strike: 4 }
      }
    ],
    pivots_cell_px: {
      torso: [137.3, 139.2]
    },
    note: 'Cell geometry matches walk_sheet / recoil_sheet',
    image: 'attack_sheet.webp'
  };
  fs.writeFileSync(path.join(outDir, 'attack_sheet.json'), JSON.stringify(json, null, 2));
  console.log('Rebaked', CELL_W, 'x', CELL_H, 'x', FRAMES, `(${(sheet.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
