import type { ClipDef, MultiClipSheetMeta, SimpleClipSheetMeta, WalkSheetMeta } from './sheetTypes';
import { drawSheetFrame } from './drawSheetFrame';

export interface CharacterSheetSet {
  walk: { image: HTMLImageElement; meta: WalkSheetMeta };
  downed?: { image: HTMLImageElement; meta: MultiClipSheetMeta };
  recoil?: { image: HTMLImageElement; meta: SimpleClipSheetMeta };
  hit?: { image: HTMLImageElement; meta: SimpleClipSheetMeta };
  attack?: { image: HTMLImageElement; meta: MultiClipSheetMeta | SimpleClipSheetMeta };
}

function pivotWalk(m: WalkSheetMeta): [number, number] {
  return m.pivots_cell_px.torso;
}

function pivotMulti(m: MultiClipSheetMeta): [number, number] {
  return m.pivot_cell_px;
}

function pivotSimple(m: SimpleClipSheetMeta, walk: WalkSheetMeta): [number, number] {
  if (m.pivot_cell_px) return m.pivot_cell_px;
  if (m.pivots_cell_px?.torso) return m.pivots_cell_px.torso;
  return pivotWalk(walk);
}

function advanceClip(
  clip: ClipDef,
  time: number,
  dt: number
): { time: number; frame: number; done: boolean } {
  const durations =
    Array.isArray(clip.frame_ms)
      ? clip.frame_ms
      : Array.from({ length: clip.frames }, () => clip.frame_ms as number);
  let t = time + dt * 1000;
  let frame = 0;
  while (frame < clip.frames) {
    const d = durations[frame] ?? durations[durations.length - 1] ?? 100;
    if (t < d) break;
    t -= d;
    frame++;
  }
  const done = frame >= clip.frames;
  if (done && !clip.loop) {
    return { time: 0, frame: clip.frames - 1, done: true };
  }
  if (done && clip.loop) {
    return { time: 0, frame: 0, done: false };
  }
  return { time: t, frame, done: false };
}

/** Runtime playback for one entity using baked sheets. */
export class CharacterAnimController {
  walkPhase = 0;
  downedMode: 'up' | 'falling' | 'idle' = 'up';
  downedTime = 0;
  recoilTime = 0;
  recoilActive = false;
  hitTime = 0;
  hitActive = false;
  attackTime = 0;
  attackActive = false;
  wasDowned = false;

  constructor(private readonly sheets: CharacterSheetSet) {}

  triggerRecoil() {
    if (!this.sheets.recoil) return;
    this.recoilActive = true;
    this.recoilTime = 0;
  }

  triggerHit() {
    if (!this.sheets.hit) return;
    this.hitActive = true;
    this.hitTime = 0;
  }

  triggerAttack() {
    if (!this.sheets.attack) return;
    this.attackActive = true;
    this.attackTime = 0;
  }

  update(
    dt: number,
    opts: {
      isDowned: boolean;
      isMoving: boolean;
      moveSpeedMult: number;
      isPlayer: boolean;
    }
  ) {
    const { walk, downed, recoil, hit, attack } = this.sheets;

    if (opts.isDowned && !this.wasDowned && downed) {
      this.downedMode = 'falling';
      this.downedTime = 0;
    }
    if (!opts.isDowned && this.wasDowned) {
      this.downedMode = 'up';
      this.downedTime = 0;
    }
    this.wasDowned = opts.isDowned;

    if (this.hitActive && hit) {
      const clip = hit.meta.clips[0];
      const adv = advanceClip(clip, this.hitTime, dt);
      this.hitTime = adv.time;
      if (adv.done) this.hitActive = false;
      return;
    }

    if (this.recoilActive && recoil) {
      const clip = recoil.meta.clips[0];
      const adv = advanceClip(clip, this.recoilTime, dt);
      this.recoilTime = adv.time;
      if (adv.done) this.recoilActive = false;
    }

    if (this.attackActive && attack) {
      const clip = attack.meta.clips[0];
      const adv = advanceClip(clip, this.attackTime, dt);
      this.attackTime = adv.time;
      if (adv.done) this.attackActive = false;
      return;
    }

    if (opts.isDowned && downed) {
      const fall = downed.meta.clips.find(c => c.name === 'downed');
      const idle = downed.meta.clips.find(c => c.name === 'downed_idle');
      if (this.downedMode === 'falling' && fall) {
        const adv = advanceClip(fall, this.downedTime, dt);
        this.downedTime = adv.time;
        if (adv.done) this.downedMode = 'idle';
      } else if (idle) {
        const adv = advanceClip(idle, this.downedTime, dt);
        this.downedTime = adv.time;
      }
      return;
    }

    if (opts.isMoving) {
      const steps = (walk.meta.steps_per_s ?? 1.9) * opts.moveSpeedMult;
      this.walkPhase += dt * steps;
    } else {
      this.walkPhase = 0;
    }
  }

  private drawWalkFrame(
    ctx: CanvasRenderingContext2D,
    drawSize: number,
    angle: number,
    cx: number,
    cy: number
  ) {
    const { walk } = this.sheets;
    const refW = walk.meta.frame_width;
    const pivot = pivotWalk(walk.meta);
    const frameCount = walk.meta.frames;
    const frame =
      this.walkPhase <= 0 ? 0 : Math.floor(this.walkPhase * frameCount) % frameCount;
    drawSheetFrame(
      ctx,
      walk.image,
      frame,
      walk.meta.frame_width,
      walk.meta.frame_height,
      0,
      pivot,
      drawSize,
      refW,
      angle,
      cx,
      cy
    );
  }

  draw(ctx: CanvasRenderingContext2D, drawSize: number, angle: number, cx: number, cy: number) {
    const { walk, downed, recoil, hit, attack } = this.sheets;
    const refW = walk.meta.frame_width;

    if (this.hitActive && hit) {
      const clip = hit.meta.clips[0];
      const adv = advanceClip(clip, this.hitTime, 0);
      this.drawWalkFrame(ctx, drawSize, angle, cx, cy);
      ctx.save();
      ctx.globalAlpha = adv.frame < 2 ? 0.55 : 0.25;
      drawSheetFrame(
        ctx,
        hit.image,
        adv.frame,
        hit.meta.frame_width,
        hit.meta.frame_height,
        0,
        pivotSimple(hit.meta, walk.meta),
        drawSize,
        refW,
        angle,
        cx,
        cy
      );
      ctx.restore();
      return;
    }

    if (this.downedMode !== 'up' && downed) {
      const fall = downed.meta.clips.find(c => c.name === 'downed');
      const idle = downed.meta.clips.find(c => c.name === 'downed_idle');
      let clip = fall;
      const time = this.downedTime;
      if (this.downedMode === 'idle') clip = idle;
      if (!clip) return;
      const adv = advanceClip(clip, time, 0);
      drawSheetFrame(
        ctx,
        downed.image,
        adv.frame,
        downed.meta.cell_width,
        downed.meta.cell_height,
        clip.row ?? 0,
        pivotMulti(downed.meta),
        drawSize,
        refW,
        angle,
        cx,
        cy
      );
      return;
    }

    if (this.attackActive && attack) {
      const clip = attack.meta.clips[0];
      const adv = advanceClip(clip, this.attackTime, 0);
      const meta = attack.meta;
      const cellW = 'cell_width' in meta ? meta.cell_width : meta.frame_width;
      const cellH = 'cell_height' in meta ? meta.cell_height : meta.frame_height;
      const pv =
        'pivot_cell_px' in meta && meta.pivot_cell_px
          ? meta.pivot_cell_px
          : pivotWalk(walk.meta);
      drawSheetFrame(ctx, attack.image, adv.frame, cellW, cellH, clip.row ?? 0, pv, drawSize, refW, angle, cx, cy);
      return;
    }

    this.drawWalkFrame(ctx, drawSize, angle, cx, cy);

    if (this.recoilActive && recoil) {
      const clip = recoil.meta.clips[0];
      const adv = advanceClip(clip, this.recoilTime, 0);
      drawSheetFrame(
        ctx,
        recoil.image,
        adv.frame,
        recoil.meta.frame_width,
        recoil.meta.frame_height,
        0,
        pivotSimple(recoil.meta, walk.meta),
        drawSize,
        refW,
        angle,
        cx,
        cy
      );
    }
  }
}
