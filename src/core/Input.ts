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

  constructor(private canvas: HTMLCanvasElement) {
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
    });

    window.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
    window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
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

    const aimAngle = Math.atan2(this.mousePos.y - playerWorldPos.y, this.mousePos.x - playerWorldPos.x);

    return {
      moveX,
      moveY,
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

    // Aim via IJKL or follow partner / enemy if AI controlled
    let aimAngle = Math.atan2(partnerWorldPos.y - playerWorldPos.y, partnerWorldPos.x - playerWorldPos.x) + Math.PI;
    if (this.keys.has('KeyI')) aimAngle = -Math.PI / 2;
    if (this.keys.has('KeyK')) aimAngle = Math.PI / 2;
    if (this.keys.has('KeyJ')) aimAngle = Math.PI;
    if (this.keys.has('KeyL')) aimAngle = 0;

    return {
      moveX,
      moveY,
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
    };
  }

  /** Clears one-shot "just pressed" edge state. Call once per frame after both players' inputs are read. */
  endFrame() {
    this.justPressed.clear();
  }
}
