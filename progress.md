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

- **`npm run build` and `npm run dev` cannot work from a fresh clone on Linux or macOS.** Root cause is *not* the missing execute bits on `node_modules/.bin/*` (that was a symptom, and meaningless on Windows where the tree was committed). The real problem: `node_modules/` is tracked in git because there is no `.gitignore`, and the committed tree contains **only Windows platform binaries** — `git ls-files node_modules/@esbuild node_modules/@rollup` returns exactly `@esbuild/win32-x64`, `@rollup/rollup-win32-x64-gnu` and `@rollup/rollup-win32-x64-msvc`. On Linux, vite dies with `Cannot find module @rollup/rollup-linux-x64-gnu` (the known npm optional-dependency bug, npm/cli#4828), and esbuild's binary is the wrong platform too.
  - CI is unaffected only because `npm ci` deletes `node_modules/` and reinstalls the correct linux optional deps from the lockfile.
  - Real fix: add `.gitignore`, `git rm -r --cached node_modules dist`, and have each contributor run `npm install` locally. The vendored tree is ~47 MB of binaries that are useless to CI and to every non-Windows contributor.
  - Workaround for working in this sandbox without touching the repo: install the two linux packages outside the tree and point node at them — `NODE_PATH=<dir>/node_modules ESBUILD_BINARY_PATH=<dir>/node_modules/@esbuild/linux-x64/bin/esbuild node ./node_modules/vite/bin/vite.js`. Verified: dev server serves 200 and `vite build` succeeds (34 modules) with `GITHUB_ACTIONS=true`, emitting the correct `/Hushfire/` subpath.
  - Side effect worth knowing: because `node_modules/` is tracked, simply *running* the dev server dirties the repo (`node_modules/.vite/deps/_metadata.json`), so commits must be staged by explicit path until the `.gitignore` fix lands.
- No test suite anywhere in the repo.
- Phase 7 (multiplayer networking) is incomplete: no `Protocol.ts` (packet schemas) and no actual WebSocket/PartyKit server — `SessionManager.ts` is a client-side-only stub, not full host/client sync per `CLAUDE.md`'s Multiplayer Synchronization guidance.
- Not yet verified in-browser: no manual playtest done this session (`npm run dev` was not launched) to confirm lighting, movement, combat, and AI actually work together at runtime — typecheck passing only confirms types, not gameplay behavior.
- No `package.json` lint script or config for enforcing the `strict: true` / no-`any` convention beyond what `tsc` itself catches.
