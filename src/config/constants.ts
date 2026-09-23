export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const PHYSICS_TICK_RATE = 60;
export const DT = 1 / PHYSICS_TICK_RATE;

// Visual & Lighting Constants
export const DARKNESS_COLOR = 'rgba(5, 5, 8, 0.88)';
export const P1_LIGHT_COLOR = '#EBF4FA'; // Arc White
export const P2_LIGHT_COLOR = '#FF9E1B'; // Warm Amber

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
