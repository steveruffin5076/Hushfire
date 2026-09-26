/*DOWNED-START*/
/* DownedRig — one-shot collapse + looping downed-idle for a top-down sprite.
   t=0 hit, t=.12 stagger(-6deg), t=.18 weapon leaves hands (free spin/slide),
   t=.50 ground impact (overshoot ~99deg, scale pop), t=.90 settled @92deg +desat.
   Same layer split as TopDownWalkRig; amplitudes in px @256 draw width.      */
(function (global) {
  'use strict';
  var ROT = [[0, .12, .5, .9], [0, -6, 99, 92]], SCL = [[0, .45, .9], [1, 1.06, 1.03]],
      DRF = [[0, .55], [0, 7]], WROT = [[0, .18, .6, .78, .9], [0, 0, -9, -7.5, -8]],
      WDX = [[0, .18, .6, .78, .9], [0, 0, 3, 4.2, 4]], WDY = [[0, .18, .6, .9], [0, 0, 6, 6]],
      DESAT = [[0, .3, .9], [0, 0, .55]], BRI = [[0, .3, .9], [1, 1, .85]],
      T_REL = .18, SHOT_T = .9, IDLE_PERIOD = 2.0, IMPACT_T = .45;
  var DEF = { splitX: .485, feather: .015, torsoPivot: [.376, .466], gripPivot: [.604, .494] };
  function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
  function kf(kv, t) {
    var k = kv[0], v = kv[1];
    if (t <= k[0]) return v[0]; if (t >= k[k.length - 1]) return v[v.length - 1];
    for (var i = 0; i < k.length - 1; i++) if (t >= k[i] && t <= k[i + 1]) {
      var u = smooth((t - k[i]) / (k[i + 1] - k[i])); return v[i] + (v[i + 1] - v[i]) * u;
    }
    return v[v.length - 1];
  }
  /* 3x3 matrices as [a,b,c,d,e,f] = [[a,b,c],[d,e,f],[0,0,1]] */
  function mul(A, B) {
    return [A[0]*B[0]+A[1]*B[3], A[0]*B[1]+A[1]*B[4], A[0]*B[2]+A[1]*B[5]+A[2],
            A[3]*B[0]+A[4]*B[3], A[3]*B[1]+A[4]*B[4], A[3]*B[2]+A[4]*B[5]+A[5], 0, 0, 1];
  }
  function T(x, y) { return [1, 0, x, 0, 1, y]; }
  function R(d) { var r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, -s, 0, s, c, 0]; }
  function S(k) { return [k, 0, 0, 0, k, 0]; }
  function around(p, m) { return mul(mul(T(p[0], p[1]), m), T(-p[0], -p[1])); }
  function deco(M) { return { ang: Math.atan2(M[3], M[0]), k: Math.hypot(M[0], M[3]), t: [M[2], M[5]] }; }
  function reco(d) { var c = Math.cos(d.ang) * d.k, s = Math.sin(d.ang) * d.k;
    return [c, -s, d.t[0], s, c, d.t[1]]; }
  function lerpD(A, B, u) {
    var dd = (B.ang - A.ang + Math.PI) % (2 * Math.PI) - Math.PI;
    return { ang: A.ang + dd * u, k: A.k + (B.k - A.k) * u,
             t: [A.t[0] + (B.t[0] - A.t[0]) * u, A.t[1] + (B.t[1] - A.t[1]) * u] };
  }
  function Rig(o) { this.o = o; this.state = 'standing'; this.t = 0; this.idle = 0;
    this.impacted = false; this.onImpact = null; this._rel = null; }
  Rig.prototype.trigger = function () { this.state = 'falling'; this.t = 0; this.impacted = false; };
  Rig.prototype.standUp = function () { this.state = 'standing'; this.t = 0; this.idle = 0; };
  Rig.prototype.update = function (dt) {
    if (this.state === 'falling') {
      this.t += dt;
      if (!this.impacted && this.t >= IMPACT_T) { this.impacted = true; if (this.onImpact) this.onImpact(); }
      if (this.t >= SHOT_T) { this.state = 'downed'; this.idle = 0; }
    } else if (this.state === 'downed') this.idle += dt;
  };
  Rig.prototype._bodyM = function (t, scl, tp) {
    return mul(T(0, kf(DRF, t) * this._k), around(tp, mul(R(kf(ROT, t)), S(scl))));
  };
  Rig.prototype._weaponM = function (t, Mb, tp, gp) {
    if (t <= T_REL) return Mb;
    if (!this._rel) {
      var Mrel = this._bodyM(T_REL, kf(SCL, T_REL), tp);
      var pg = [Mrel[0] * gp[0] + Mrel[1] * gp[1] + Mrel[2], Mrel[3] * gp[0] + Mrel[4] * gp[1] + Mrel[5]];
      this._rel = { M: Mrel, pg: pg };
    }
    var Mf = mul(T(kf(WDX, t) * this._k, kf(WDY, t) * this._k),
                 mul(around(this._rel.pg, R(kf(WROT, t))), this._rel.M));
    var b = smooth((t - T_REL) / .12);
    if (b >= 1) return Mf;
    return reco(lerpD(deco(Mb), deco(Mf), b));
  };
  Rig.prototype.draw = function (ctx, cx, cy, w, facing) {
    var o = this.o, h = w * this.srcH / this.srcW, k = this._k = w / 256;
    var tp = [-w / 2 + o.torsoPivot[0] * w, -h / 2 + o.torsoPivot[1] * h];
    var gp = [-w / 2 + o.gripPivot[0] * w, -h / 2 + o.gripPivot[1] * h];
    var t, scl, ds, br;
    if (this.state === 'standing') { t = -1; scl = 1; ds = 0; br = 1; }
    else if (this.state === 'falling') { t = this.t; scl = kf(SCL, t); ds = kf(DESAT, t); br = kf(BRI, t); }
    else { t = 9; scl = 1.03 + .0035 * Math.sin(2 * Math.PI * this.idle / IDLE_PERIOD); ds = .55; br = .85; }
    var Mb, Mw;
    if (t < 0) { Mb = Mw = T(0, 0); }
    else if (t >= 9) { Mb = this._bodyM(9, scl, tp); Mw = this._weaponM(9, this._bodyM(9, kf(SCL, 9), tp), tp, gp); }
    else { Mb = this._bodyM(t, scl, tp); Mw = this._weaponM(t, Mb, tp, gp); }
    ctx.save();
    ctx.translate(cx, cy); if (facing) ctx.rotate(facing);
    if (ds > 0 && 'filter' in ctx) ctx.filter = 'saturate(' + (1 - ds) + ') brightness(' + br + ')';
    ctx.save(); ctx.transform(Mb[0], Mb[3], Mb[1], Mb[4], Mb[2], Mb[5]);
    ctx.drawImage(this.body, -w / 2, -h / 2, w, h); ctx.restore();
    ctx.save(); ctx.transform(Mw[0], Mw[3], Mw[1], Mw[4], Mw[2], Mw[5]);
    ctx.drawImage(this.weapon, -w / 2, -h / 2, w, h); ctx.restore();
    ctx.restore();
  };
  Rig.create = function (src, opts) {
    var o = {}; for (var k in DEF) o[k] = DEF[k]; for (var k2 in (opts || {})) o[k2] = opts[k2];
    var W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
    var px = g.getImageData(0, 0, W, H).data;
    var hasAlpha = false;
    for (var i = 3; i < px.length; i += 997 * 4) if (px[i] < 250) { hasAlpha = true; break; }
    var body = document.createElement('canvas'), wep = document.createElement('canvas');
    body.width = wep.width = W; body.height = wep.height = H;
    var bd = g.createImageData(W, H), wd = g.createImageData(W, H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var j = (y * W + x) * 4, lum = Math.max(px[j], px[j + 1], px[j + 2]);
      var a = hasAlpha ? px[j + 3] / 255 : smooth((lum - 8) / 18);
      if (!hasAlpha && a < .22) a = 0;
      var div = hasAlpha ? 1 : Math.min(1, Math.max(.45, a));
      var wgt = smooth((x - o.splitX * W) / (o.feather * W) + .5);
      var r = Math.min(255, px[j] / div), gg = Math.min(255, px[j + 1] / div), b = Math.min(255, px[j + 2] / div);
      bd.data[j] = wd.data[j] = r; bd.data[j+1] = wd.data[j+1] = gg; bd.data[j+2] = wd.data[j+2] = b;
      bd.data[j+3] = 255 * a * (1 - wgt); wd.data[j+3] = 255 * a * wgt;
    }
    body.getContext('2d').putImageData(bd, 0, 0); wep.getContext('2d').putImageData(wd, 0, 0);
    var rig = new Rig(o); rig.body = body; rig.weapon = wep; rig.srcW = W; rig.srcH = H;
    return Promise.resolve(rig);
  };
  var API = { create: Rig.create, timing: { SHOT_T: SHOT_T, IMPACT_T: IMPACT_T,
    IDLE_PERIOD: IDLE_PERIOD, SHOT_FRAMES: 12, SHOT_MS: 75, IDLE_FRAMES: 4, IDLE_MS: 500 } };
  global.DownedRig = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : this);
