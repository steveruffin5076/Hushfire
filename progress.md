# HUSHFIRE — Progress

Last checked: 2026-09-23. Branch `claude/wonderful-gates-b4sus4` (mirrors `main`), working tree clean, 2 commits.

## Done

- All planned modules from `docs/PLAN_AND_PHASES.md` exist under `src/`: `lighting/` (Raycaster, Flashlight, ShadowRenderer), `entities/` (Entity, Player, Zombie, Projectile, Pickup), `systems/` (NoiseSystem, CombatSystem, AISystem, MapManager), `ui/` (HUD, ArmoryMenu), `config/` (constants, weapons, zombies).
- Extras beyond the original plan: `src/systems/NavGrid.ts` and `src/systems/Geometry.ts` (pathfinding/geometry helpers), `src/net/SessionManager.ts` (partial Phase 7 client-side networking stub), `src/config/sectors.ts`, `src/core/AssetLoader.ts`, `src/ui/theme.ts`, `src/ui/QuitScreen.ts`, `src/ui/PauseMenu.ts`, `src/ui/ExtractionModal.ts`.
- `Game.ts` (824 lines) is the central orchestrator — largest file in the codebase. `ArmoryMenu.ts` (464 lines) is the next largest.
- `npm run typecheck` passes clean — no TypeScript errors.
- Full asset manifest present and matching `docs/ART_SPECIFICATION.md`: sprites, weapons/attachments, fx, item icons (both `.png` and `.svg`) under `public/assets/`, plus `generate_assets.py` used to produce them.
- A built bundle already exists in `dist/` (checked into git) from a prior successful build.

## Pending / Broken

- **`npm run build` currently fails**: `node_modules/.bin/vite` is missing its execute bit (`-rw-r--r--` instead of `-rwxr-xr-x`), so `vite build` errors with `Permission denied`. Environment/install artifact, not a code bug — fix with `chmod +x node_modules/.bin/vite` or a clean `npm install`, then re-verify the build.
- No test suite anywhere in the repo.
- Phase 7 (multiplayer networking) is incomplete: no `Protocol.ts` (packet schemas) and no actual WebSocket/PartyKit server — `SessionManager.ts` is a client-side-only stub, not full host/client sync per `CLAUDE.md`'s Multiplayer Synchronization guidance.
- Not yet verified in-browser: no manual playtest done this session (`npm run dev` was not launched) to confirm lighting, movement, combat, and AI actually work together at runtime — typecheck passing only confirms types, not gameplay behavior.
- No `package.json` lint script or config for enforcing the `strict: true` / no-`any` convention beyond what `tsc` itself catches.
