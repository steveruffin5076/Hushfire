/**
 * Pure gamepad reading for the browser's "standard" mapping (Xbox /
 * PlayStation layout). Kept free of navigator/DOM access so it can be unit
 * tested; InputManager does the polling and edge detection.
 *
 *   Left stick  move            Right stick  aim
 *   RT          fire            LT           sneak
 *   LB / L3     sprint          A            interact / revive (hold)
 *   X           reload          Y            switch weapon
 *   B           flashlight      D-pad ← / →  primary / secondary
 *   Start       pause
 */

/** Just the fields of the DOM Gamepad this reads, so tests can pass plain objects. */
export interface PadSnapshot {
  index: number;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export const PAD_BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  START: 9,
  L3: 10,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
} as const;

/** Worn sticks rarely rest at exactly 0 — anything inside this is treated as centered. */
export const MOVE_DEADZONE = 0.2;
/** Larger than the move deadzone: aim snaps to the stick's direction, so a barely-nudged stick would jitter the aim. */
export const AIM_DEADZONE = 0.35;
const TRIGGER_THRESHOLD = 0.5;

/** Radial deadzone, rescaled so movement ramps smoothly from 0 at the deadzone edge up to 1, never beyond. */
export function applyDeadzone(x: number, y: number, deadzone: number): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

export interface PadState {
  moveX: number;
  moveY: number;
  /** Null while the right stick is centered, so the caller can keep the last aim instead of snapping to 0. */
  aimAngle: number | null;
  fire: boolean;
  sprint: boolean;
  sneak: boolean;
  reload: boolean;
  interact: boolean;
  /** Raw pressed state per button index, for InputManager's just-pressed edge detection. */
  pressed: boolean[];
}

const isDown = (pad: PadSnapshot, i: number) => {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > TRIGGER_THRESHOLD);
};

export function readPad(pad: PadSnapshot): PadState {
  const move = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, MOVE_DEADZONE);
  const rx = pad.axes[2] ?? 0;
  const ry = pad.axes[3] ?? 0;
  return {
    moveX: move.x,
    moveY: move.y,
    aimAngle: Math.hypot(rx, ry) > AIM_DEADZONE ? Math.atan2(ry, rx) : null,
    fire: isDown(pad, PAD_BUTTON.RT),
    sprint: isDown(pad, PAD_BUTTON.LB) || isDown(pad, PAD_BUTTON.L3),
    sneak: isDown(pad, PAD_BUTTON.LT),
    reload: isDown(pad, PAD_BUTTON.X),
    interact: isDown(pad, PAD_BUTTON.A),
    pressed: pad.buttons.map((_, i) => isDown(pad, i))
  };
}

/**
 * Which connected pad drives which operative. Solo: the first pad is P1's.
 * Co-op with one pad: it goes to P2, whose keyboard layout (arrows + IJKL)
 * is the cramped one, while P1 keeps mouse aim. Co-op with two or more: the
 * first two pads go to P1 and P2 in connection order.
 */
export function assignPads(pads: readonly (PadSnapshot | null)[], solo: boolean): { p1: PadSnapshot | null; p2: PadSnapshot | null } {
  const usable = pads.filter((p): p is PadSnapshot => !!p && p.connected && p.mapping === 'standard');
  if (solo) return { p1: usable[0] ?? null, p2: null };
  if (usable.length === 1) return { p1: null, p2: usable[0] };
  return { p1: usable[0] ?? null, p2: usable[1] ?? null };
}
