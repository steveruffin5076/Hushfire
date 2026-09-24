# CLAUDE.md — Instructions for Claude Code

Welcome to **HUSHFIRE**, a 2-player cooperative top-down stealth/assault zombie extraction shooter built for the modern web.

## Project Overview
* **Genre:** 2-Player Co-op Stealth/Assault Extraction Shooter
* **Core Loop:** Pre-mission weapon customization $\to$ Infiltrate pitch-black sectors with weapon-mounted flashlights $\to$ Choose silent takedowns or loud gun-blaze assault $\to$ Reach and hold the extraction zone for evac.
* **Key Mechanics:**
  1. **Dynamic Darkness:** Screen is pitch black except where player flashlights cast 2D raycasted light cones and geometric shadows.
  2. **Acoustic Noise Propagation:** Gunshots and footsteps create radial sound circles that alert sleeping zombies through walls.
  3. **Stealth vs. Assault Balance:** Suppressors & Crossbows conserve ammo and avoid swarms; Shotguns & Assault Rifles wipe hordes but cause sector-wide horde alerts.
  4. **2-Player Co-op Synergy:** Shared darkness mask where player lights combine to eliminate blind spots; down/revive mechanics.

---

## Commands & Build Workflows

```bash
# Install dependencies
npm install

# Start local development server (with HMR)
npm run dev

# Type-check TypeScript code
npm run typecheck

# Run unit tests (Vitest, tests/*.test.ts)
npm test

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Directory & File Structure

```text
hushfire/
├── CLAUDE.md                   # This instruction file for Claude Code
├── index.html                  # Main canvas entry page
├── package.json                # Project dependencies & build scripts
├── tsconfig.json               # TypeScript strict configuration
├── vite.config.ts              # Vite dev server configuration
├── docs/                       # Complete game design specifications
│   ├── WEAPON_CUSTOMIZATION.md # Ballistics, sound radius, attachments & damage formulas
│   ├── PLAN_AND_PHASES.md      # Detailed phase-by-phase implementation plan
│   └── ART_SPECIFICATION.md    # Master asset manifest, color palettes & sprite dimensions
├── public/
│   └── assets/
│       ├── branding/           # Key art & logo concepts
│       ├── sprites/            # Top-down characters & zombies (.png and .svg)
│       ├── weapons/            # Weapons & modular attachments (.png and .svg)
│       ├── items/              # Pickups: ammo, medkit, battery, keycard
│       └── fx/                 # Muzzle flashes, reticles, acoustic ripples, decals
└── src/
    ├── main.ts                 # Bootstrap & canvas mounting
    ├── config/
    │   ├── constants.ts        # Physics rates, colors, canvas constants
    │   ├── weapons.ts          # Weapon data & attachment modifier calculations
    │   └── zombies.ts          # Zombie types, speeds, awareness rates
    ├── core/
    │   ├── Game.ts             # Game orchestrator, loop, and state machine
    │   ├── Input.ts            # Dual-player keyboard/mouse/gamepad input
    │   ├── Camera.ts           # Smooth 2D tracking camera with dual-player zoom
    │   └── SoundManager.ts     # Web Audio API spatial audio & sound synthesizer
    ├── lighting/
    │   ├── Raycaster.ts        # 2D line segment intersection & polygon builder
    │   ├── Flashlight.ts       # Flashlight cone math, angles, and falloff
    │   └── ShadowRenderer.ts   # Subtractive canvas lighting mask
    ├── entities/
    │   ├── Entity.ts           # Base spatial entity class
    │   ├── Player.ts           # Operative with flashlight, health, inventory
    │   ├── Zombie.ts           # Zombie sensory AI (Dormant, Investigating, Aggro)
    │   ├── Projectile.ts       # Bullets, pellets, and retrievable bolts
    │   └── Pickup.ts           # Pickups & interaction triggers
    ├── systems/
    │   ├── NoiseSystem.ts      # Radial sound propagation & wall occlusion
    │   ├── CombatSystem.ts     # Firing, recoil, hit detection, muzzle light
    │   ├── AISystem.ts         # Zombie sensory updates & pathfinding
    │   └── MapManager.ts       # Map segments, walls, extraction beacon
    └── ui/
        ├── HUD.ts              # Minimal diegetic ammo, sound gauge, health
        └── ArmoryMenu.ts       # Pre-mission weapon customizer screen
```

---

## Architectural Guidelines & Conventions

### 1. Canvas 2D Lighting Performance
* Never redraw wall raycasting on full frame if neither the light source nor dynamic blockers moved.
* Flashlight cones punch holes in the darkness using `ctx.globalCompositeOperation = 'destination-out'`.
* Cast rays to obstacle vertices plus small angular deltas ($\theta - 0.0001$ and $\theta + 0.0001$) to create clean shadow silhouettes that project to map boundaries.

### 2. Acoustic Noise Calculation
* When a weapon fires, spawn a `SoundEvent(x, y, radius)`.
* For any zombie within `radius`, check if line-of-sight is blocked by walls. For each intervening wall, multiply radius by $(1 - 0.65)$.
* If residual sound exceeds zombie awareness threshold ($0.3$), switch zombie state from `DORMANT` $\to$ `SUSPICIOUS` or `ENRAGED`.

### 3. TypeScript Conventions
* Enable `strict: true`. Avoid `any`; use strongly typed event interfaces.
* Keep game physics fixed at $60\text{Hz}$ with delta-time accumulator in `Game.ts`.
* Render loop interpolates between previous and current state for stutter-free 144Hz+ monitors.

### 4. Deployed Asset Paths (GitHub Pages)
* This site deploys under a subpath (`vite.config.ts`'s `base: '/Hushfire/'` on GitHub Actions, `/` locally). Vite only rewrites actual imports and the `index.html` entry script for that base — it does **not** rewrite runtime string literals.
* Never hardcode a leading-slash asset path like `'/assets/sprites/foo.png'` anywhere in `src/` — it resolves at the domain root and 404s under the Pages subpath, silently dropping to placeholder art with no error surfaced in the UI. Build every asset URL from `` `${import.meta.env.BASE_URL}assets/...` `` instead (see `src/core/AssetLoader.ts`).
* After touching `AssetLoader.ts`, `vite.config.ts`'s `base`, or adding any new asset reference, verify by building with `GITHUB_ACTIONS=true npm run build`, serving `dist/` under a `/Hushfire/` subpath, and confirming the sprite/item/fx requests return 200 — not just that `npm run dev` looks fine, since dev always serves from `/` and won't catch this class of bug.

### 5. Multiplayer Synchronization
* Operative inputs are serialized as compact bitmasks (`uint8` for movement, `float32` for aim angle).
* Host/Server is authoritative for zombie spawns, health, and extraction timers.
* Client predicts local player movement and reconciles against server snapshots.

---

## Phase Milestones
* **Phase 1:** Canvas Raycast Lighting & Flashlight Cones (`src/lighting/`)
* **Phase 2:** Operative Movement & 2-Player Controls (`src/entities/Player.ts`)
* **Phase 3:** Modular Weapon & Attachment System (`src/config/weapons.ts`)
* **Phase 4:** Zombie Acoustic AI & Stealth Reaction Engine (`src/systems/NoiseSystem.ts`)
* **Phase 5:** Multi-Sector Progression & Extraction Climax (`src/systems/MapManager.ts`)
* **Phase 6:** Diegetic HUD & Armory Customization (`src/ui/`)
* **Phase 7:** Multiplayer WebSocket Networking (`src/net/`)
