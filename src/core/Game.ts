import { CANVAS_WIDTH, CANVAS_HEIGHT, REVIVE_RANGE_PX, FLASHLIGHT_BATTERY_MAX, BATTERY_PICKUP_CHARGE, SECTOR_HORDE_COOLDOWN_SEC } from '../config/constants';
import { InputManager, PlayerInputState } from './Input';
import { Camera } from './Camera';
import { SoundManager } from './SoundManager';
import { Flashlight, FlashlightBeam } from '../lighting/Flashlight';
import { ShadowRenderer, MuzzleFlashPulse, RadialLight } from '../lighting/ShadowRenderer';
import { Player, WeaponLoadout } from '../entities/Player';
import { Zombie, ZombieArchetype } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { MapManager } from '../systems/MapManager';
import { NoiseSystem } from '../systems/NoiseSystem';
import { AISystem } from '../systems/AISystem';
import { Difficulty, DifficultyDef, DIFFICULTIES } from '../config/difficulty';
import { SURGE_START_INTERVAL_SEC, surgeInterval, surgeSize, pickSurgeArchetype } from '../systems/HordeSurge';
import { CombatSystem, Decal, bloodDecal, HIT_FLASH_SEC, BIO_CARRIER_BLAST_RADIUS, collectStuckBolts } from '../systems/CombatSystem';
import { HUD } from '../ui/HUD';
import { RunStats } from '../ui/ExtractionModal';
import type { SectorReward } from '../ui/SectorRewardMenu';
import { SECTORS } from '../config/sectors';
import { SectorModifierId, getSectorModifier } from '../config/sectorModifiers';
import { AssetLoader, AssetKey } from './AssetLoader';
import { WALK_RIG_DEFAULTS } from '../graphics/TopDownWalkRig';
import { WEAPON_REGISTRY, MUZZLE_MODIFIERS } from '../config/weapons';
import { SessionManager } from '../net/SessionManager';
import { inputToNet, netToInput } from '../net/Protocol';
import type { NetPlayerSnap, NetSnapshotMessage } from '../net/GameSnapshot';
import { Pickup } from '../entities/Pickup';

const FIXED_DT = 1 / 60;
// Contact damage now comes from the run's difficulty (config/difficulty.ts):
// NORMAL keeps the tuned-down 15/s, HARD restores the original 22/s.
const ZOMBIE_CONTACT_RANGE_PAD = 4;
const HORDE_MAX_ZOMBIES = 18;
/** How long the Bio-Carrier blast ring takes to expand and fade. */
const BLAST_RING_SEC = 0.7;
/** "HORDE INCOMING" shows for this long before each evac wave. */
const SURGE_WARNING_SEC = 2;

// Draw sizes, per docs/ART_SPECIFICATION.md §2-3. Sprites are authored at
// 128x128, so these are all still *down*scales — 128 is the ceiling before the
// art starts upscaling and going soft (index.html also sets
// image-rendering: pixelated, which would make it crunchy rather than soft).
// Sized up 1.35x from the previous 70/64/58/76/80; the archetype ordering from
// the art spec (stalker smallest, brute largest) is preserved.
const ZOMBIE_SPRITE_SIZE: Record<ZombieArchetype, number> = {
  lurker: 86,
  audio_stalker: 78,
  bio_carrier: 102,
  armored_brute: 108
};
const PLAYER_SPRITE_SIZE = 94;

/**
 * Light spill around each operative. The flashlight cone's apex is the
 * operative's own centre, so without this their sprite measures as pitch black.
 * Derived from the sprite size rather than hardcoded: the sprite's half-extent
 * is PLAYER_SPRITE_SIZE / 2, so 0.9 clears it with room to spare and keeps
 * clearing it if the sprite is resized again. (It was hardcoded to 62 against a
 * 70px sprite, with a comment claiming a 50px one.)
 */
const CARRY_LIGHT_RADIUS = PLAYER_SPRITE_SIZE * 0.9;
/** Downed operatives crawl and read as smaller, so their spill is tighter. */
const CARRY_LIGHT_DOWNED_RADIUS = CARRY_LIGHT_RADIUS * 0.7;
/** Muzzle flash offset along the aim vector — at the barrel, not the chest. */
const MUZZLE_BARREL_OFFSET = PLAYER_SPRITE_SIZE * 0.37;
/** Revive progress ring drawn around a downed operative. */
const REVIVE_RING_RADIUS = PLAYER_SPRITE_SIZE * 0.31;

// Zombie eye tell and health bar, as ratios of the archetype's draw size so all
// four archetypes stay aligned with their own art. They were previously shared
// absolute values (eyes at 11/±4 r2.4, bar 32px wide) tuned for the 64px lurker,
// which left the 80px brute's eyes and bar misplaced.
const ZOMBIE_EYE_X = 0.17;
const ZOMBIE_EYE_Y = 0.06;
const ZOMBIE_EYE_R = 0.0375;
const ZOMBIE_HEALTH_BAR_W = 0.5;
const ZOMBIE_HEALTH_BAR_GAP = 6;

const PICKUP_SPRITE_SIZE = 30;

export interface OnlineGameConfig {
  session: SessionManager;
  role: 'host' | 'guest';
}

export interface GameCallbacks {
  onMissionEnd: (stats: RunStats) => void;
  /** Fired whenever Esc flips the pause state, so the host page can show/hide its own pause UI. */
  onPauseChange?: (paused: boolean) => void;
  /** Sector 1/2 exit reached — pick a supply drop before the next sector loads. */
  onSectorReward?: (
    info: { sectorName: string; nextSectorName: string },
    onChosen: (reward: SectorReward) => void
  ) => void;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private camera: Camera;
  private sound = new SoundManager();
  private assets: AssetLoader;
  private hud: HUD;

  private map = new MapManager();
  private noise = new NoiseSystem();
  private ai: AISystem;
  private readonly difficultyDef: DifficultyDef;
  private combat: CombatSystem;

  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;
  private missionTime = 0;
  /** Real-time freeze-frame on a big impact — simulation pauses, rendering doesn't. */
  private hitStopTimer = 0;
  /** Set the first time advanceTime() is called, so the real-time rAF loop stops scheduling itself and a test's deterministic steps are the only ones that run. See advanceTime()'s own comment. */
  private manualStepping = false;
  /** Red vignette on taking damage, faded out each tick. */
  private damageFlashAlpha = 0;
  private readonly handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') this.togglePause();
  };

  /**
   * The keyboard shortcut (T) already toggles P1's flashlight via
   * PlayerInputState — this handles the on-screen HUD button so it's
   * discoverable without knowing the keybind. Only P1's button is wired up
   * (see HUD.renderFlashlightButton's comment on why). stopPropagation keeps
   * this same mousedown from also registering as a fire input in
   * InputManager's window-level listener.
   */
  private readonly handleCanvasMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const btn = HUD.getFlashlightButtonRect(1);
    if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
      this.p1.toggleFlashlight();
      e.stopPropagation();
      e.preventDefault();
    }
  };

  /**
   * The OS cursor is hidden during gameplay — the aim reticle is drawn at the
   * pointer's exact screen position instead (see HUD.renderReticles), so it acts
   * as the cursor and never fights the art. Hovering the flashlight button still
   * shows an arrow, since that's a screen-space control the reticle gives no
   * affordance for.
   */
  private readonly handleCanvasMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const btn = HUD.getFlashlightButtonRect(1);
    const hovering = cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h;
    this.canvas.style.cursor = hovering ? 'pointer' : 'none';
  };

  private p1: Player;
  private p2: Player;
  private zombies: Zombie[] = [];
  private projectiles: Projectile[] = [];
  private decals: Decal[] = [];
  private hordeSpawnTimer = SURGE_START_INTERVAL_SEC;
  /** Cooldown between reinforcement waves drawn in by loud sector-alerting gunfire. */
  private sectorHordeCooldown = 0;
  /** Brief "HORDE INCOMING" banner before a sector-alert reinforcement wave. */
  private sectorHordeWarningTimer = 0;
  private waitingForReward = false;
  /** Run-wide stealth stat: zombies that went ENRAGED while alive. */
  private zombiesAlerted = 0;
  /** Bio-Carrier death bursts, drawn as expanding rings showing who heard them. */
  private blasts: { x: number; y: number; age: number }[] = [];
  private dryFireCooldown = new Map<number, number>();
  private hitSoundCooldown = new Map<number, number>();
  private readonly runModifier: SectorModifierId;
  private readonly layoutRand: () => number;
  private readonly netRole: 'local' | 'host' | 'guest' = 'local';
  private session: SessionManager | null = null;
  private netTick = 0;
  private netInputSeq = 0;
  private netSnapshotAccum = 0;
  private guestRemoteInput: PlayerInputState | null = null;
  private pendingSnapshot: NetSnapshotMessage | null = null;
  private guestMissionEnded = false;

  constructor(
    canvas: HTMLCanvasElement,
    loadouts: [WeaponLoadout, WeaponLoadout],
    assets: AssetLoader,
    private callbacks: GameCallbacks,
    /** True operative-of-one: Player 2 never spawns into play — no companion, human or AI. */
    private solo = false,
    difficulty: Difficulty = 'normal',
    runModifier: SectorModifierId = 'scavenger',
    layoutRand: () => number = Math.random,
    online?: OnlineGameConfig
  ) {
    this.runModifier = runModifier;
    this.layoutRand = layoutRand;
    this.difficultyDef = DIFFICULTIES[difficulty];
    this.ai = new AISystem(this.difficultyDef.noticeMult);
    this.applyDifficultyToSector();
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d')!;
    this.assets = assets;
    this.hud = new HUD(assets);
    this.input = new InputManager(canvas, solo);
    this.camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    canvas.addEventListener('mousedown', () => this.sound.resume(), { once: true });
    window.addEventListener('keydown', () => this.sound.resume(), { once: true });
    window.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('mousedown', this.handleCanvasMouseDown);
    canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    // Hidden from the first frame, not just after the pointer happens to move —
    // handleCanvasMouseMove only runs on mousemove, so without this the arrow
    // would sit visible until the player twitched the mouse.
    canvas.style.cursor = 'none';

    const spawns = this.map.sector.playerSpawns;
    this.p1 = new Player(1, spawns[0].x, spawns[0].y, 100, loadouts[0]);
    this.p2 = new Player(2, spawns[1].x, spawns[1].y, 120, loadouts[1]);
    // Solo mode never puts a second operative in play — eliminating it up front
    // makes every system that already filters on isEliminated/alive (AI targeting,
    // camera framing, HUD, revive, combat) treat it as if it were never there.
    if (this.solo) this.p2.eliminate();

    this.map.loadSector(0, this.layoutRand, this.runModifier);
    if (this.runModifier === 'blackout') {
      for (const player of [this.p1, this.p2]) {
        if (!player.isEliminated) player.flashlightBattery = FLASHLIGHT_BATTERY_MAX / 2;
      }
    }

    this.combat = new CombatSystem(this.map, this.noise, {
      onZombieKilled: (zombie, killer) => this.onZombieKilled(zombie, killer),
      onSectorAlertingShot: player => this.onSectorAlertingShot(player)
    });

    this.spawnZombies();

    if (online) {
      this.netRole = online.role;
      this.session = online.session;
      this.wireNetSession();
    }
  }

  private wireNetSession() {
    if (!this.session) return;
    this.session.onRemoteInput = msg => {
      if (this.netRole === 'host') this.guestRemoteInput = netToInput(msg);
    };
    this.session.onSnapshot = msg => {
      if (this.netRole === 'guest') {
        this.pendingSnapshot = msg;
        if (msg.missionOver && !this.guestMissionEnded) {
          this.guestMissionEnded = true;
          this.endMission(msg.missionOver.victory);
        }
      }
    };
  }

  private static emptyInput(): PlayerInputState {
    return {
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      isFiring: false,
      isSprinting: false,
      isSneaking: false,
      isReloading: false,
      isInteracting: false,
      isSwitchingWeapon: false,
      selectPrimary: false,
      selectSecondary: false,
      isTogglingFlashlight: false
    };
  }

  private capturePlayerSnap(player: Player): NetPlayerSnap {
    return {
      x: player.x,
      y: player.y,
      angle: player.angle,
      hp: player.health,
      maxHp: player.maxHealth,
      downed: player.isDowned,
      eliminated: player.isEliminated,
      activeWeaponId: player.activeWeaponId,
      activeSlot: player.activeSlot,
      mag: player.currentMag,
      reserve: player.reserveAmmo,
      reloading: player.isReloading,
      flashlightOn: player.flashlightOn,
      battery: player.flashlightBattery,
      hasKeycard: player.hasKeycard
    };
  }

  private applyPlayerSnap(player: Player, snap: NetPlayerSnap) {
    player.x = snap.x;
    player.y = snap.y;
    player.angle = snap.angle;
    player.health = snap.hp;
    player.isDowned = snap.downed;
    if (snap.eliminated && !player.isEliminated) player.eliminate();
    player.activeSlot = snap.activeSlot;
    player.currentMag = snap.mag;
    player.reserveAmmo = snap.reserve;
    player.isReloading = snap.reloading;
    player.flashlightOn = snap.flashlightOn;
    player.flashlightBattery = snap.battery;
    player.hasKeycard = snap.hasKeycard;
  }

  private buildSnapshot(missionOver?: { victory: boolean }): NetSnapshotMessage {
    const zone = this.map.extractionZone;
    return {
      t: 'snapshot',
      tick: this.netTick,
      missionTime: this.missionTime,
      sectorIndex: this.map.sectorIndex,
      objectiveProgress: this.map.objectiveProgress,
      objectiveComplete: this.map.objectiveComplete,
      evac:
        zone.radius > 0
          ? {
              active: zone.isActive,
              occupied: zone.isOccupied,
              holdoutTimer: zone.holdoutTimer,
              complete: zone.isComplete
            }
          : null,
      p1: this.capturePlayerSnap(this.p1),
      p2: this.capturePlayerSnap(this.p2),
      zombies: this.zombies
        .filter(z => z.alive || z.isDying)
        .map(z => ({
          id: z.id,
          x: z.x,
          y: z.y,
          angle: z.angle,
          hp: z.health,
          archetype: z.archetype,
          state: z.state
        })),
      pickups: this.map.pickups.map(p => ({ x: p.x, y: p.y, type: p.type })),
      projectiles: this.projectiles.map(p => ({
        x: p.x,
        y: p.y,
        angle: p.angle,
        stuck: p.stuck,
        ownerId: p.ownerId
      })),
      paused: this.paused,
      missionOver
    };
  }

  private applyGuestSnapshot(snap: NetSnapshotMessage) {
    this.missionTime = snap.missionTime;
    this.paused = snap.paused;

    if (snap.sectorIndex !== this.map.sectorIndex) {
      this.map.loadSector(snap.sectorIndex, this.layoutRand, this.runModifier);
      this.applyDifficultyToSector();
    }
    this.map.objectiveProgress = snap.objectiveProgress;
    this.map.objectiveComplete = snap.objectiveComplete;
    if (snap.objectiveComplete) this.map.completeObjective();

    const zone = this.map.extractionZone;
    if (snap.evac && zone.radius > 0) {
      zone.isActive = snap.evac.active;
      zone.isOccupied = snap.evac.occupied;
      zone.holdoutTimer = snap.evac.holdoutTimer;
      zone.isComplete = snap.evac.complete;
    }

    // Guest's local P1 is the host's P2; partner is host's P1.
    this.applyPlayerSnap(this.p1, snap.p2);
    this.applyPlayerSnap(this.p2, snap.p1);

    this.zombies = snap.zombies.map(
      z => {
        const zombie = new Zombie(z.x, z.y, z.angle, z.archetype, this.difficultyDef.zombieHpMult);
        zombie.health = z.hp;
        zombie.state = z.state;
        return zombie;
      }
    );

    this.map.pickups = snap.pickups.map(p => new Pickup(p.x, p.y, p.type));
    this.projectiles = snap.projectiles.map(p => {
      const bolt = new Projectile(p.x, p.y, p.angle, 0, p.ownerId, 0);
      if (p.stuck) bolt.stick();
      return bolt;
    });
  }

  /** The evac holdout length is per difficulty, not per sector — overrides what MapManager loaded. */
  private applyDifficultyToSector() {
    const zone = this.map.extractionZone;
    if (zone.radius <= 0) return;
    zone.holdoutDurationSec = this.difficultyDef.holdoutSec;
    zone.holdoutTimer = this.difficultyDef.holdoutSec;
  }

  private spawnZombies() {
    this.zombies = this.map.layout.zombies.map(s => new Zombie(s.x, s.y, s.angle, s.archetype, this.difficultyDef.zombieHpMult));
    if (this.runModifier !== 'heavy' || this.zombies.length >= HORDE_MAX_ZOMBIES) return;
    const spawn = this.map.rollSurgeSpawn(this.layoutRand);
    this.zombies.push(new Zombie(spawn.x, spawn.y, 0, 'armored_brute', this.difficultyDef.zombieHpMult));
  }

  private onZombieKilled(zombie: Zombie, _killer: Player) {
    this.sound.playZombieDeath(this.p1.position, zombie.position, this.map.countWallsCrossed(zombie.position, this.p1.position));
    this.decals.push(bloodDecal(zombie.x, zombie.y, 16, '#3A0808'));
    if (zombie.archetype === 'bio_carrier') {
      this.decals.push({ x: zombie.x, y: zombie.y, r: 40, color: 'rgba(120, 200, 40, 0.35)', kind: 'toxic', angle: 0 });
      this.blasts.push({ x: zombie.x, y: zombie.y, age: 0 });
    }

    // The brute is the one kill worth a real punch; routine kills get a light
    // tap so clearing a horde doesn't turn into a strobing freeze-frame slideshow.
    const isBigKill = zombie.archetype === 'armored_brute';
    this.camera.addTrauma(isBigKill ? 0.5 : 0.28);
    this.triggerHitStop(isBigKill ? 0.09 : 0.045);
  }

  public start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.tick(t));
  }

  /** So the window-level render_game_to_text hook (see docs/develop-web-game skill) can tell a live run from a stopped one without reaching into private state. */
  public isRunning(): boolean {
    return this.running;
  }

  /**
   * Deterministic test-only frame stepper (see docs/develop-web-game skill; wired
   * to `window.advanceTime` in main.ts). Advances the simulation by `ms` of
   * gameplay time in fixed 1/60s steps — ignoring wall-clock time — then renders
   * once, so a Playwright-driven test can step frames reproducibly instead of
   * racing real timers. Mirrors tick()'s own pause/hit-stop handling so a paused
   * or frozen game behaves the same under advanceTime as it does under real play.
   */
  public advanceTime(ms: number) {
    if (!this.running) return;
    this.manualStepping = true;
    const steps = Math.max(1, Math.round(ms / (FIXED_DT * 1000)));
    for (let i = 0; i < steps; i++) {
      if (!this.running) break;
      if (this.input.poll()) this.togglePause();
      if (this.paused) {
        this.input.endFrame();
        continue;
      }
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= FIXED_DT;
        continue;
      }
      this.update(FIXED_DT);
    }
    this.render();
  }

  /**
   * Test-only state dump (see docs/develop-web-game skill; wired to
   * `window.render_game_to_text` in main.ts). Kept succinct and biased toward
   * what's currently on screen — no history — per the skill's own guidance.
   */
  public renderGameToText(): string {
    const zone = this.map.extractionZone;
    const obj = this.map.sector.objective;
    const playerPayload = (p: Player) => ({
      id: p.playerNumber,
      x: Math.round(p.x),
      y: Math.round(p.y),
      angle: Number(p.angle.toFixed(2)),
      hp: Math.round(p.health),
      maxHp: p.maxHealth,
      downed: p.isDowned,
      eliminated: p.isEliminated,
      weapon: p.activeWeaponId,
      mag: p.currentMag,
      reserve: p.reserveAmmo,
      reloading: p.isReloading,
      flashlightOn: p.flashlightOn,
      battery: Math.round(p.flashlightBattery),
      hasKeycard: p.hasKeycard
    });

    return JSON.stringify({
      mode: this.paused ? 'paused' : 'playing',
      // Coordinate system: world-space pixels, origin top-left, +x right, +y down — same space as sectors.ts.
      missionTimeSec: Number(this.missionTime.toFixed(1)),
      sector: this.map.sector.name,
      runModifier: this.runModifier,
      objective: { label: obj.label, progress: Number(this.map.objectiveProgress.toFixed(2)), complete: this.map.objectiveComplete },
      extraction:
        zone.radius > 0
          ? { active: zone.isActive, occupied: zone.isOccupied, holdoutTimerSec: Number(zone.holdoutTimer.toFixed(1)), complete: zone.isComplete }
          : null,
      players: [this.p1, this.p2].filter(p => !p.isEliminated || p === this.p1).map(playerPayload),
      zombies: this.zombies.map(z => ({
        x: Math.round(z.x),
        y: Math.round(z.y),
        archetype: z.archetype,
        state: z.state,
        hp: Math.round(z.health),
        maxHp: z.maxHealth,
        alive: z.alive
      })),
      pickups: this.map.pickups.map(pk => ({ x: pk.x, y: pk.y, type: pk.type })),
      score: {
        kills: this.p1.killCount + this.p2.killCount,
        shotsFired: this.p1.shotsFired + this.p2.shotsFired,
        silentKills: this.p1.silentKills + this.p2.silentKills,
        zombiesAlerted: this.zombiesAlerted
      }
    });
  }

  public stop() {
    this.running = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
    this.input.dispose();
    // Give the OS cursor back: gameplay hid it, but the armory/menus that follow
    // are DOM overlays whose buttons rely on a visible pointer.
    this.canvas.style.cursor = 'default';
  }

  /** Public so the pause menu's own Resume button can drive the same toggle Esc does. */
  public togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    // Both ways: nothing consumes key edges while frozen, so a queued
    // reload/switch mustn't fire on resume — and a pad button used to press
    // Resume in the pause menu mustn't also count as a gameplay press.
    this.input.resetEdges();
    this.callbacks.onPauseChange?.(this.paused);
  }

  /** Freezes simulation (not rendering) for a moment — reserved for real impact, never routine actions. Overlapping triggers take the longer one rather than stacking. */
  private triggerHitStop(seconds: number) {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  private tick(timestamp: number) {
    if (!this.running) return;
    // Once a test has taken over stepping via advanceTime(), stop scheduling the
    // real-time rAF loop — otherwise both drive update()/render() concurrently
    // and every advanceTime() call gets extra, wall-clock-timed physics steps
    // mixed in on top of its own deterministic ones (silently makes the movement
    // test numbers wrong, though it doesn't affect real play, which never calls
    // advanceTime). See docs/develop-web-game skill.
    if (this.manualStepping) return;
    const frameDt = Math.min((timestamp - this.lastTime) / 1000, 0.25);
    this.lastTime = timestamp;

    // Polled before the pause check so a pad's Start (or the touch pause button) can resume as well as pause.
    if (this.input.poll()) this.togglePause();

    if (this.paused) {
      // Presses made while frozen belong to the pause menu, not the operative.
      this.input.endFrame();
      this.render();
      requestAnimationFrame(t => this.tick(t));
      return;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= frameDt;
      this.render();
      if (this.running) requestAnimationFrame(t => this.tick(t));
      return;
    }

    this.accumulator += frameDt;

    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
      if (!this.running) break;
    }

    this.render();

    if (this.running) requestAnimationFrame(t => this.tick(t));
  }

  private update(dt: number) {
    if (this.netRole === 'guest') {
      this.updateGuestClient(dt);
      return;
    }

    this.missionTime += dt;
    this.netTick++;

    const in1 = this.input.getPlayer1Input({ x: this.p1.x, y: this.p1.y });
    const in2 =
      this.netRole === 'host'
        ? (this.guestRemoteInput ?? Game.emptyInput())
        : this.input.getPlayer2Input({ x: this.p2.x, y: this.p2.y }, { x: this.p1.x, y: this.p1.y });
    this.input.endFrame();

    if (!this.p1.isEliminated) this.p1.update(dt, in1, this.map);
    if (!this.p2.isEliminated) this.p2.update(dt, in2, this.map);

    this.updateOperative1WalkRig(dt);

    this.handleFootsteps(this.p1);
    this.handleFootsteps(this.p2);

    this.handleReload(this.p1, in1);
    this.handleReload(this.p2, in2);

    this.handleRevive(this.p1, in1, this.p2);
    this.handleRevive(this.p2, in2, this.p1);

    this.handleFiring(this.p1, in1);
    this.handleFiring(this.p2, in2);

    this.handlePickups(this.p1, in1);
    this.handlePickups(this.p2, in2);

    this.combat.updateProjectiles(dt, this.projectiles, this.zombies, [this.p1, this.p2], this.decals);
    this.projectiles = collectStuckBolts(this.projectiles, [this.p1, this.p2]);

    this.ai.update(dt, this.zombies, [this.p1, this.p2], this.map);
    this.noise.propagate(this.zombies, this.map);
    this.countNewAlerts();
    for (const blast of this.blasts) blast.age += dt;
    this.blasts = this.blasts.filter(b => b.age < BLAST_RING_SEC);

    this.handleZombieContact(dt, this.p1);
    this.handleZombieContact(dt, this.p2);

    this.updateSectorHorde(dt);

    for (const zombie of this.zombies) zombie.updateJuice(dt);
    // A dying zombie stays around (excluded from combat/AI targeting via its own
    // `alive` check) just long enough to play its death pop/shrink animation.
    this.zombies = this.zombies.filter(z => z.alive || z.isDying);

    this.camera.updateShake(dt);
    this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 2.5);

    this.updateZombieVoices(dt);
    this.updateObjective(dt, in1, in2);
    this.updateExtraction(dt);
    this.updateSectorExit();

    this.camera.update(
      [
        { x: this.p1.x, y: this.p1.y, alive: !this.p1.isEliminated },
        { x: this.p2.x, y: this.p2.y, alive: !this.p2.isEliminated }
      ],
      dt
    );

    this.checkMissionEnd();

    if (this.netRole === 'host' && this.session) {
      this.netSnapshotAccum += dt;
      if (this.netSnapshotAccum >= 1 / 30) {
        this.netSnapshotAccum -= 1 / 30;
        this.session.sendSnapshot(this.buildSnapshot());
      }
    }
  }

  /** Guest sends local input and renders host-authoritative state from snapshots. */
  private updateGuestClient(dt: number) {
    const in1 = this.input.getPlayer1Input({ x: this.p1.x, y: this.p1.y });
    this.input.endFrame();

    if (this.session) {
      this.netInputSeq++;
      this.session.sendInput(inputToNet(this.netInputSeq, in1));
    }

    if (this.pendingSnapshot) {
      this.applyGuestSnapshot(this.pendingSnapshot);
      this.pendingSnapshot = null;
    } else if (!this.p1.isEliminated) {
      this.p1.update(dt, in1, this.map);
    }

    // Guest controls host P2 — no infiltrator walk rig on this client.

    for (const zombie of this.zombies) zombie.updateJuice(dt);
    this.zombies = this.zombies.filter(z => z.alive || z.isDying);
    this.camera.update(
      [
        { x: this.p1.x, y: this.p1.y, alive: !this.p1.isEliminated },
        { x: this.p2.x, y: this.p2.y, alive: !this.p2.isEliminated }
      ],
      dt
    );
    this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 2.5);
  }

  private handleFootsteps(player: Player) {
    if (!player.justStepped) return;
    this.noise.emit({ x: player.x, y: player.y, radius: player.noiseRadius, type: 'footstep' });
    const wallsToP1 = this.map.countWallsCrossed(player.position, this.p1.position);
    this.sound.playFootstep(this.p1.position, player.position, wallsToP1);
  }

  private handleReload(player: Player, input: PlayerInputState) {
    if (input.isReloading) player.startReload();
  }

  private handleRevive(reviver: Player, input: PlayerInputState, target: Player) {
    if (!target.isDowned) return;
    const dist = Math.hypot(reviver.x - target.x, reviver.y - target.y);
    if (!reviver.isDowned && !reviver.isEliminated && input.isInteracting && dist <= REVIVE_RANGE_PX) {
      if (target.startRevive(FIXED_DT)) this.sound.playRevive(this.p1.position, target.position);
    } else {
      target.resetReviveProgress();
    }
  }

  private handleFiring(player: Player, input: PlayerInputState) {
    if (!input.isFiring || player.isDowned || player.isEliminated) return;

    const beforeShots = player.shotsFired;
    this.combat.fire(player, this.zombies, this.decals, this.projectiles);

    if (player.shotsFired > beforeShots) {
      const wallsToP1 = this.map.countWallsCrossed(player.position, this.p1.position);
      const suppressed = player.activeMuzzle === 'suppressor';
      this.sound.playGunshot(this.p1.position, player.position, wallsToP1, suppressed);
      this.camera.addTrauma(suppressed ? 0.06 : 0.12);
      return;
    }

    // Nothing fired and the mag is dry: click so the player knows why.
    if (player.currentMag <= 0 && !player.isReloading && this.tryConsumeCooldown(this.dryFireCooldown, player.id, 0.35)) {
      this.sound.playDryFire(this.p1.position, player.position);
    }
  }

  /** True when the named cooldown for this key has elapsed; restarts it if so. */
  private tryConsumeCooldown(store: Map<number, number>, key: number, seconds: number): boolean {
    const now = performance.now() / 1000;
    const readyAt = store.get(key) ?? 0;
    if (now < readyAt) return false;
    store.set(key, now + seconds);
    return true;
  }

  private handlePickups(player: Player, input: PlayerInputState) {
    if (!input.isInteracting || player.isDowned || player.isEliminated) return;
    for (const pickup of this.map.pickups) {
      const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (dist > pickup.radius + player.radius) continue;

      switch (pickup.type) {
        case 'medkit':
          player.health = Math.min(player.maxHealth, player.health + 50);
          break;
        case 'ammo':
          // Both guns already full: leave the crate for later (or for the partner).
          if (!player.addAmmoPickup()) continue;
          break;
        case 'keycard':
          player.hasKeycard = true;
          break;
        case 'battery':
          player.flashlightBattery = Math.min(FLASHLIGHT_BATTERY_MAX, player.flashlightBattery + BATTERY_PICKUP_CHARGE);
          break;
      }

      this.map.removePickup(pickup);
      this.sound.playPickup(this.p1.position, pickup);
      break;
    }
  }

  private handleZombieContact(dt: number, player: Player) {
    if (player.isEliminated) return;

    for (const zombie of this.zombies) {
      if (!zombie.alive || zombie.state !== 'ENRAGED') continue;
      const dist = Math.hypot(zombie.x - player.x, zombie.y - player.y);
      if (dist > zombie.radius + player.radius + ZOMBIE_CONTACT_RANGE_PAD) continue;

      if (player.isDowned) {
        player.eliminate();
        this.triggerPlayerHitJuice(true);
      } else {
        player.takeDamage(this.difficultyDef.contactDps * dt);
        // Gate the shake/flash on the same cooldown as the hit sound — contact
        // damage ticks every physics frame, and pulsing per-tick would pin the
        // screen shake at max for the whole grapple instead of reading as hits.
        if (this.tryConsumeCooldown(this.hitSoundCooldown, player.id, 0.4)) {
          this.sound.playPlayerHit(this.p1.position, player.position);
          this.triggerPlayerHitJuice(false);
        }
        if (player.health <= 0) {
          // Solo has no partner who could ever reach you — going down would just be
          // a helpless crawl until a zombie finishes the job, so skip straight there.
          if (this.solo) player.eliminate();
          else player.down();
          this.triggerPlayerHitJuice(true);
        }
      }
    }
  }

  /** Camera shake + a red screen flash on either operative taking a hit — bigger for a down/elimination than a routine bite. */
  private triggerPlayerHitJuice(big: boolean) {
    this.camera.addTrauma(big ? 0.7 : 0.22);
    if (big) this.triggerHitStop(0.1);
    this.damageFlashAlpha = Math.min(1, this.damageFlashAlpha + (big ? 1 : 0.5));
  }

  /** Idle groans, paced by how agitated each zombie is — the main audible cue for offscreen threats. */
  private updateZombieVoices(dt: number) {
    for (const zombie of this.zombies) {
      // Dying zombies linger briefly for their death animation but shouldn't groan mid-collapse.
      if (!zombie.alive) continue;
      zombie.groanTimer -= dt;
      if (zombie.groanTimer > 0) continue;

      const enraged = zombie.state === 'ENRAGED';
      zombie.groanTimer = enraged ? 1.5 + Math.random() * 1.5 : zombie.state === 'SUSPICIOUS' ? 3 + Math.random() * 3 : 7 + Math.random() * 6;

      const walls = this.map.countWallsCrossed(zombie.position, this.p1.position);
      this.sound.playZombieGroan(this.p1.position, zombie.position, walls, enraged);
    }
  }

  /** Held interaction on the sector objective (keycard panel, lab terminal, evac radio). */
  private updateObjective(dt: number, in1: PlayerInputState, in2: PlayerInputState) {
    if (this.map.objectiveComplete) return;
    const obj = this.map.sector.objective;

    const isWorking = (p: Player, input: PlayerInputState) => {
      if (!input.isInteracting || p.isDowned || p.isEliminated) return false;
      if (Math.hypot(p.x - obj.x, p.y - obj.y) > obj.radius + p.radius) return false;
      if (obj.kind === 'keycard_door' && !p.hasKeycard) return false;
      return true;
    };

    if (!isWorking(this.p1, in1) && !isWorking(this.p2, in2)) {
      this.map.objectiveProgress = 0;
      return;
    }

    if (obj.holdSec <= 0) {
      this.completeObjective();
      return;
    }

    this.map.objectiveProgress = Math.min(1, this.map.objectiveProgress + dt / obj.holdSec);
    if (this.map.objectiveProgress >= 1) this.completeObjective();
  }

  private completeObjective() {
    this.map.completeObjective();
    const obj = this.map.sector.objective;
    this.sound.playObjectiveComplete(this.p1.position, { x: obj.x, y: obj.y });
  }

  private updateExtraction(dt: number) {
    const zone = this.map.extractionZone;
    if (zone.radius === 0 || zone.isComplete) return;

    // The chopper is only called once the radio objective is done.
    if (!this.map.objectiveComplete) return;

    const inZone = (p: Player) => !p.isEliminated && Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius;
    const anyoneInZone = inZone(this.p1) || inZone(this.p2);

    if (!zone.isActive && anyoneInZone) {
      zone.isActive = true;
      this.sound.playSiren(this.p1.position, { x: zone.x, y: zone.y });
    }

    zone.isOccupied = anyoneInZone;
    if (zone.isActive) {
      // The clock only runs while someone holds the pad; the horde keeps coming either way.
      if (anyoneInZone) zone.holdoutTimer -= dt;
      this.updateHordeSurge(dt);
      if (zone.holdoutTimer <= 0) {
        zone.holdoutTimer = 0;
        if (anyoneInZone) zone.isComplete = true;
      }
    }
  }

  /**
   * Loud unsuppressed fire wakes every zombie in the sector (ignoring walls) and
   * can call edge reinforcements on a cooldown — the "sector horde frenzy" the
   * armory warns about. Evac holdout already runs its own surge loop.
   */
  private onSectorAlertingShot(player: Player) {
    const source = { x: player.x, y: player.y };
    for (const zombie of this.zombies) {
      if (!zombie.alive || zombie.state === 'ENRAGED') continue;
      zombie.alert('ENRAGED', source);
    }

    const zone = this.map.extractionZone;
    if (zone.isActive) return;
    if (this.sectorHordeCooldown > 0 || this.sectorHordeWarningTimer > 0) return;
    if (this.zombies.length >= HORDE_MAX_ZOMBIES) return;

    this.sectorHordeWarningTimer = SURGE_WARNING_SEC;
    this.sectorHordeCooldown = this.runModifier === 'hush' ? SECTOR_HORDE_COOLDOWN_SEC / 2 : SECTOR_HORDE_COOLDOWN_SEC;
  }

  private updateSectorHorde(dt: number) {
    if (this.sectorHordeWarningTimer > 0) {
      this.sectorHordeWarningTimer -= dt;
      if (this.sectorHordeWarningTimer > 0) return;
      this.spawnSectorHordeWave();
    }

    if (this.sectorHordeCooldown > 0) this.sectorHordeCooldown -= dt;
  }

  private spawnSectorHordeWave() {
    const zone = this.map.extractionZone;
    if (zone.isActive) return;

    const waveSize = surgeSize(!this.p2.isEliminated);
    const attract = { x: this.p1.x, y: this.p1.y };
    for (let i = 0; i < waveSize && this.zombies.length < HORDE_MAX_ZOMBIES; i++) {
      const spawn = this.map.rollSurgeSpawn(Math.random);
      const zombie = new Zombie(spawn.x, spawn.y, 0, pickSurgeArchetype(Math.random()), this.difficultyDef.zombieHpMult);
      zombie.alert('ENRAGED', attract);
      zombie.alertCounted = true;
      this.zombies.push(zombie);
    }
  }

  /** Holdout climax: the siren draws a rolling horde at the pad, arriving faster as the clock runs down (see HordeSurge.ts). */
  private updateHordeSurge(dt: number) {
    this.hordeSpawnTimer -= dt;
    if (this.hordeSpawnTimer > 0) return;
    const zone = this.map.extractionZone;
    this.hordeSpawnTimer = surgeInterval(zone.holdoutDurationSec - zone.holdoutTimer, this.difficultyDef.surgeMinIntervalSec);

    const waveSize = surgeSize(!this.p2.isEliminated);
    for (let i = 0; i < waveSize && this.zombies.length < HORDE_MAX_ZOMBIES; i++) {
      const spawn = this.map.rollSurgeSpawn(Math.random);
      const zombie = new Zombie(spawn.x, spawn.y, 0, pickSurgeArchetype(Math.random()), this.difficultyDef.zombieHpMult);
      zombie.alert('ENRAGED', { x: zone.x, y: zone.y });
      // Arrives already enraged by the siren — not something the team gave away.
      zombie.alertCounted = true;
      this.zombies.push(zombie);
    }
  }

  /**
   * Stealth stat: counts each zombie once, the first time it's ENRAGED while
   * still alive. A silent one-hit kill also flips its target to ENRAGED on
   * the way down, but it's dead by the time this runs, so it isn't counted.
   */
  private countNewAlerts() {
    for (const z of this.zombies) {
      if (z.alertCounted || !z.alive || z.state !== 'ENRAGED') continue;
      z.alertCounted = true;
      this.zombiesAlerted++;
    }
  }

  /** Walking into the exit zone after finishing the objective advances to the next sector. */
  private updateSectorExit() {
    const exit = this.map.sector.exitZone;
    if (!exit || !this.map.objectiveComplete || this.waitingForReward) return;

    // Every operative still in the fight must be standing in the exit — a
    // downed partner has to be revived first, not dragged along for free.
    const atExit = (p: Player) => !p.isDowned && Math.hypot(p.x - exit.x, p.y - exit.y) <= exit.radius;
    const team = [this.p1, this.p2].filter(p => !p.isEliminated);
    if (team.length === 0 || !team.every(atExit)) return;

    const nextSector = SECTORS[this.map.sectorIndex + 1];
    if (!nextSector || !this.callbacks.onSectorReward) {
      this.advanceSector();
      return;
    }

    this.waitingForReward = true;
    this.paused = true;
    this.callbacks.onSectorReward(
      { sectorName: this.map.sector.name, nextSectorName: nextSector.name },
      reward => {
        this.applySectorReward(reward);
        this.advanceSector();
        this.waitingForReward = false;
        this.paused = false;
      }
    );
  }

  private applySectorReward(reward: SectorReward) {
    const team = [this.p1, this.p2].filter(p => !p.isEliminated);
    for (const player of team) {
      switch (reward) {
        case 'medkit':
          player.health = Math.min(player.maxHealth, player.health + 50);
          break;
        case 'ammo':
          player.addAmmoPickup();
          break;
        case 'battery':
          player.flashlightBattery = Math.min(FLASHLIGHT_BATTERY_MAX, player.flashlightBattery + BATTERY_PICKUP_CHARGE);
          break;
      }
    }
  }

  private advanceSector() {
    this.map.loadSector(this.map.sectorIndex + 1, this.layoutRand, this.runModifier);
    this.applyDifficultyToSector();
    this.zombies = [];
    this.projectiles = [];
    this.decals = [];
    this.blasts = [];
    this.hordeSpawnTimer = SURGE_START_INTERVAL_SEC;
    this.sectorHordeCooldown = 0;
    this.sectorHordeWarningTimer = 0;
    this.waitingForReward = false;
    this.spawnZombies();

    const spawns = this.map.sector.playerSpawns;
    for (const [index, player] of [this.p1, this.p2].entries()) {
      player.x = spawns[index].x;
      player.y = spawns[index].y;
      player.resetReviveProgress();
    }
  }

  private checkMissionEnd() {
    if (this.p1.isEliminated && this.p2.isEliminated) {
      this.endMission(false);
      return;
    }
    if (this.map.extractionZone.isComplete) {
      this.endMission(true);
    }
  }

  private endMission(victory: boolean) {
    if (this.netRole === 'host' && this.session) {
      this.session.sendSnapshot(this.buildSnapshot({ victory }));
    }
    this.stop();
    this.callbacks.onMissionEnd({
      victory,
      timeSurvivedSec: this.missionTime,
      totalKills: this.p1.killCount + this.p2.killCount,
      totalShotsFired: this.p1.shotsFired + this.p2.shotsFired,
      sectorReached: this.map.sector.name,
      zombiesAlerted: this.zombiesAlerted,
      silentKills: this.p1.silentKills + this.p2.silentKills,
      difficulty: this.difficultyDef.label,
      runModifier: getSectorModifier(this.runModifier).name
    });
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    this.camera.apply(ctx);

    this.renderFloor(ctx);
    this.renderDecals(ctx);
    this.renderExtractionZone(ctx);
    this.renderObjective(ctx);
    this.renderPickups(ctx);
    this.renderWalls(ctx);
    this.renderProjectiles(ctx);
    this.renderZombies(ctx);
    this.renderPlayers(ctx);
    this.renderMuzzleFlashes(ctx);
    this.hud.renderWorldSpace(ctx, this.p1, this.p2);

    ctx.restore();

    this.renderLighting(ctx);
    this.hud.renderScreenSpace(ctx, this.p1, this.p2, this.map, this.runModifier);
    this.renderBlasts(ctx);
    this.renderSurgeWarning(ctx);
    this.renderDamageFlash(ctx);
    // Reticle dead last: with the OS cursor hidden it *is* the player's pointer,
    // so neither the darkness mask nor the damage vignette may dim it. Drawing
    // it in world space before renderLighting used to bury it under ~96% opaque
    // darkness whenever the pointer left the flashlight cone.
    this.hud.renderReticles(ctx, this.p1, this.p2, this.input.p1AimSource === 'mouse' ? this.input.mousePos : null, this.camera);
    // Touch controls sit on top of everything, reticle included — they're the player's hands.
    this.input.touch.render(ctx, this.p1.flashlightOn);
  }

  /**
   * Bio-Carrier death burst: a green ring expanding to the blast's real alert
   * radius. Drawn after the lighting pass (screen space) because the point is
   * to show the player who just heard it, lit or not.
   */
  private renderBlasts(ctx: CanvasRenderingContext2D) {
    for (const blast of this.blasts) {
      const t = blast.age / BLAST_RING_SEC;
      const c = this.camera.worldToScreen(blast);
      const r = BIO_CARRIER_BLAST_RADIUS * this.camera.zoom * (1 - (1 - t) ** 3);
      ctx.save();
      ctx.strokeStyle = `rgba(140, 230, 60, ${(0.9 * (1 - t)).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Flashing banner before evac waves and sector-alert reinforcement waves. */
  private renderSurgeWarning(ctx: CanvasRenderingContext2D) {
    const zone = this.map.extractionZone;
    const evacWarning = zone.isActive && !zone.isComplete && this.hordeSpawnTimer <= SURGE_WARNING_SEC;
    const sectorWarning = this.sectorHordeWarningTimer > 0;
    if (!evacWarning && !sectorWarning) return;
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    if (!blink) return;
    const text = '⚠ HORDE INCOMING';
    ctx.save();
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#FF5252';
    ctx.fillText(text, CANVAS_WIDTH / 2 - ctx.measureText(text).width / 2, 84);
    ctx.restore();
  }

  /** Red vignette that pulses in on a hit and fades — screen-space, drawn after the lighting pass so the darkness mask doesn't dim it. Only the reticle draws later, since that's the player's pointer. */
  private renderDamageFlash(ctx: CanvasRenderingContext2D) {
    if (this.damageFlashAlpha <= 0) return;
    ctx.save();
    ctx.fillStyle = `rgba(180, 20, 20, ${(this.damageFlashAlpha * 0.35).toFixed(3)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  private renderFloor(ctx: CanvasRenderingContext2D) {
    const bgKey = this.map.sector.backgroundKey;
    if (bgKey && this.assets.drawStretched(ctx, bgKey, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)) return;

    ctx.fillStyle = '#2A2F3A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = '#363C49';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
  }

  private renderDecals(ctx: CanvasRenderingContext2D) {
    for (const d of this.decals) {
      if (d.kind === 'blood' && this.assets.draw(ctx, 'blood_splatter', d.x, d.y, d.angle, d.r * 3.2, 0.85)) continue;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderExtractionZone(ctx: CanvasRenderingContext2D) {
    const zone = this.map.extractionZone;
    if (zone.radius > 0) {
      ctx.strokeStyle = zone.isActive ? '#00E676' : '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#00E5FF';
      ctx.font = '12px monospace';
      ctx.fillText('EVAC PAD', zone.x - 30, zone.y);
    }

    const exit = this.map.sector.exitZone;
    if (exit) {
      const open = this.map.objectiveComplete;
      ctx.strokeStyle = open ? '#00E676' : '#5A6270';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, exit.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = open ? '#00E676' : '#5A6270';
      ctx.font = '12px monospace';
      ctx.fillText(open ? 'EXIT — GO' : 'SEALED', exit.x - 28, exit.y);
    }
  }

  private renderObjective(ctx: CanvasRenderingContext2D) {
    const obj = this.map.sector.objective;
    const done = this.map.objectiveComplete;

    ctx.save();
    ctx.strokeStyle = done ? '#00E676' : '#FF9E1B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = done ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 158, 27, 0.2)';
    ctx.fill();

    if (!done && this.map.objectiveProgress > 0) {
      ctx.strokeStyle = '#FFF4D6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius + 8, -Math.PI / 2, -Math.PI / 2 + this.map.objectiveProgress * Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = done ? '#00E676' : '#FF9E1B';
    ctx.font = '11px monospace';
    const label = done ? 'DONE' : obj.label;
    ctx.fillText(label, obj.x - ctx.measureText(label).width / 2, obj.y + obj.radius + 18);
    ctx.restore();
  }

  private renderPickups(ctx: CanvasRenderingContext2D) {
    const colors: Record<string, string> = { ammo: '#FFC107', medkit: '#FF5252', battery: '#00E5FF', keycard: '#B388FF' };
    for (const pickup of this.map.pickups) {
      const key = `pickup_${pickup.type}` as AssetKey;
      if (this.assets.draw(ctx, key, pickup.x, pickup.y, 0, PICKUP_SPRITE_SIZE)) continue;
      ctx.fillStyle = colors[pickup.type] ?? '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderWalls(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#6E7C96';
    ctx.lineWidth = 5;
    for (const w of this.map.walls) {
      ctx.beginPath();
      ctx.moveTo(w.p1.x, w.p1.y);
      ctx.lineTo(w.p2.x, w.p2.y);
      ctx.stroke();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const bolt of this.projectiles) {
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(bolt.angle);
      ctx.strokeStyle = '#C9C9C9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderZombies(ctx: CanvasRenderingContext2D) {
    for (const z of this.zombies) {
      const aggro = z.state === 'ENRAGED';
      const key: AssetKey =
        z.archetype === 'lurker' && aggro ? 'zombie_lurker_aggro' : (`zombie_${z.archetype}` as AssetKey);
      const size = ZOMBIE_SPRITE_SIZE[z.archetype];

      // Death: a quick squash-pop, then an eased shrink to nothing, rather than
      // just vanishing the instant health hits zero.
      let scale = 1;
      if (z.isDying) {
        const t = z.deathProgress;
        scale = t < 0.3 ? 1 + (t / 0.3) * 0.25 : 1.25 * (1 - (t - 0.3) / 0.7) ** 2;
      }

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(z.angle);
      ctx.scale(scale, scale);

      if (!this.assets.drawCentered(ctx, key, size)) {
        ctx.fillStyle = aggro ? '#7E9B6E' : z.state === 'SUSPICIOUS' ? '#6B7F58' : '#54654A';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!z.isDying) {
        // Eye tell reads the sensory state, which the base sprite can't convey.
        // Offsets are ratios of this archetype's draw size so the eyes sit on the
        // face at every size — they used to be shared absolutes tuned for the
        // 64px lurker, which left the 80px brute's eyes floating off its head.
        const eyeX = size * ZOMBIE_EYE_X;
        const eyeY = size * ZOMBIE_EYE_Y;
        const eyeR = size * ZOMBIE_EYE_R;
        ctx.fillStyle = aggro ? '#E53935' : z.state === 'SUSPICIOUS' ? '#D4E157' : '#5A6B4F';
        ctx.beginPath();
        ctx.arc(eyeX, -eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Bio-Carrier tell: a slow toxic pulse, so players learn before the
        // kill that this one bursts and wakes everything nearby.
        if (z.archetype === 'bio_carrier') {
          const pulse = (Math.sin(performance.now() / 260) + 1) / 2;
          ctx.strokeStyle = `rgba(140, 230, 60, ${(0.35 + pulse * 0.45).toFixed(3)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, size * (0.5 + pulse * 0.08), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (z.hitFlashTimer > 0) {
        // Additive white pulse, not a mask — cheap way to sell "that connected" without needing sprite silhouettes.
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255, 255, 255, ${((z.hitFlashTimer / HIT_FLASH_SEC) * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();

      if (!z.isDying) {
        const healthPct = z.health / z.maxHealth;
        if (healthPct < 1) {
          // Sized and positioned off the archetype's draw size, not the shared
          // 16px collision radius, so the bar grows with the sprite and still
          // clears the top of it instead of landing across the chest.
          const barW = size * ZOMBIE_HEALTH_BAR_W;
          ctx.fillStyle = '#FF5252';
          ctx.fillRect(z.x - barW / 2, z.y - size / 2 - ZOMBIE_HEALTH_BAR_GAP, barW * healthPct, 3);
        }
      }
    }
  }

  /** Operative 1 only (host/solo): procedural walk from `TopDownWalkRig`. */
  private updateOperative1WalkRig(dt: number) {
    const rig = this.assets.infiltratorWalkRig;
    if (!rig || this.netRole === 'guest') return;
    if (this.p1.isEliminated || this.p1.isDowned) return;
    if (this.p1.noiseRadius <= 0) return;
    const mult =
      this.p1.movementState === 'sprint' ? 1.4 : this.p1.movementState === 'sneak' ? 0.72 : 1;
    rig.o.stepsPerSec = WALK_RIG_DEFAULTS.stepsPerSec * mult;
    rig.update(dt);
  }

  private usesInfiltratorWalkRig(p: Player): boolean {
    return (
      p.playerNumber === 1 &&
      !p.isDowned &&
      this.netRole !== 'guest' &&
      this.assets.infiltratorWalkRig !== null
    );
  }

  private renderPlayers(ctx: CanvasRenderingContext2D) {
    for (const p of [this.p1, this.p2]) {
      if (p.isEliminated) continue;
      const key: AssetKey = p.isDowned
        ? 'player_downed'
        : p.playerNumber === 1
        ? 'player_infiltrator'
        : 'player_breacher';

      if (this.usesInfiltratorWalkRig(p)) {
        this.assets.infiltratorWalkRig!.draw(ctx, p.x, p.y, PLAYER_SPRITE_SIZE, p.angle);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (!this.assets.drawCentered(ctx, key, PLAYER_SPRITE_SIZE)) {
          ctx.fillStyle = p.playerNumber === 1 ? (p.isDowned ? '#8E3232' : '#4A5468') : p.isDowned ? '#8E3232' : '#53614C';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          if (!p.isDowned) {
            ctx.fillStyle = '#9AA6BE';
            ctx.fillRect(8, -3, 16, 6);
          }
        }
        ctx.restore();
      }

      if (p.isDowned) {
        ctx.strokeStyle = '#FF5252';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, REVIVE_RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + (p.reviveProgress / 3) * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private renderMuzzleFlashes(ctx: CanvasRenderingContext2D) {
    for (const p of [this.p1, this.p2]) {
      if (p.muzzleFlashTimer <= 0 || p.isDowned || p.isEliminated) continue;

      const weapon = WEAPON_REGISTRY[p.activeWeaponId];
      const flashMult = MUZZLE_MODIFIERS[p.activeMuzzle].flashMult;
      const size = weapon.muzzleFlashRadiusPx * flashMult;
      if (size < 1) continue;

      // Offset scales with the operative's draw size so the flash stays at the
      // muzzle; a hardcoded 26 was fine at a 70px sprite but lands mid-chest at 94px.
      this.assets.draw(
        ctx,
        'muzzle_flash',
        p.x + Math.cos(p.angle) * MUZZLE_BARREL_OFFSET,
        p.y + Math.sin(p.angle) * MUZZLE_BARREL_OFFSET,
        p.angle,
        size,
        0.9
      );
    }
  }

  private renderLighting(ctx: CanvasRenderingContext2D) {
    const beams: FlashlightBeam[] = [];

    for (const p of [this.p1, this.p2]) {
      if (p.isEliminated || p.isDowned || !p.flashlightOn) continue;
      const beam = Flashlight.build({ x: p.x, y: p.y }, p.angle, p.activeRail, this.map.walls);
      if (!beam) continue;
      beams.push(beam);
    }

    const muzzleFlashes: MuzzleFlashPulse[] = [];
    for (const p of [this.p1, this.p2]) {
      if (p.muzzleFlashTimer > 0) {
        muzzleFlashes.push({ origin: { x: p.x, y: p.y }, radius: 140 });
      }
    }

    // Light spill around each operative so they're visible at all — the cone
    // apex is their own centre, so they never stand inside their own beam.
    const carryLights: RadialLight[] = [];
    for (const p of [this.p1, this.p2]) {
      if (p.isEliminated) continue;
      carryLights.push({
        origin: { x: p.x, y: p.y },
        radius: p.isDowned ? CARRY_LIGHT_DOWNED_RADIUS : CARRY_LIGHT_RADIUS
      });
    }

    ShadowRenderer.render(
      ctx,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      c => this.camera.apply(c),
      this.camera.getViewRect(),
      beams,
      muzzleFlashes,
      carryLights
    );
  }
}
