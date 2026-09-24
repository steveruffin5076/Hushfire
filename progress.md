# HUSHFIRE — Progress

Last checked: 2026-09-24, against `main` after PR #15.

## Done

### Core game (Phases 1–6)
- All planned modules from `docs/PLAN_AND_PHASES.md` exist under `src/`: `lighting/` (Raycaster, Flashlight, ShadowRenderer), `entities/` (Entity, Player, Zombie, Projectile, Pickup), `systems/` (NoiseSystem, CombatSystem, AISystem, MapManager), `ui/` (HUD, ArmoryMenu), `config/` (constants, weapons, zombies).
- Extras beyond the original plan: `systems/NavGrid.ts` and `systems/Geometry.ts` (pathfinding/geometry), `config/sectors.ts`, `core/AssetLoader.ts`, `ui/MainMenu.ts`, `ui/PauseMenu.ts`, `ui/QuitScreen.ts`, `ui/ExtractionModal.ts`, `ui/theme.ts`.
- 3 sectors (Transit → Bio-Lab → Helipad), each with its own background art. Interior walls are lined up with the structures drawn in the art. Players and zombies share the same wall collision (`MapManager.resolveCircleCollision`).
- Flow: title screen (key art) → armory → sectors → extraction.
- `npm run typecheck` and `npm run build` pass from a fresh clone.

### Art
- P1 Infiltrator, P2, and all zombie archetypes (including the lurker aggro variant) use the uploaded top-down art. It is processed into 128×128 transparent sprites facing +X, centered on the pivot.
- Character sprites are drawn larger than their collision radius. Draw size is purely cosmetic (`PLAYER_SPRITE_SIZE` / `ZOMBIE_SPRITE_SIZE` in `Game.ts`).
- Darkness mask raised to `rgba(5,5,8,0.96)`, so the new background art stays hidden outside flashlight cones.
- Bold red reticle drawn above the lighting pass. The OS cursor is hidden during gameplay.

### Flashlight battery
- The battery drains only while the flashlight is on: 100 charge lasts 300 s. At 0 the light forces off and can't be turned back on.
- A battery pickup restores +50 charge (capped at 100).
- HUD battery bar is shown while the light is on or the charge is below 30%, and scales to `FLASHLIGHT_BATTERY_MAX`.
- Clickable "FLASHLIGHT ON/OFF" HUD button for P1 (keys: P1 `T`, P2 `'`).

### Armory
- The armory remembers the last game mode and both operatives' loadouts in `localStorage` (`src/ui/LoadoutStorage.ts`). Saves from older builds are checked field by field: a weapon or attachment that no longer exists resets to the default, and the rest is kept.

### Gameplay fixes (from the design review)
- The knife backstab now triggers when you're actually behind the zombie (its rear 120°). It used to trigger face-to-face.
- The brute's front-armour check no longer misfires near the ±π angle wrap (`Geometry.angleBetween`).
- The knife never uses or reloads ammo (`infiniteAmmo`).
- Ammo crates give +2 mags to each gun, capped at the starting reserve. The crate stays on the floor if both guns are full.
- Every living operative must reach the exit, and a downed partner must be revived first. There's no free revive on sector change.
- The evac holdout clock only runs while someone is on the pad.

### Stealth tuning (from the design review)
- Zombies now notice a player in plain view who is moving faster than a sneak: within 40 px while dormant, 100 px once suspicious (`DORMANT_NOTICE_RADIUS` / `SUSPICIOUS_NOTICE_RADIUS`). Sneaking or standing still stays hidden.
- Suppressor sound multiplier raised from 0.15 to 0.35. The MPX (133 px) and Glock (140 px) stay "stealth ready"; the M4 (227 px), shotgun and revolver don't.
- Gunshots enrage at intensity 0.55 instead of 0.8 (`GUNSHOT_ENRAGE_THRESHOLD`). An unsuppressed shotgun now enrages out to about 382 px instead of 170 px, while suppressed shots barely change.

### Finale tuning (from the design review)
- Evac horde surges speed up as the holdout clock runs: every 10 s at the start, every 4 s by the end (`src/systems/HordeSurge.ts`). Co-op waves are 2 zombies, and the mix now includes a 10% brute chance.
- Sector 3 has 2 extra zombies guarding the pad. Starting zombie HP now rises every sector: 358 → 466 → 498.

### Readability (from the design review)
- Bio-carriers have a pulsing green ring. When one dies, a green shockwave expands to its 400 px alert radius, drawn above the darkness.
- A flashing "HORDE INCOMING" banner shows for 2 s before each evac wave.
- The end screen shows silent kills, zombies alerted, and a stealth rating (GHOST 0 / SHADOW ≤3 / OPERATOR ≤8 / LOUD) (`src/ui/StealthRating.ts`).

### Gamepad
- Standard-layout controllers work alongside the keyboard (`src/core/Gamepad.ts`, polled by `InputManager`). Left stick moves, right stick aims, RT fires, Start pauses and resumes. The full table is in `docs/COOP_SESSION_GUIDE.md` §5.
- Who gets which pad: solo → P1; co-op with one pad → P2 (P1 keeps the mouse); two pads → one each. P1 switches between mouse and stick aim automatically, depending on which moved last.
- Menus are pad-navigable too (`src/ui/MenuGamepadNav.ts`). A cyan highlight moves between buttons and dropdowns spatially, A presses, D-pad ←/→ changes dropdowns, and B resumes from pause. Pausing and resuming reset pad button state, so a menu press never leaks into gameplay.

### Touch
- Phones/tablets get on-screen twin-stick controls for P1 after the first touch (`src/core/TouchControls.ts`). Floating move and aim sticks; pushing the aim stick past a threshold fires. SPRINT/SNEAK toggles, RELOAD/USE/SWAP/LIGHT buttons, and a pause button. Upright touch devices get a "rotate to landscape" prompt.

### Infrastructure
- GitHub Pages deploy via `.github/workflows/deploy-pages.yml` (`npm ci` + `npm run lint` + `npm test` + `npm run build` on every push to `main`).
- Asset URLs are built from `import.meta.env.BASE_URL`, so they load under the `/Hushfire/` subpath. This is a permanent guardrail in `CLAUDE.md` §4.
- Vitest unit tests in `tests/` (`npm test`, also run by the deploy workflow before building): geometry, wall collision, noise and wall muffling, flashlight battery, and a per-sector check that every spawn, pickup and goal is inside the map, not inside a wall, and reachable.
- ESLint (`npm run lint`, `eslint.config.js`): `@eslint/js` + `typescript-eslint` recommended rules, with `no-explicit-any` as an error. Also run by the deploy workflow.
- `.gitignore` added; `node_modules/` and `dist/` are no longer tracked. After pulling, run `npm install` once locally.

## Pending

- **Phase 7 online co-op** isn't built yet. `docs/PHASE7_ONLINE_LOBBY_PLAN.md` has the plan, but there is no `Protocol.ts`, no server, and no host/client sync. `net/SessionManager.ts` is a client-side stub only.
- Touch controls only drive P1. Two players sharing one phone isn't supported.
- The flashlight HUD button only accepts clicks for P1. Local co-op shares one mouse, so this only matters once online play exists.
