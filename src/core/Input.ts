import { PadSnapshot, PadState, PAD_BUTTON, readPad, assignPads } from './Gamepad';
import { TouchControls } from './TouchControls';

export interface PlayerInputState {
  moveX: number;
  moveY: number;
  aimAngle: number;
  isFiring: boolean;
  isSprinting: boolean;
  isSneaking: boolean;
  isReloading: boolean;
  isInteracting: boolean;
  isSwitchingWeapon: boolean;
  /** Direct-select alternatives to the isSwitchingWeapon toggle. */
  selectPrimary: boolean;
  selectSecondary: boolean;
  isTogglingFlashlight: boolean;
}

export class InputManager {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  public mousePos = { x: 0, y: 0 };
  public mouseButtons: Set<number> = new Set();

  /** This frame's pad state per operative (null = no pad assigned), refreshed by poll(). */
  private pads: [PadState | null, PadState | null] = [null, null];
  /** Buttons that went down since the last endFrame(), per operative — the pad equivalent of justPressed. */
  private padJustPressed: [Set<number>, Set<number>] = [new Set(), new Set()];
  /** Pressed state at the previous poll, keyed by pad index, for edge detection. */
  private padPrevPressed = new Map<number, boolean[]>();
  /** Last stick aim per operative (gamepad right stick, or P1's touch aim stick), held after release so the aim doesn't snap back. */
  private padAim: [number | null, number | null] = [null, null];
  /**
   * Whether P1 is currently aiming with the mouse or a stick (gamepad or
   * touch) — whichever moved last wins, so a player can switch mid-game. The
   * HUD uses this to decide where to draw P1's reticle.
   */
  public p1AimSource: 'mouse' | 'stick' = 'mouse';

  /** On-screen controls for P1 on touch devices; invisible and inert until the first touch. */
  public readonly touch = new TouchControls();
  private detachTouch: () => void;

  constructor(private canvas: HTMLCanvasElement, private solo = false) {
    this.detachTouch = this.touch.attach(canvas);
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
      this.p1AimSource = 'mouse';
    });

    window.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
    window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Reads every connected gamepad once per rendered frame (the Gamepad API is
   * poll-only — there are no button events). Button edges accumulate until
   * endFrame(), same as keyboard justPressed, so a tap during hit-stop or
   * between physics ticks is never lost. Returns true if Start was just
   * pressed on either operative's pad (or the touch pause button tapped),
   * for Game to toggle pause — polled even while paused so Start can also
   * resume.
   */
  poll(): boolean {
    const raw: readonly (PadSnapshot | null)[] =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const assigned = assignPads(raw, this.solo);
    let startPressed = false;

    ([assigned.p1, assigned.p2] as const).forEach((pad, slot) => {
      if (!pad) {
        // Unplugged (or never assigned): drop any held stick aim so P1 falls
        // back to the mouse — unless P1 is on touch, whose aim stick shares
        // this held aim and has no mouse to fall back to.
        this.pads[slot] = null;
        if (slot === 1 || !this.touch.active) {
          this.padAim[slot] = null;
          if (slot === 0) this.p1AimSource = 'mouse';
        }
        return;
      }
      const state = readPad(pad);
      const prev = this.padPrevPressed.get(pad.index) ?? [];
      state.pressed.forEach((down, i) => {
        if (down && !prev[i]) {
          this.padJustPressed[slot].add(i);
          if (i === PAD_BUTTON.START) startPressed = true;
        }
      });
      this.padPrevPressed.set(pad.index, state.pressed);
      this.pads[slot] = state;

      if (state.aimAngle !== null) {
        this.padAim[slot] = state.aimAngle;
        if (slot === 0) this.p1AimSource = 'stick';
      }
    });

    const touchAim = this.touch.read().aimAngle;
    if (touchAim !== null) {
      this.padAim[0] = touchAim;
      this.p1AimSource = 'stick';
    }

    return this.touch.consumePause() || startPressed;
  }

  /** Stick overrides keys while it's pushed; otherwise the keyboard direction stands. */
  private mergeMove(slot: 0 | 1, keyX: number, keyY: number): { moveX: number; moveY: number } {
    const pad = this.pads[slot];
    if (pad && (pad.moveX !== 0 || pad.moveY !== 0)) return { moveX: pad.moveX, moveY: pad.moveY };
    return { moveX: keyX, moveY: keyY };
  }

  /** Keyboard state OR'd with the operative's pad, so either device can drive every action. */
  private mergeButtons(slot: 0 | 1, keys: PlayerInputState): PlayerInputState {
    const pad = this.pads[slot];
    const edge = this.padJustPressed[slot];
    if (!pad) return keys;
    return {
      ...keys,
      isFiring: keys.isFiring || pad.fire,
      isSprinting: keys.isSprinting || pad.sprint,
      isSneaking: keys.isSneaking || pad.sneak,
      isReloading: keys.isReloading || pad.reload,
      isInteracting: keys.isInteracting || pad.interact,
      isSwitchingWeapon: keys.isSwitchingWeapon || edge.has(PAD_BUTTON.Y),
      selectPrimary: keys.selectPrimary || edge.has(PAD_BUTTON.DPAD_LEFT),
      selectSecondary: keys.selectSecondary || edge.has(PAD_BUTTON.DPAD_RIGHT),
      isTogglingFlashlight: keys.isTogglingFlashlight || edge.has(PAD_BUTTON.B)
    };
  }

  getPlayer1Input(playerWorldPos: { x: number; y: number }): PlayerInputState {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('KeyW')) moveY -= 1;
    if (this.keys.has('KeyS')) moveY += 1;
    if (this.keys.has('KeyA')) moveX -= 1;
    if (this.keys.has('KeyD')) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.SQRT2;
      moveX /= len;
      moveY /= len;
    }

    const padAim = this.padAim[0];
    const aimAngle =
      this.p1AimSource === 'stick' && padAim !== null
        ? padAim
        : Math.atan2(this.mousePos.y - playerWorldPos.y, this.mousePos.x - playerWorldPos.x);

    return this.mergeTouch(this.mergeButtons(0, {
      ...this.mergeMove(0, moveX, moveY),
      aimAngle,
      isFiring: this.mouseButtons.has(0), // Left click
      isSprinting: this.keys.has('Space'),
      isSneaking: this.keys.has('ShiftLeft') || this.keys.has('ControlLeft'),
      isReloading: this.keys.has('KeyR'),
      isInteracting: this.keys.has('KeyF') || this.keys.has('KeyE'),
      isSwitchingWeapon: this.justPressed.has('KeyQ'),
      selectPrimary: this.justPressed.has('Digit1'),
      selectSecondary: this.justPressed.has('Digit2'),
      isTogglingFlashlight: this.justPressed.has('KeyT')
    }));
  }

  /** P1 only: the on-screen stick overrides movement while pushed, and touch buttons OR in. */
  private mergeTouch(input: PlayerInputState): PlayerInputState {
    if (!this.touch.active) return input;
    const t = this.touch.read();
    const touchMoving = t.moveX !== 0 || t.moveY !== 0;
    return {
      ...input,
      moveX: touchMoving ? t.moveX : input.moveX,
      moveY: touchMoving ? t.moveY : input.moveY,
      isFiring: input.isFiring || t.fire,
      isSprinting: input.isSprinting || t.sprint,
      isSneaking: input.isSneaking || t.sneak,
      isReloading: input.isReloading || t.reload,
      isInteracting: input.isInteracting || t.interact,
      isSwitchingWeapon: input.isSwitchingWeapon || t.justPressed.has('swap'),
      isTogglingFlashlight: input.isTogglingFlashlight || t.justPressed.has('light')
    };
  }

  getPlayer2Input(playerWorldPos: { x: number; y: number }, partnerWorldPos: { x: number; y: number }): PlayerInputState {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('ArrowUp')) moveY -= 1;
    if (this.keys.has('ArrowDown')) moveY += 1;
    if (this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('ArrowRight')) moveX += 1;

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.SQRT2;
      moveX /= len;
      moveY /= len;
    }

    // Aim via IJKL, else the right stick (held at its last direction once
    // released), else face away from the partner to cover their back.
    let aimAngle = this.padAim[1] ?? Math.atan2(partnerWorldPos.y - playerWorldPos.y, partnerWorldPos.x - playerWorldPos.x) + Math.PI;
    if (this.keys.has('KeyI')) aimAngle = -Math.PI / 2;
    if (this.keys.has('KeyK')) aimAngle = Math.PI / 2;
    if (this.keys.has('KeyJ')) aimAngle = Math.PI;
    if (this.keys.has('KeyL')) aimAngle = 0;

    return this.mergeButtons(1, {
      ...this.mergeMove(1, moveX, moveY),
      aimAngle,
      isFiring: this.keys.has('Numpad0') || this.keys.has('Enter'),
      isSprinting: this.keys.has('ShiftRight'),
      isSneaking: this.keys.has('ControlRight'),
      isReloading: this.keys.has('Slash'),
      isInteracting: this.keys.has('Period'),
      isSwitchingWeapon: this.justPressed.has('Comma'),
      selectPrimary: this.justPressed.has('Numpad1'),
      selectSecondary: this.justPressed.has('Numpad2'),
      isTogglingFlashlight: this.justPressed.has('Quote')
    });
  }

  /** Clears one-shot "just pressed" edge state. Call once per frame after both players' inputs are read. */
  /**
   * Drops all pending one-shot presses and treats every pad button that's
   * currently held as already seen. Called on pause/resume: the menus are
   * driven by the same pads (see MenuGamepadNav), so pressing B or A to
   * resume must not also land in gameplay as a flashlight toggle or similar.
   */
  resetEdges() {
    this.endFrame();
    const raw: readonly (PadSnapshot | null)[] =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of raw) {
      if (pad?.connected) this.padPrevPressed.set(pad.index, readPad(pad).pressed);
    }
  }

  /** Removes the canvas touch listeners so a finished Game doesn't keep reacting to touches. */
  dispose() {
    this.detachTouch();
  }

  endFrame() {
    this.justPressed.clear();
    this.padJustPressed[0].clear();
    this.padJustPressed[1].clear();
    this.touch.endFrame();
  }
}
