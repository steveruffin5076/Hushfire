import { PadSnapshot, PAD_BUTTON } from '../core/Gamepad';

/**
 * Gamepad control for the DOM menus (title, armory, pause, run summary).
 *
 * Rather than wiring each menu by hand, this treats every visible <button>
 * and <select> in the overlay as a focus target and moves between them
 * spatially: D-pad / left stick picks the nearest target in that direction.
 *
 *   D-pad / left stick   move highlight (up/down/left/right)
 *   A                    press button / next option in a dropdown
 *   D-pad ← / →          on a dropdown: previous / next option
 *   B                    "back" — presses the target marked data-pad-back
 *
 * Only active while the overlay accepts pointer events (i.e. a menu is
 * actually open), so gameplay pad input is never mistaken for menu input.
 * Targets marked data-pad-default get the highlight first.
 */

export type NavDir = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Index of the best target from `from` in direction `dir`, or -1. Candidates
 * must lie ahead along that axis; among those, the nearest wins, with sideways
 * offset weighted double so the highlight prefers staying in its row/column.
 */
export function pickNext(from: NavRect, candidates: readonly NavRect[], dir: NavDir): number {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((r, i) => {
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    const along = dir === 'up' ? cy - y : dir === 'down' ? y - cy : dir === 'left' ? cx - x : x - cx;
    const across = dir === 'up' || dir === 'down' ? Math.abs(x - cx) : Math.abs(y - cy);
    if (along <= 1) return;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const STICK_THRESHOLD = 0.5;
/** Holding a direction repeats after this long, then every REPEAT_MS — like a held arrow key. */
const REPEAT_DELAY_MS = 400;
const REPEAT_MS = 140;
const FOCUS_CLASS = 'pad-focus';

type Target = HTMLButtonElement | HTMLSelectElement;

export class MenuGamepadNav {
  private prevPressed = new Map<number, boolean[]>();
  private heldDir: NavDir | null = null;
  private nextRepeatAt = 0;
  private focused: Target | null = null;
  /** Where the highlight last was, to re-find it when a menu re-renders (the armory rebuilds its dropdowns on every change). */
  private lastCenter: { x: number; y: number } | null = null;
  /** True once a pad has been used and the mouse hasn't moved since — then newly opened menus get the highlight straight away. */
  private usingPad = false;

  constructor(private overlay: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = `.${FOCUS_CLASS} { outline: 3px solid #00E5FF !important; outline-offset: 3px; box-shadow: 0 0 14px rgba(0,229,255,0.6) !important; }`;
    document.head.appendChild(style);
    // The highlight is for pad players only — it gets out of the way as soon as the mouse moves.
    window.addEventListener('mousemove', () => {
      this.usingPad = false;
      this.setFocus(null, false);
    });
  }

  start() {
    const loop = (now: number) => {
      this.update(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private targets(): Target[] {
    if (this.overlay.style.pointerEvents !== 'auto') return [];
    return Array.from(this.overlay.querySelectorAll<Target>('button, select')).filter(
      el => !el.disabled && el.getClientRects().length > 0
    );
  }

  private setFocus(el: Target | null, remember = true) {
    this.focused?.classList.remove(FOCUS_CLASS);
    this.focused = el;
    if (!el) {
      if (!remember) this.lastCenter = null;
      return;
    }
    el.classList.add(FOCUS_CLASS);
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    this.lastCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  private update(now: number) {
    const pads = (navigator.getGamepads?.() ?? []).filter(
      (p): p is Gamepad => !!p && p.connected && p.mapping === 'standard'
    );

    // Edges from every pad — any controller can drive the menus.
    const pressed = new Set<number>();
    let dir: NavDir | null = null;
    for (const pad of pads as PadSnapshot[]) {
      const down = pad.buttons.map(b => b.pressed);
      const prev = this.prevPressed.get(pad.index) ?? [];
      down.forEach((d, i) => {
        if (d && !prev[i]) pressed.add(i);
      });
      this.prevPressed.set(pad.index, down);

      const [ax = 0, ay = 0] = pad.axes;
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      dir ??=
        b(PAD_BUTTON.DPAD_UP) || ay < -STICK_THRESHOLD ? 'up'
        : b(PAD_BUTTON.DPAD_DOWN) || ay > STICK_THRESHOLD ? 'down'
        : b(PAD_BUTTON.DPAD_LEFT) || ax < -STICK_THRESHOLD ? 'left'
        : b(PAD_BUTTON.DPAD_RIGHT) || ax > STICK_THRESHOLD ? 'right'
        : null;
    }

    const targets = this.targets();
    if (targets.length === 0) {
      this.setFocus(null);
      this.heldDir = null;
      return;
    }

    // The focused element was rebuilt or removed: pick up the nearest one to where the highlight was.
    if (this.focused && !targets.includes(this.focused)) {
      const c = this.lastCenter;
      this.focused = null;
      if (c) {
        const nearest = targets.reduce((a, t) => (dist(t, c) < dist(a, c) ? t : a));
        this.setFocus(nearest);
      }
    }

    // Held-direction repeat.
    let step: NavDir | null = null;
    if (dir !== this.heldDir) {
      this.heldDir = dir;
      step = dir;
      this.nextRepeatAt = now + REPEAT_DELAY_MS;
    } else if (dir && now >= this.nextRepeatAt) {
      step = dir;
      this.nextRepeatAt = now + REPEAT_MS;
    }

    if (pressed.size > 0 || dir) this.usingPad = true;

    // A menu just opened (e.g. Start paused the game) while playing on a pad.
    if (!this.focused && this.usingPad && pressed.size === 0 && !dir) {
      this.setFocus(targets.find(t => t.dataset.padDefault !== undefined) ?? targets[0]);
      return;
    }

    const acting = step !== null || pressed.has(PAD_BUTTON.A) || pressed.has(PAD_BUTTON.B);
    if (!acting) return;

    if (pressed.has(PAD_BUTTON.B)) {
      const back = targets.find(t => t.dataset.padBack !== undefined);
      if (back) back.click();
      return;
    }

    // First touch of the pad just shows where you are — it never also moves or presses.
    if (!this.focused) {
      this.setFocus(targets.find(t => t.dataset.padDefault !== undefined) ?? targets[0]);
      return;
    }

    const el = this.focused;
    if (pressed.has(PAD_BUTTON.A)) {
      if (el instanceof HTMLSelectElement) cycleSelect(el, 1);
      else el.click();
      return;
    }

    if (step && el instanceof HTMLSelectElement && (step === 'left' || step === 'right')) {
      cycleSelect(el, step === 'right' ? 1 : -1);
      return;
    }

    if (step) {
      const rects = targets.map(toRect);
      const i = pickNext(toRect(el), rects, step);
      if (i >= 0) this.setFocus(targets[i]);
    }
  }
}

function toRect(el: Element): NavRect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function dist(el: Element, p: { x: number; y: number }) {
  const r = el.getBoundingClientRect();
  return Math.hypot(r.left + r.width / 2 - p.x, r.top + r.height / 2 - p.y);
}

/** Steps a dropdown's choice and fires `change`, exactly as picking it with the mouse would. */
function cycleSelect(select: HTMLSelectElement, delta: number) {
  const n = select.options.length;
  if (n === 0) return;
  select.selectedIndex = (select.selectedIndex + delta + n) % n;
  select.dispatchEvent(new Event('change'));
}
