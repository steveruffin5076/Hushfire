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

### Infrastructure
- GitHub Pages deploy via `.github/workflows/deploy-pages.yml` (`npm ci` + `npm test` + `npm run build` on every push to `main`).
- Asset URLs are built from `import.meta.env.BASE_URL`, so they load under the `/Hushfire/` subpath. This is a permanent guardrail in `CLAUDE.md` §4.
- Vitest unit tests in `tests/` (`npm test`, also run by the deploy workflow before building): geometry, wall collision, noise and wall muffling, flashlight battery, and a per-sector check that every spawn, pickup and goal is inside the map, not inside a wall, and reachable.
- `.gitignore` added; `node_modules/` and `dist/` are no longer tracked. After pulling, run `npm install` once locally.

## Pending

- **Phase 7 online co-op** isn't built yet. `docs/PHASE7_ONLINE_LOBBY_PLAN.md` has the plan, but there is no `Protocol.ts`, no server, and no host/client sync. `net/SessionManager.ts` is a client-side stub only.
- **No gamepad support**, even though `CLAUDE.md` lists it for `Input.ts`.
- **No touch/mobile controls.**
- The flashlight HUD button only accepts clicks for P1. Local co-op shares one mouse, so this only matters once online play exists.
- No lint script or config beyond what `tsc` enforces.
