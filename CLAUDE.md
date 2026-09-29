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

# Lint (ESLint + typescript-eslint; enforces no-`any`)
npm run lint

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview

# Re-import baked animation sheets (after extracting pack to .tmp_anim_pack_v2)
npm run import-anim-pack
```

---

## Directory & File Structure

See `progress.md` §3 for the current code map (config, core, entities, lighting, systems, net, ui, tests). The tree below is a quick index only.

```text
src/
  main.ts              Bootstrap: AnimationCatalog → SessionManager → MainMenu → ArmoryMenu → Game
  config/              constants, difficulty, sectors, weapons, zombies, sectorModifiers
  core/                Game, Input, Camera, AssetLoader, SoundManager, seededRand
  graphics/animation/  AnimationCatalog, CharacterAnimController, sheet draw helpers
  entities/            Player, Zombie, Projectile, Pickup, Entity
  lighting/            Raycaster, Flashlight, ShadowRenderer
  systems/             AISystem, CombatSystem, MapManager, NoiseSystem, HordeSurge, NavGrid
  net/                 Protocol, GameSnapshot, iceConfig (optional TURN), SessionManager, roomCode
  ui/                  HUD, ArmoryMenu, MainMenu, LobbyPanel, SectorRewardMenu, …
scripts/               import-anim-pack.mjs (sharp → WebP), dev-playtest.mjs
docs/                  Design specs, ANIMATION_IMPORT.md, PHASE7_ONLINE_LOBBY_PLAN.md
public/assets/         sprites, backgrounds, fx, animations/ (per-character WebP+JSON sheets)
```

---

## Architectural Guidelines & Conventions

### 1. Canvas 2D Lighting Performance
* Never redraw wall raycasting on full frame if neither the light source nor dynamic blockers moved.
* Flashlight cones punch holes in the darkness using `ctx.globalCompositeOperation = 'destination-out'`.
* Cast rays to obstacle vertices plus small angular deltas ($\theta - 0.0001$ and $\theta + 0.0001$) to create clean shadow silhouettes that project to map boundaries.

### 2. Acoustic Noise Calculation
* When a weapon fires, spawn a `SoundEvent(x, y, radius)`.
* For any zombie within `radius`, check if line-of-sight is blocked by walls. For each intervening wall, multiply radius by $(1 - 0.72)$ (`NOISE_WALL_DAMPENING` in `src/config/constants.ts`).
* If residual sound exceeds the suspicious threshold ($0.38$), switch zombie state from `DORMANT` $\to$ `SUSPICIOUS`. Gunshots need $0.55$ to go straight to `ENRAGED`.

### 3. TypeScript Conventions
* Enable `strict: true`. Avoid `any`; use strongly typed event interfaces.
* Keep game physics fixed at $60\text{Hz}$ with delta-time accumulator in `Game.ts`.
* Render loop interpolates between previous and current state for stutter-free 144Hz+ monitors.

### 4. Deployed Asset Paths (GitHub Pages)
* This site deploys under a subpath (`vite.config.ts`'s `base: '/Hushfire/'` on GitHub Actions, `/` locally). Vite only rewrites actual imports and the `index.html` entry script for that base — it does **not** rewrite runtime string literals.
* Never hardcode a leading-slash asset path like `'/assets/sprites/foo.png'` anywhere in `src/` — it resolves at the domain root and 404s under the Pages subpath, silently dropping to placeholder art with no error surfaced in the UI. Build every asset URL from `` `${import.meta.env.BASE_URL}assets/...` `` instead (see `src/core/AssetLoader.ts`).
* After touching `AssetLoader.ts`, `AnimationCatalog.ts`, `vite.config.ts`'s `base`, or adding any new asset reference, verify by building with `GITHUB_ACTIONS=true npm run build`, serving `dist/` under a `/Hushfire/` subpath, and confirming the sprite/item/fx/**animations** requests return 200 — not just that `npm run dev` looks fine, since dev always serves from `/` and won't catch this class of bug. See `docs/ANIMATION_IMPORT.md` for sheet updates.

### 5. Multiplayer Synchronization
* **Lobby (Phase 7 M1):** PeerJS room codes, loadout mirror, host-gated deploy — see `src/net/SessionManager.ts`.
* **Gameplay sync (Phase 7 M2):** Host-authoritative `Game` simulates both operatives; guest sends `PlayerInputState` at 60 Hz (`{t:'input'}`); host broadcasts `{t:'snapshot'}` at ~30 Hz. Guest remaps slots (local P1 = host P2). Wire format in `src/net/GameSnapshot.ts`. Shared layout seed via `mulberry32` in `src/core/seededRand.ts`. Guest draws operatives with snapshot blending between updates; local input still predicts between snapshots.
* No deterministic lockstep — `Math.random` / trig are not cross-browser-safe.
* **NAT / TURN:** Optional `VITE_TURN_CREDENTIALS_URL` in `.env` (see `.env.example`, `src/net/iceConfig.ts`) for symmetric NAT or strict firewalls. Lobby shows a hint on connection errors.

### 6. Co-op is online-only (no local couch / second keyboard)
* **Solo:** Player 2 is eliminated at mission start; one human uses P1 input only.
* **Online:** Operative 2 is driven only by the guest's network input on the host sim (`guestRemoteInput`). Each machine reads **one** keyboard/mouse/touch/gamepad via `getPlayer1Input` — never add `getPlayer2Input`, arrow/IJKL/numpad P2 bindings, or a second local gamepad slot for P2.
* See `AGENTS.md` for the full do-not-revert list.

---

## Phase Milestones
* **Phase 1:** Canvas Raycast Lighting & Flashlight Cones (`src/lighting/`)
* **Phase 2:** Operative Movement & 2-Player Controls (`src/entities/Player.ts`)
* **Phase 3:** Modular Weapon & Attachment System (`src/config/weapons.ts`)
* **Phase 4:** Zombie Acoustic AI & Stealth Reaction Engine (`src/systems/NoiseSystem.ts`)
* **Phase 5:** Multi-Sector Progression & Extraction Climax (`src/systems/MapManager.ts`)
* **Phase 6:** Diegetic HUD & Armory Customization (`src/ui/`)
* **Phase 7:** Multiplayer WebSocket Networking (`src/net/`)
