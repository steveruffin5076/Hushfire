import type { ClipDef, MultiClipSheetMeta, SimpleClipSheetMeta, WalkSheetMeta } from './sheetTypes';
import { drawSheetFrame } from './drawSheetFrame';

export interface CharacterSheetSet {
  walk: { image: HTMLImageElement; meta: WalkSheetMeta };
  idle?: { image: HTMLImageElement; meta: SimpleClipSheetMeta };
  downed?: { image: HTMLImageElement; meta: MultiClipSheetMeta };
  recoil?: { image: HTMLImageElement; meta: SimpleClipSheetMeta };
  hit?: { image: HTMLImageElement; meta: SimpleClipSheetMeta };
  attack?: { image: HTMLImageElement; meta: MultiClipSheetMeta | SimpleClipSheetMeta };
}

/** Per-weapon baked sheets under `player_infiltrator/loadouts/<id>/`. */
export interface OperativeLoadoutPack {
  walk: CharacterSheetSet['walk'];
  idle?: CharacterSheetSet['idle'];
  recoil?: CharacterSheetSet['recoil'];
  hit?: CharacterSheetSet['hit'];
  attack?: CharacterSheetSet['attack'];
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

export interface CharacterDrawOpts {
  /** Drawn weapon is melee (knife sheet idle + slash instead of gun walk). */
  meleeStance?: boolean;
}

/** Runtime playback for one entity using baked sheets. */
export class CharacterAnimController {
  walkPhase = 0;
  idleTime = 0;
  downedMode: 'up' | 'falling' | 'idle' = 'up';
  downedTime = 0;
  recoilTime = 0;
  recoilActive = false;
  attackTime = 0;
  attackActive = false;
  wasDowned = false;
  private lastWalkFrame = -1;
  /** Fires when the walk sheet enters a `footfall_frames` index (pack JSON). */
  onFootfall?: (frameIndex: number) => void;

  /** Knife `attack_sheet` while a gun loadout is active (quick melee [E]). */
  private quickMeleeAttack?: CharacterSheetSet['attack'];

  constructor(private sheets: CharacterSheetSet) {}

  /** Swap walk / idle / recoil / attack for Operative 1 weapon loadouts. */
  applyOperativeLoadout(
    pack: OperativeLoadoutPack,
    sharedHit?: CharacterSheetSet['hit'],
    quickMeleeAttack?: CharacterSheetSet['attack']
  ) {
    this.sheets.walk = pack.walk;
    this.sheets.idle = pack.idle;
    this.sheets.recoil = pack.recoil;
    this.sheets.attack = pack.attack;
    this.sheets.hit = pack.hit ?? sharedHit;
    this.quickMeleeAttack = quickMeleeAttack;
  }

  setQuickMeleeAttack(sheet?: CharacterSheetSet['attack']) {
    this.quickMeleeAttack = sheet;
  }

  private attackSheet(): CharacterSheetSet['attack'] | undefined {
    return this.sheets.attack ?? this.quickMeleeAttack;
  }

  triggerRecoil() {
    if (!this.sheets.recoil) return;
    this.recoilActive = true;
    this.recoilTime = 0;
  }

  hasAttackSheet(): boolean {
    return !!this.attackSheet();
  }

  isAttackActive(): boolean {
    return this.attackActive;
  }

  triggerAttack() {
    if (!this.attackSheet()) return;
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
    const { walk, downed, recoil, idle } = this.sheets;
    const attack = this.attackSheet();

    if (opts.isDowned && !this.wasDowned && downed) {
      this.downedMode = 'falling';
      this.downedTime = 0;
    }
    if (!opts.isDowned && this.wasDowned) {
      this.downedMode = 'up';
      this.downedTime = 0;
    }
    this.wasDowned = opts.isDowned;

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

    const frameCount = walk.meta.frames;
    if (opts.isMoving) {
      const steps = (walk.meta.steps_per_s ?? 1.9) * opts.moveSpeedMult;
      this.walkPhase += dt * steps;
      const frame = Math.floor(this.walkPhase * frameCount) % frameCount;
      if (frame !== this.lastWalkFrame) {
        const hits = walk.meta.footfall_frames ?? [];
        if (hits.includes(frame)) this.onFootfall?.(frame);
        this.lastWalkFrame = frame;
      }
    } else {
      this.walkPhase = 0;
      this.lastWalkFrame = -1;
      if (idle) {
        const clip = idle.meta.clips[0];
        const adv = advanceClip(clip, this.idleTime, dt);
        this.idleTime = adv.time;
      } else {
        this.idleTime = 0;
      }
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

  private drawClipFrame(
    ctx: CanvasRenderingContext2D,
    sheet: {
      image: HTMLImageElement;
      meta: SimpleClipSheetMeta | MultiClipSheetMeta;
    },
    frameIndex: number,
    drawSize: number,
    refW: number,
    angle: number,
    cx: number,
    cy: number
  ) {
    const { walk } = this.sheets;
    const meta = sheet.meta;
    const cellW = 'cell_width' in meta ? meta.cell_width : meta.frame_width;
    const cellH = 'cell_height' in meta ? meta.cell_height : meta.frame_height;
    drawSheetFrame(
      ctx,
      sheet.image,
      frameIndex,
      cellW,
      cellH,
      0,
      pivotSimple(meta as SimpleClipSheetMeta, walk.meta),
      drawSize,
      refW,
      angle,
      cx,
      cy
    );
  }

  private drawIdleFrame(
    ctx: CanvasRenderingContext2D,
    drawSize: number,
    angle: number,
    cx: number,
    cy: number
  ) {
    const idle = this.sheets.idle;
    if (!idle) {
      this.drawWalkFrame(ctx, drawSize, angle, cx, cy);
      return;
    }
    const clip = idle.meta.clips[0];
    const adv = advanceClip(clip, this.idleTime, 0);
    const refW = this.sheets.walk.meta.frame_width;
    this.drawClipFrame(ctx, idle, adv.frame, drawSize, refW, angle, cx, cy);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    drawSize: number,
    angle: number,
    cx: number,
    cy: number,
    opts?: CharacterDrawOpts
  ) {
    const { walk, downed, recoil } = this.sheets;
    const attack = this.attackSheet();
    const refW = walk.meta.frame_width;

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

    const knifeEquipped = !!opts?.meleeStance && !!attack;
    if (knifeEquipped) {
      if (this.attackActive && attack) {
        const clip = attack.meta.clips[0];
        const adv = advanceClip(clip, this.attackTime, 0);
        this.drawClipFrame(ctx, attack, adv.frame, drawSize, refW, angle, cx, cy);
      } else {
        this.drawIdleFrame(ctx, drawSize, angle, cx, cy);
      }
      return;
    }

    const moving = this.walkPhase > 0;
    if (moving) {
      this.drawWalkFrame(ctx, drawSize, angle, cx, cy);
    } else {
      this.drawIdleFrame(ctx, drawSize, angle, cx, cy);
    }

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
