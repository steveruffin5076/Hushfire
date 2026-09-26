/** Procedural top-down walk cycle (ported from `walk_rig.js` at repo root). */

export interface WalkRigOptions {
  splitX?: number;
  feather?: number;
  torsoPivot?: [number, number];
  gripPivot?: [number, number];
  sway?: number;
  surge?: number;
  bob?: number;
  rollDeg?: number;
  weaponRotDeg?: number;
  weaponSway?: number;
  lagRad?: number;
  stepsPerSec?: number;
}

export const WALK_RIG_DEFAULTS: Required<WalkRigOptions> = {
  splitX: 0.485,
  feather: 0.015,
  torsoPivot: [0.376, 0.466],
  gripPivot: [0.604, 0.494],
  sway: 1.6,
  surge: 1.1,
  bob: 0.007,
  rollDeg: 0.8,
  weaponRotDeg: 1.25,
  weaponSway: 0.5,
  lagRad: 0.7,
  stepsPerSec: 1.9
};

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export class TopDownWalkRig {
  readonly o: Required<WalkRigOptions>;
  phase = 0;
  body!: HTMLCanvasElement;
  weapon!: HTMLCanvasElement;
  srcW = 0;
  srcH = 0;
  showPivots = false;
  onStep: ((foot: 0 | 1) => void) | null = null;

  private _step = 0;

  constructor(opts?: WalkRigOptions) {
    this.o = { ...WALK_RIG_DEFAULTS, ...opts };
  }

  update(dt: number): -1 | 0 | 1 {
    this.phase += dt * Math.PI * this.o.stepsPerSec;
    const idx = Math.floor(this.phase / Math.PI);
    if (idx !== this._step) {
      this._step = idx;
      const foot = (idx % 2) as 0 | 1;
      this.onStep?.(foot);
      return foot;
    }
    return -1;
  }

  private state() {
    const p = this.phase;
    const s = Math.sin(p);
    const lift = Math.sin(p) * Math.sin(p);
    const sl = Math.sin(p - this.o.lagRad);
    return { s, lift, sl };
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, facing: number) {
    const o = this.o;
    const k = w / 256;
    const h = w * this.srcH / this.srcW;
    const st = this.state();
    const tp = [-w / 2 + o.torsoPivot[0] * w, -h / 2 + o.torsoPivot[1] * h];
    const gp = [-w / 2 + o.gripPivot[0] * w, -h / 2 + o.gripPivot[1] * h];

    ctx.save();
    ctx.translate(cx, cy);
    if (facing) ctx.rotate(facing);
    ctx.translate(o.surge * k * st.lift, o.sway * k * st.s);
    ctx.translate(tp[0], tp[1]);
    ctx.rotate((o.rollDeg * Math.PI / 180) * st.s);
    const b = 1 + o.bob * st.lift;
    ctx.scale(b, b);
    ctx.translate(-tp[0], -tp[1]);
    ctx.drawImage(this.body, -w / 2, -h / 2, w, h);
    if (this.showPivots) this.pivotDot(ctx, 0, 0, '#7fd4ff');
    ctx.translate(gp[0], gp[1]);
    ctx.rotate((o.weaponRotDeg * Math.PI / 180) * st.sl);
    ctx.translate(0, o.weaponSway * k * st.sl);
    ctx.translate(-gp[0], -gp[1]);
    ctx.drawImage(this.weapon, -w / 2, -h / 2, w, h);
    if (this.showPivots) this.pivotDot(ctx, 0, 0, '#ff7fb1');
    ctx.restore();
  }

  private pivotDot(ctx: CanvasRenderingContext2D, x: number, y: number, col: string) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.restore();
  }
}

/** Split a single overhead sprite into body + weapon layers and return a rig. */
export function createTopDownWalkRig(src: CanvasImageSource, opts?: WalkRigOptions): TopDownWalkRig {
  const o = { ...WALK_RIG_DEFAULTS, ...opts };
  const W = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const H = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('2d context unavailable');
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, W, H);
  const px = d.data;

  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 997 * 4) {
    if (px[i] < 250) {
      hasAlpha = true;
      break;
    }
  }

  const body = document.createElement('canvas');
  const wep = document.createElement('canvas');
  body.width = wep.width = W;
  body.height = wep.height = H;
  const bd = g.createImageData(W, H);
  const wd = g.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4;
      const lum = Math.max(px[j], px[j + 1], px[j + 2]);
      let a = hasAlpha ? px[j + 3] / 255 : smoothstep((lum - 8) / 18);
      if (!hasAlpha && a < 0.22) a = 0;
      const div = hasAlpha ? 1 : Math.min(1, Math.max(0.45, a));
      const w = smoothstep((x - o.splitX * W) / (o.feather * W) + 0.5);
      const r = Math.min(255, px[j] / div);
      const gg = Math.min(255, px[j + 1] / div);
      const b = Math.min(255, px[j + 2] / div);
      bd.data[j] = wd.data[j] = r;
      bd.data[j + 1] = wd.data[j + 1] = gg;
      bd.data[j + 2] = wd.data[j + 2] = b;
      bd.data[j + 3] = Math.round(255 * a * (1 - w));
      wd.data[j + 3] = Math.round(255 * a * w);
    }
  }

  body.getContext('2d')!.putImageData(bd, 0, 0);
  wep.getContext('2d')!.putImageData(wd, 0, 0);

  const rig = new TopDownWalkRig(o);
  rig.body = body;
  rig.weapon = wep;
  rig.srcW = W;
  rig.srcH = H;
  return rig;
}
