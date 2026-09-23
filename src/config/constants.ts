export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const PHYSICS_TICK_RATE = 60;
export const DT = 1 / PHYSICS_TICK_RATE;

// Visual & Lighting Constants
// Bumped from 0.88: with sector background art now drawn under this overlay
// (see Game.ts's renderFloor), that opacity let a lighter/detailed floor
// texture read as clearly visible outside the flashlight, breaking the
// "screen is pitch black except where lit" mechanic. 0.96 keeps it dim
// enough to reveal only silhouette-level detail without a light on it.
export const DARKNESS_COLOR = 'rgba(5, 5, 8, 0.96)';
export const P1_LIGHT_COLOR = '#EBF4FA'; // Arc White
export const P2_LIGHT_COLOR = '#FF9E1B'; // Warm Amber

// Flashlight Battery — drains only while lit, forces off at empty. 300s of
// continuous on-time per full charge is comfortably enough to clear a sector
// without a pickup if you're reasonably economical about going dark to sneak;
// a battery pickup restores half a charge, mirroring the medkit's 50/100 HP.
export const FLASHLIGHT_BATTERY_MAX = 100;
export const FLASHLIGHT_FULL_CHARGE_SEC = 300;
export const FLASHLIGHT_DRAIN_PER_SEC = FLASHLIGHT_BATTERY_MAX / FLASHLIGHT_FULL_CHARGE_SEC;
export const BATTERY_PICKUP_CHARGE = 50;

// Audio & Noise Constants
// Difficulty-tuned up from 0.65: walls muffle sound more, so a stray footstep
// or shot is less likely to blow a stealth run sector-wide.
export const WALL_SOUND_DAMPENING = 0.72;
export const SNEAK_SPEED = 70; // px/s
export const WALK_SPEED = 160;  // px/s
export const SPRINT_SPEED = 280; // px/s

export const SNEAK_NOISE_RADIUS = 20; // px
export const WALK_NOISE_RADIUS = 90;  // px
export const SPRINT_NOISE_RADIUS = 260; // px

// Downed / Revive Mechanic
export const DOWNED_CRAWL_SPEED = 45; // px/s (~0.8 m/s)
export const REVIVE_RANGE_PX = 110;   // ~2m
export const REVIVE_TIME_SEC = 3.0;

// Zombie Acoustic Sensory Constants
// Difficulty-tuned up from 0.3/0.7/260: zombies need a clearer signal before
// reacting, and a scream no longer chain-alerts as wide an area.
export const ZOMBIE_AWARENESS_THRESHOLD = 0.38;
export const ZOMBIE_ENRAGE_THRESHOLD = 0.8;
export const ZOMBIE_SCREAM_ALERT_RADIUS = 200; // ~7.5m, alerts nearby dormant zombies
