import { applyDeadzone } from './Gamepad';

/**
 * On-screen twin-stick controls for phones/tablets, driving Player 1.
 *
 *   Left half   floating move stick (appears wherever the thumb lands)
 *   Right half  floating aim stick; pushing it past FIRE_THRESHOLD also fires
 *   Buttons     LIGHT / SWAP / RELOAD / USE down the right edge,
 *               SPRINT / SNEAK toggles on the left edge, pause top-center
 *
 * Everything is in canvas pixels (1280x720), so layout and hit-testing match
 * what's drawn regardless of how the canvas is CSS-scaled. The touch handling
 * (onStart/onMove/onEnd) is kept separate from the DOM listeners in attach()
 * so it can be unit-tested with plain coordinates.
 *
 * Hidden until the first touch, so desktop players never see it.
 */

export type TouchButtonId = 'light' | 'swap' | 'reload' | 'use' | 'sprint' | 'sneak' | 'pause';

interface TouchButton {
  id: TouchButtonId;
  label: string;
  x: number;
  y: number;
  r: number;
  /** Toggles flip on tap and stay lit; the rest are held (reload/use) or one-shot (light/swap/pause). */
  toggle?: boolean;
}

export const TOUCH_BUTTONS: readonly TouchButton[] = [
  { id: 'light', label: 'LIGHT', x: 1210, y: 250, r: 40 },
  { id: 'swap', label: 'SWAP', x: 1210, y: 345, r: 40 },
  { id: 'reload', label: 'RELOAD', x: 1210, y: 440, r: 40 },
  { id: 'use', label: 'USE', x: 1210, y: 535, r: 40 },
  { id: 'sprint', label: 'SPRINT', x: 70, y: 345, r: 40, toggle: true },
  { id: 'sneak', label: 'SNEAK', x: 70, y: 440, r: 40, toggle: true },
  { id: 'pause', label: 'II', x: 640, y: 100, r: 26 }
];

/** Thumb travel (canvas px) for a full-strength stick push. */
export const STICK_RADIUS = 70;
const MOVE_DEADZONE = 0.15;
/** Aim stick push fraction beyond which the operative fires — a light touch aims without shooting. */
export const FIRE_THRESHOLD = 0.6;
/** Below this the aim stick is ignored entirely, so a tap doesn't spin the operative. */
const AIM_MIN_PUSH = 0.15;

interface StickTouch {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface TouchState {
  moveX: number;
  moveY: number;
  /** Null until the aim stick is pushed; after release the last aim is kept by InputManager. */
  aimAngle: number | null;
  fire: boolean;
  sprint: boolean;
  sneak: boolean;
  reload: boolean;
  interact: boolean;
  /** One-shot buttons tapped since the last endFrame(). */
  justPressed: Set<TouchButtonId>;
}

export class TouchControls {
  /** Flips on at the first touch and stays on — the controls only draw once they're wanted. */
  public active = false;

  private moveStick: StickTouch | null = null;
  private aimStick: StickTouch | null = null;
  /** Held non-toggle buttons, by touch id. */
  private heldButtons = new Map<number, TouchButtonId>();
  private toggles = { sprint: false, sneak: false };
  private edges = new Set<TouchButtonId>();

  onStart(id: number, x: number, y: number) {
    this.active = true;

    const button = TOUCH_BUTTONS.find(b => Math.hypot(x - b.x, y - b.y) <= b.r);
    if (button) {
      if (button.id === 'sprint' || button.id === 'sneak') {
        const other = button.id === 'sprint' ? 'sneak' : 'sprint';
        this.toggles[button.id] = !this.toggles[button.id];
        if (this.toggles[button.id]) this.toggles[other] = false;
      } else {
        this.heldButtons.set(id, button.id);
        this.edges.add(button.id);
      }
      return;
    }

    const stick: StickTouch = { id, originX: x, originY: y, x, y };
    if (x < 640) {
      if (!this.moveStick) this.moveStick = stick;
    } else if (!this.aimStick) {
      this.aimStick = stick;
    }
  }

  onMove(id: number, x: number, y: number) {
    for (const stick of [this.moveStick, this.aimStick]) {
      if (stick?.id === id) {
        stick.x = x;
        stick.y = y;
      }
    }
  }

  onEnd(id: number) {
    if (this.moveStick?.id === id) this.moveStick = null;
    if (this.aimStick?.id === id) this.aimStick = null;
    this.heldButtons.delete(id);
  }

  /** Stick deflection as a vector of length 0..1. */
  private deflection(stick: StickTouch | null): { x: number; y: number; push: number } {
    if (!stick) return { x: 0, y: 0, push: 0 };
    const dx = (stick.x - stick.originX) / STICK_RADIUS;
    const dy = (stick.y - stick.originY) / STICK_RADIUS;
    const push = Math.min(1, Math.hypot(dx, dy));
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * push, y: (dy / len) * push, push };
  }

  read(): TouchState {
    const move = this.deflection(this.moveStick);
    const moveDz = applyDeadzone(move.x, move.y, MOVE_DEADZONE);
    const aim = this.deflection(this.aimStick);
    const held = new Set(this.heldButtons.values());
    return {
      moveX: moveDz.x,
      moveY: moveDz.y,
      aimAngle: aim.push > AIM_MIN_PUSH ? Math.atan2(aim.y, aim.x) : null,
      fire: aim.push >= FIRE_THRESHOLD,
      sprint: this.toggles.sprint,
      sneak: this.toggles.sneak,
      reload: held.has('reload'),
      interact: held.has('use'),
      justPressed: new Set(this.edges)
    };
  }

  /** Returns true (once) if the pause button was tapped since the last call. */
  consumePause(): boolean {
    const tapped = this.edges.has('pause');
    this.edges.delete('pause');
    return tapped;
  }

  endFrame() {
    for (const id of [...this.edges]) if (id !== 'pause') this.edges.delete(id);
  }

  /**
   * Wires real touch events on the canvas. preventDefault stops the browser
   * from scrolling/zooming and from synthesizing mouse events after each tap
   * — those would otherwise register as a mouse click (firing, or hitting the
   * HUD flashlight button) on top of the touch action.
   */
  attach(canvas: HTMLCanvasElement): () => void {
    const toCanvas = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((t.clientX - rect.left) * canvas.width) / rect.width,
        y: ((t.clientY - rect.top) * canvas.height) / rect.height
      };
    };
    const start = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const p = toCanvas(t);
        this.onStart(t.identifier, p.x, p.y);
      }
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const p = toCanvas(t);
        this.onMove(t.identifier, p.x, p.y);
      }
    };
    const end = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) this.onEnd(t.identifier);
    };
    const opts = { passive: false };
    canvas.addEventListener('touchstart', start, opts);
    canvas.addEventListener('touchmove', move, opts);
    canvas.addEventListener('touchend', end, opts);
    canvas.addEventListener('touchcancel', end, opts);
    return () => {
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    };
  }

  /** Screen-space overlay; call last so the darkness mask never hides it. */
  render(ctx: CanvasRenderingContext2D, flashlightOn: boolean) {
    if (!this.active) return;
    ctx.save();

    for (const stick of [this.moveStick, this.aimStick]) {
      if (!stick) continue;
      const d = this.deflection(stick);
      const isAim = stick === this.aimStick;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(235,244,250,0.35)';
      ctx.fillStyle = 'rgba(20,22,28,0.35)';
      ctx.beginPath();
      ctx.arc(stick.originX, stick.originY, STICK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isAim) {
        // Ring marking where aiming turns into firing.
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,82,82,0.45)';
        ctx.beginPath();
        ctx.arc(stick.originX, stick.originY, STICK_RADIUS * FIRE_THRESHOLD, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = isAim && d.push >= FIRE_THRESHOLD ? 'rgba(255,82,82,0.8)' : 'rgba(235,244,250,0.6)';
      ctx.beginPath();
      ctx.arc(stick.originX + d.x * STICK_RADIUS, stick.originY + d.y * STICK_RADIUS, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    const held = new Set(this.heldButtons.values());
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of TOUCH_BUTTONS) {
      const lit =
        held.has(b.id) ||
        (b.id === 'sprint' && this.toggles.sprint) ||
        (b.id === 'sneak' && this.toggles.sneak) ||
        (b.id === 'light' && flashlightOn);
      ctx.fillStyle = lit ? 'rgba(0,229,255,0.28)' : 'rgba(20,22,28,0.45)';
      ctx.strokeStyle = lit ? 'rgba(0,229,255,0.9)' : 'rgba(235,244,250,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lit ? '#00E5FF' : 'rgba(235,244,250,0.85)';
      ctx.fillText(b.label, b.x, b.y);
    }

    ctx.restore();
  }
}
