/*RIG-START*/
/* TopDownWalkRig — procedural top-down walk cycle for a single overhead sprite.
   One stride phase phi in [0,2pi); footfalls at phi=0 (left) and phi=pi (right).
     sway   lateral lean over the stance foot      : sin(phi)
     surge  forward drive between impacts          : sin(phi)^2
     bob    top-down "height" = scale pulse        : sin(phi)^2
     roll   shoulder roll / yaw swing per step     : sin(phi)
     weapon extra whip+drift, phase-lagged         : sin(phi - lag), rotated about the grip
   Amplitudes in px at a 256 px draw width; rotations in degrees.           */
(function (global) {
  'use strict';
  var DEF = {
    splitX: 0.485, feather: 0.015,                 // body/weapon cut, fraction of width
    torsoPivot: [0.376, 0.466], gripPivot: [0.604, 0.494],   // fractions of sprite w/h
    sway: 1.6, surge: 1.1, bob: 0.007, rollDeg: 0.8,
    weaponRotDeg: 1.25, weaponSway: 0.5, lagRad: 0.70,
    stepsPerSec: 1.9
  };
  function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

  function Rig(o) {
    this.o = o; this.phase = 0; this._step = 0; this.onStep = null;
    this.showPivots = false; this.debugTint = null;   // debugTint: [bodyColor, weaponColor]
  }
  Rig.prototype.update = function (dt) {
    this.phase += dt * Math.PI * this.o.stepsPerSec;   // 2 steps per 2pi
    var idx = Math.floor(this.phase / Math.PI);
    if (idx !== this._step) { this._step = idx; if (this.onStep) this.onStep(idx % 2); return idx % 2; }
    return -1;
  };
  Rig.prototype.state = function () {
    var p = this.phase, s = Math.sin(p), lift = Math.sin(p) * Math.sin(p), sl = Math.sin(p - this.o.lagRad);
    return { s: s, lift: lift, sl: sl };
  };
  Rig.prototype.draw = function (ctx, cx, cy, w, facing) {
    var o = this.o, k = w / 256, h = w * this.srcH / this.srcW, st = this.state();
    var tp = [-w / 2 + o.torsoPivot[0] * w, -h / 2 + o.torsoPivot[1] * h];
    var gp = [-w / 2 + o.gripPivot[0] * w, -h / 2 + o.gripPivot[1] * h];
    var body = this.debugTint ? this._bodyT : this.body;
    var wep  = this.debugTint ? this._wepT  : this.weapon;
    ctx.save();
    ctx.translate(cx, cy); if (facing) ctx.rotate(facing);
    ctx.translate(o.surge * k * st.lift, o.sway * k * st.s);          // sway: lateral = local +y
    ctx.translate(tp[0], tp[1]);
    ctx.rotate(o.rollDeg * Math.PI / 180 * st.s);                     // shoulder roll
    var b = 1 + o.bob * st.lift; ctx.scale(b, b);                     // camera bob
    ctx.translate(-tp[0], -tp[1]);
    ctx.drawImage(body, -w / 2, -h / 2, w, h);
    if (this.showPivots) pivotDot(ctx, 0, 0, '#7fd4ff');
    ctx.translate(gp[0], gp[1]);                                      // weapon: lagged whip
    ctx.rotate(o.weaponRotDeg * Math.PI / 180 * st.sl);
    ctx.translate(0, o.weaponSway * k * st.sl);
    ctx.translate(-gp[0], -gp[1]);
    ctx.drawImage(wep, -w / 2, -h / 2, w, h);
    if (this.showPivots) pivotDot(ctx, 0, 0, '#ff7fb1');
    ctx.restore();
  };
  function pivotDot(ctx, x, y, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(x, y, 5, 0, 6.2832); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke(); ctx.restore();
  }
  function tint(src, color) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /* Bake N frames into a horizontal strip (same maths as the offline python baker). */
  function bakeSheet(rig, frames, frameWidth, pad) {
    pad = pad == null ? Math.round(frameWidth * 22 / 512) : pad;
    var ch = Math.round(frameWidth * rig.srcH / rig.srcW) + 2 * pad;
    var cw = frameWidth + 2 * pad;
    var out = document.createElement('canvas'); out.width = cw * frames; out.height = ch;
    var g = out.getContext('2d');
    var keep = { sway: rig.o.sway, surge: rig.o.surge, bob: rig.o.bob,
                 rollDeg: rig.o.rollDeg, weaponRotDeg: rig.o.weaponRotDeg,
                 weaponSway: rig.o.weaponSway, lagRad: rig.o.lagRad, phase: rig.phase };
    for (var i = 0; i < frames; i++) {
      rig.phase = 2 * Math.PI * i / frames;
      g.save(); g.translate(i * cw + cw / 2, ch / 2);
      rig.draw(g, 0, 0, frameWidth, 0);
      g.restore();
    }
    rig.o.sway = keep.sway; rig.o.surge = keep.surge; rig.o.bob = keep.bob;
    rig.o.rollDeg = keep.rollDeg; rig.o.weaponRotDeg = keep.weaponRotDeg;
    rig.o.weaponSway = keep.weaponSway; rig.o.lagRad = keep.lagRad; rig.phase = keep.phase;
    return { canvas: out,
      meta: { frame_width: cw, frame_height: ch, sprite_width: frameWidth, frames: frames,
              layout: 'row', stride_steps: 2, footfall_frames: [0, frames >> 1],
              pivots_cell_px: { torso: [pad + rig.o.torsoPivot[0] * frameWidth, pad + rig.o.torsoPivot[1] * frameWidth * rig.srcH / rig.srcW],
                                grip:  [pad + rig.o.gripPivot[0] * frameWidth,  pad + rig.o.gripPivot[1] * frameWidth * rig.srcH / rig.srcW] },
              amplitudes_at_256w: { sway: rig.o.sway, surge: rig.o.surge, bob: rig.o.bob,
                                    roll_deg: rig.o.rollDeg, weapon_rot_deg: rig.o.weaponRotDeg,
                                    weapon_sway: rig.o.weaponSway, lag_rad: rig.o.lagRad } } };
  }
  /* Build body/weapon layers from the source image (keys out a black bg if present). */
  Rig.create = function (src, opts) {
    var o = {}; for (var k in DEF) o[k] = DEF[k]; for (var k2 in (opts || {})) o[k2] = opts[k2];
    var W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
    var d = g.getImageData(0, 0, W, H), px = d.data;
    var hasAlpha = false;
    for (var i = 3; i < px.length; i += 997 * 4) if (px[i] < 250) { hasAlpha = true; break; }
    var body = document.createElement('canvas'), wep = document.createElement('canvas');
    body.width = wep.width = W; body.height = wep.height = H;
    var bd = g.createImageData(W, H), wd = g.createImageData(W, H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var j = (y * W + x) * 4;
        var lum = Math.max(px[j], px[j + 1], px[j + 2]);
        var a = hasAlpha ? px[j + 3] / 255 : smooth((lum - 8) / 18);
        if (!hasAlpha && a < 0.22) a = 0;
        var div = hasAlpha ? 1 : Math.min(1, Math.max(0.45, a));
        var w = smooth((x - o.splitX * W) / (o.feather * W) + 0.5);
        var r = Math.min(255, px[j] / div), gg = Math.min(255, px[j + 1] / div), b = Math.min(255, px[j + 2] / div);
        bd.data[j] = wd.data[j] = r; bd.data[j + 1] = wd.data[j + 1] = gg; bd.data[j + 2] = wd.data[j + 2] = b;
        bd.data[j + 3] = 255 * a * (1 - w); wd.data[j + 3] = 255 * a * w;
      }
    }
    body.getContext('2d').putImageData(bd, 0, 0);
    wep.getContext('2d').putImageData(wd, 0, 0);
    var rig = new Rig(o);
    rig.body = body; rig.weapon = wep; rig.srcW = W; rig.srcH = H;
    rig._bodyT = tint(body, 'rgba(127,212,255,0.85)'); rig._wepT = tint(wep, 'rgba(255,127,177,0.9)');
    return Promise.resolve(rig);
  };
  var API = { create: Rig.create, bakeSheet: bakeSheet, defaults: DEF };
  global.TopDownWalkRig = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : this);
