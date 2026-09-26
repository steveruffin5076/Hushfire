/** Collapse + downed idle animation (ported from `downed_rig.js` at repo root). */

import type { TopDownWalkRig } from './TopDownWalkRig';
import { WALK_RIG_DEFAULTS } from './TopDownWalkRig';

export interface DownedRigOptions {
  splitX?: number;
  feather?: number;
  torsoPivot?: [number, number];
  gripPivot?: [number, number];
}

type RigState = 'standing' | 'falling' | 'downed';
type Mat6 = [number, number, number, number, number, number];

const ROT: [number[], number[]] = [[0, 0.12, 0.5, 0.9], [0, -6, 99, 92]];
const SCL: [number[], number[]] = [[0, 0.45, 0.9], [1, 1.06, 1.03]];
const DRF: [number[], number[]] = [[0, 0.55], [0, 7]];
const WROT: [number[], number[]] = [[0, 0.18, 0.6, 0.78, 0.9], [0, 0, -9, -7.5, -8]];
const WDX: [number[], number[]] = [[0, 0.18, 0.6, 0.78, 0.9], [0, 0, 3, 4.2, 4]];
const WDY: [number[], number[]] = [[0, 0.18, 0.6, 0.9], [0, 0, 6, 6]];
const DESAT: [number[], number[]] = [[0, 0.3, 0.9], [0, 0, 0.55]];
const BRI: [number[], number[]] = [[0, 0.3, 0.9], [1, 1, 0.85]];

const T_REL = 0.18;
const SHOT_T = 0.9;
const IDLE_PERIOD = 2.0;
const IMPACT_T = 0.45;

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function kf(kv: [number[], number[]], t: number): number {
  const k = kv[0];
  const v = kv[1];
  if (t <= k[0]) return v[0];
  if (t >= k[k.length - 1]) return v[v.length - 1];
  for (let i = 0; i < k.length - 1; i++) {
    if (t >= k[i] && t <= k[i + 1]) {
      const u = smoothstep((t - k[i]) / (k[i + 1] - k[i]));
      return v[i] + (v[i + 1] - v[i]) * u;
    }
  }
  return v[v.length - 1];
}

function mul(A: Mat6, B: Mat6): Mat6 {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],
    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5]
  ];
}

function T(x: number, y: number): Mat6 {
  return [1, 0, x, 0, 1, y];
}

function R(d: number): Mat6 {
  const r = (d * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, -s, 0, s, c, 0];
}

function S(k: number): Mat6 {
  return [k, 0, 0, 0, k, 0];
}

function around(p: [number, number], m: Mat6): Mat6 {
  return mul(mul(T(p[0], p[1]), m), T(-p[0], -p[1]));
}

function deco(M: Mat6) {
  return { ang: Math.atan2(M[3], M[0]), k: Math.hypot(M[0], M[3]), t: [M[2], M[5]] as [number, number] };
}

function reco(d: ReturnType<typeof deco>): Mat6 {
  const c = Math.cos(d.ang) * d.k;
  const s = Math.sin(d.ang) * d.k;
  return [c, -s, d.t[0], s, c, d.t[1]];
}

function lerpD(A: ReturnType<typeof deco>, B: ReturnType<typeof deco>, u: number) {
  const dd = ((B.ang - A.ang + Math.PI) % (2 * Math.PI)) - Math.PI;
  return {
    ang: A.ang + dd * u,
    k: A.k + (B.k - A.k) * u,
    t: [A.t[0] + (B.t[0] - A.t[0]) * u, A.t[1] + (B.t[1] - A.t[1]) * u] as [number, number]
  };
}

export class TopDownDownedRig {
  readonly o: Required<DownedRigOptions>;
  state: RigState = 'standing';
  t = 0;
  idle = 0;
  impacted = false;
  onImpact: (() => void) | null = null;

  body!: HTMLCanvasElement;
  weapon!: HTMLCanvasElement;
  srcW = 0;
  srcH = 0;

  private _k = 1;
  private _rel: { M: Mat6; pg: [number, number] } | null = null;

  constructor(opts?: DownedRigOptions) {
    this.o = {
      splitX: WALK_RIG_DEFAULTS.splitX,
      feather: WALK_RIG_DEFAULTS.feather,
      torsoPivot: WALK_RIG_DEFAULTS.torsoPivot,
      gripPivot: WALK_RIG_DEFAULTS.gripPivot,
      ...opts
    };
  }

  trigger() {
    this.state = 'falling';
    this.t = 0;
    this.impacted = false;
    this._rel = null;
  }

  standUp() {
    this.state = 'standing';
    this.t = 0;
    this.idle = 0;
    this._rel = null;
  }

  update(dt: number) {
    if (this.state === 'falling') {
      this.t += dt;
      if (!this.impacted && this.t >= IMPACT_T) {
        this.impacted = true;
        this.onImpact?.();
      }
      if (this.t >= SHOT_T) {
        this.state = 'downed';
        this.idle = 0;
      }
    } else if (this.state === 'downed') {
      this.idle += dt;
    }
  }

  private bodyM(t: number, scl: number, tp: [number, number]): Mat6 {
    return mul(T(0, kf(DRF, t) * this._k), around(tp, mul(R(kf(ROT, t)), S(scl))));
  }

  private weaponM(t: number, Mb: Mat6, tp: [number, number], gp: [number, number]): Mat6 {
    if (t <= T_REL) return Mb;
    if (!this._rel) {
      const Mrel = this.bodyM(T_REL, kf(SCL, T_REL), tp);
      const pg: [number, number] = [
        Mrel[0] * gp[0] + Mrel[1] * gp[1] + Mrel[2],
        Mrel[3] * gp[0] + Mrel[4] * gp[1] + Mrel[5]
      ];
      this._rel = { M: Mrel, pg };
    }
    const Mf = mul(
      T(kf(WDX, t) * this._k, kf(WDY, t) * this._k),
      mul(around(this._rel.pg, R(kf(WROT, t))), this._rel.M)
    );
    const b = smoothstep((t - T_REL) / 0.12);
    if (b >= 1) return Mf;
    return reco(lerpD(deco(Mb), deco(Mf), b));
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, facing: number) {
    const o = this.o;
    const h = w * this.srcH / this.srcW;
    this._k = w / 256;
    const tp: [number, number] = [-w / 2 + o.torsoPivot[0] * w, -h / 2 + o.torsoPivot[1] * h];
    const gp: [number, number] = [-w / 2 + o.gripPivot[0] * w, -h / 2 + o.gripPivot[1] * h];

    let t: number;
    let scl: number;
    let ds: number;
    let br: number;

    if (this.state === 'standing') {
      t = -1;
      scl = 1;
      ds = 0;
      br = 1;
    } else if (this.state === 'falling') {
      t = this.t;
      scl = kf(SCL, t);
      ds = kf(DESAT, t);
      br = kf(BRI, t);
    } else {
      t = 9;
      scl = 1.03 + 0.0035 * Math.sin((2 * Math.PI * this.idle) / IDLE_PERIOD);
      ds = 0.55;
      br = 0.85;
    }

    let Mb: Mat6;
    let Mw: Mat6;
    if (t < 0) {
      Mb = T(0, 0);
      Mw = T(0, 0);
    } else if (t >= 9) {
      Mb = this.bodyM(9, scl, tp);
      Mw = this.weaponM(9, this.bodyM(9, kf(SCL, 9), tp), tp, gp);
    } else {
      Mb = this.bodyM(t, scl, tp);
      Mw = this.weaponM(t, Mb, tp, gp);
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (facing) ctx.rotate(facing);
    if (ds > 0 && 'filter' in ctx) {
      (ctx as CanvasRenderingContext2D & { filter: string }).filter =
        `saturate(${1 - ds}) brightness(${br})`;
    }
    ctx.save();
    ctx.transform(Mb[0], Mb[3], Mb[1], Mb[4], Mb[2], Mb[5]);
    ctx.drawImage(this.body, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.save();
    ctx.transform(Mw[0], Mw[3], Mw[1], Mw[4], Mw[2], Mw[5]);
    ctx.drawImage(this.weapon, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.restore();
  }
}

/** Reuses body/weapon layers from the walk rig (same infiltrator split). */
export function createTopDownDownedRigFromWalk(walk: TopDownWalkRig): TopDownDownedRig {
  const rig = new TopDownDownedRig({
    splitX: walk.o.splitX,
    feather: walk.o.feather,
    torsoPivot: walk.o.torsoPivot,
    gripPivot: walk.o.gripPivot
  });
  rig.body = walk.body;
  rig.weapon = walk.weapon;
  rig.srcW = walk.srcW;
  rig.srcH = walk.srcH;
  return rig;
}
