import { describe, expect, it } from 'vitest';
import { CharacterAnimController } from '../src/graphics/animation/CharacterAnimController';
import type { CharacterSheetSet } from '../src/graphics/animation/CharacterAnimController';
import type { SimpleClipSheetMeta, WalkSheetMeta } from '../src/graphics/animation/sheetTypes';

const walkMeta: WalkSheetMeta = {
  image: 'walk.webp',
  frame_width: 556,
  frame_height: 304,
  frames: 8,
  layout: 'row',
  pivots_cell_px: { torso: [137.3, 139.2] }
};

const attackMeta: SimpleClipSheetMeta = {
  image: 'attack.webp',
  frame_width: 556,
  frame_height: 304,
  layout: 'row',
  clips: [{ name: 'knife_attack', frames: 8, frame_ms: 68, loop: false }],
  pivots_cell_px: { torso: [137.3, 139.2] }
};

const fakeImg = { width: 556 * 8, height: 304 } as HTMLImageElement;

describe('CharacterAnimController knife attack', () => {
  it('plays attack clip for ~total duration then stops', () => {
    const set: CharacterSheetSet = {
      walk: { image: fakeImg, meta: walkMeta },
      attack: { image: fakeImg, meta: attackMeta }
    };
    const ctrl = new CharacterAnimController(set);
    expect(ctrl.hasAttackSheet()).toBe(true);
    ctrl.triggerAttack();
    const opts = { isDowned: false, isMoving: false, moveSpeedMult: 1, isPlayer: true };
    ctrl.update(0.2, opts);
    expect(ctrl.attackActive).toBe(true);
    ctrl.update(0.5, opts);
    expect(ctrl.attackActive).toBe(false);
  });
});
