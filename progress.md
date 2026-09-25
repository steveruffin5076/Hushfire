# HUSHFIRE — Progress & Handoff

Last updated: 2026-09-25, against `main` at `08bb3ca` (merge of PR #33). Written as a handoff for another developer or AI assistant, e.g. Cursor. Read this first, then `CLAUDE.md`.

**Revisions:** **2026-09-25** reconciled the PR #14-era audit (written at `b0319d8`) against the current tree — many findings from that audit are now **fixed** (see §5 "Resolved since the PR #14 audit"). Open bugs and engagement gaps below are live findings with file evidence.

**Status in one line:** the full single-machine game is playable and deployed. Title → armory → 3 sectors → evac, solo or 2-player local co-op, on keyboard/mouse, gamepad or touch. **Online co-op (Phase 7) is the main thing not built yet.**

- Live site: https://steveruffin5076.github.io/Hushfire/
- Repo: https://github.com/steveruffin5076/Hushfire (default branch `main`)
- **33 PRs merged** on `main`. 41 TypeScript files under `src/`, ~6,060 lines. Largest: `Game.ts` (1026), `ArmoryMenu.ts` (510), `HUD.ts` (283), `Player.ts` (281), `SoundManager.ts` (248).

---

## 1. Quick start

```bash
npm install        # after any pull that touched package.json
npm run dev        # http://localhost:3000 (or 3001 if 3000 is taken)
npm run typecheck  # tsc --noEmit (covers src/ and tests/)
npm run lint       # ESLint + typescript-eslint; `any` is an error
npm test           # Vitest, 257 tests in tests/
npm run build      # tsc && vite build → dist/
```

CI (`.github/workflows/deploy-pages.yml`) runs `npm ci` → `npm run lint` → `npm test` → `npm run build` on every **push to `main`**, then deploys to GitHub Pages. **A failing lint or test blocks the deploy.** There is still no `pull_request` trigger — PRs are only validated after merge.

---

## 2. Rules that must not be broken

1. **Asset paths.** The site is served under `/Hushfire/`. Never hardcode `'/assets/...'` in `src/`. Always use `` `${import.meta.env.BASE_URL}assets/...` `` (see `src/core/AssetLoader.ts`, `src/ui/MainMenu.ts`). After touching asset loading, verify with `GITHUB_ACTIONS=true npm run build` and serve `dist/` under a `/Hushfire/` subpath. See `CLAUDE.md` §4.
2. **`node_modules/` and `dist/` are git-ignored.** Never commit them.
3. **Keep lint, typecheck and tests green.** Add a test for every behaviour change. Most game logic is plain TypeScript and testable without a browser (see §8).
4. **Walls must match the art.** Each sector's `boxes` in `src/config/sectors.ts` are hand-aligned to the background image. `tests/sectors.test.ts` checks every possible spawn/pickup alt is on walkable floor and reachable.
5. **Sprites:** 128×128 PNG, facing +X, pivot at canvas centre. Draw size is cosmetic (`PLAYER_SPRITE_SIZE` / `ZOMBIE_SPRITE_SIZE` in `Game.ts`); collision radius stays **16 px**.
6. **Never run `generate_assets.py` wholesale.** It regenerates procedurally and will **clobber the 7 hand-made character sprites** with old placeholders. No per-asset entry point.
7. **Workflow:** small PRs to `main`, one topic each, merged once checks pass. **Update this file when something ships.**

---

## 3. Code map

```text
src/
  main.ts                 Bootstrap: AssetLoader → MainMenu → ArmoryMenu → Game; pause/end-screen wiring
  config/
    constants.ts          Speeds, noise radii, thresholds, flashlight battery, notice radii
    difficulty.ts         EASY/NORMAL/HARD table (HP, contact dmg, notice, evac hold, wave speed)
    sectors.ts            3 sector definitions: wall boxes, doors, spawns, zombies+alts, pickups+alts, objective, exit/evac
    sectorLayout.ts       Per-run shuffle: picks one spot per zombie/pickup from its alts
    weapons.ts            Weapons + muzzle/rail/ammo modifiers
    zombies.ts            Zombie archetypes (lurker, audio_stalker, bio_carrier, armored_brute)
  core/
    Game.ts               Orchestrator (~1000 lines): fixed 60 Hz update, render, pickups, objectives, sector advance, evac, end
    Input.ts              Keyboard/mouse for P1 and P2, merges gamepad + touch; poll()/endFrame()/dispose()
    Gamepad.ts            Pure gamepad mapping + pad assignment rules
    TouchControls.ts      On-screen twin-stick controls for P1 (drawn on canvas)
    Camera.ts             Follow/zoom/shake; worldToScreen/screenToWorld
    AssetLoader.ts        All sprite/bg/fx URLs (BASE_URL-safe)
    SoundManager.ts       Web Audio synth, spatial panning, wall muffling
  entities/               Entity, Player (ammo, battery, revive), Zombie, Projectile (bolts), Pickup
  lighting/               Raycaster (cone polygons), Flashlight, ShadowRenderer (darkness mask)
  systems/
    AISystem.ts           Zombie senses (light, close-range notice) + movement/pathing
    NoiseSystem.ts        Sound events → SUSPICIOUS/ENRAGED, wall dampening, scream propagation (AI only)
    CombatSystem.ts       Firing, hitscan, melee/backstab, armour, bolts (collectStuckBolts)
    MapManager.ts         Walls, collision, pickups, doors, extraction zone, NavGrid, surge spawn validation
    NavGrid.ts            A* grid pathfinding
    Geometry.ts           Segment math, angleBetween
    HordeSurge.ts         Evac wave pacing, mix, raw edge spawn points (validated by MapManager)
  ui/                     HUD, ArmoryMenu, MainMenu, PauseMenu, ExtractionModal (end screen), QuitScreen,
                          LoadoutStorage (localStorage), MenuGamepadNav, StealthRating, theme
  net/SessionManager.ts   Phase 7 stub only — not wired to anything
tests/                    16 Vitest files, 257 tests (see §8)
docs/                     Design specs + PHASE7_ONLINE_LOBBY_PLAN.md
public/assets/            Processed game art (sprites, backgrounds, branding, items, fx)
images/                   Raw art uploads from the owner (source material, not loaded by the game)
```

---

## 4. What's done

### Core loop
- Title screen → armory (mode, difficulty, loadouts) → Sector 1 Transit → Sector 2 Bio-Lab → Sector 3 Helipad → end screen.
- **Sector objectives:** S1 keycard + blast door; S2 lockdown terminal (3.5 s hold); S3 radio (2.5 s) then evac pad horde holdout.
- Solo (P2 never spawns; 0 HP = elimination) or 2-player local co-op (downed → revivable crawl).
- Health, ammo and battery carry over between sectors. Run is ~6–10 min.

### Lighting, stealth & combat
- Raycast darkness + flashlight cones; battery drain; acoustic noise propagation; close-range notice; suppressors; knife backstab; brute armour; bio-carrier death blast; reticle drawn after lighting pass; procedural red reticle (PR #14).
- **7 weapons** with muzzle/rail/ammo attachments; crossbow bolts retrievable; pickups: ammo, medkit, battery, keycard.

### Difficulty & replayability
- **EASY / NORMAL / HARD** in armory (`config/difficulty.ts`).
- **Layout shuffle:** each zombie/pickup has 2 `alts`; one picked per run. Sector zombie HP totals: **358 → 466 → 498** (S3 finale is hardest, not easiest — fixed since the PR #14 audit).
- **Evac horde:** pacing tightens to difficulty minimum; co-op doubles wave size; mix 40/25/25/10%; cap 18. **`MapManager.rollSurgeSpawn`** (PR #33) prevents spawning inside Sector 3 off-roof blockers.
- **End screen:** stats + **stealth rating** (GHOST / SHADOW / OPERATOR / LOUD) via `StealthRating.ts`.
- **Loadout persistence:** mode, difficulty, both loadouts in `localStorage` (`LoadoutStorage.ts`).

### Controls
- Keyboard/mouse, **gamepad** (including menu nav), **touch** twin-stick for P1. See `docs/COOP_SESSION_GUIDE.md` §5.

### Tooling & quality
- `.gitignore` for `node_modules/` and `dist/`; `npm install` works on Linux/macOS.
- **257 Vitest tests**, ESLint with `any` as error, CI lint+test+build on push to `main`.

### Phase 7 prep
- `docs/PHASE7_ONLINE_LOBBY_PLAN.md` — PeerJS, host-authoritative, typed messages, armory-as-lobby.

---

## 5. Known bugs & gaps (prioritized)

Live findings against `main@08bb3ca`. **Nothing below has been started** unless noted as fixed in §5.1.

### P0 — resource leaks on every restart

Both accumulate per replay. Neither is caught by typecheck, lint, or the current test suite.

- **`InputManager` leaks 6 permanent `window` listeners per `Game` instance.** Constructor attaches keydown, keyup, mousemove, mousedown, mouseup, contextmenu to `window` with inline arrows (`Input.ts:47-64`). `dispose()` only detaches touch (`Input.ts:256-258`); `Game.stop()` does not remove the window listeners (`Game.ts:241-246`). `main.ts` creates a new `Game` on every deploy/restart, so each replay adds 6 immortal listeners — mousemove calls `getBoundingClientRect()` every move per leaked instance. **Fix:** named handlers + full `dispose()` from `Game.stop()`.
- **`SoundManager` leaks an `AudioContext` per `Game`.** `private sound = new SoundManager()` (`Game.ts:80`); no `close()` anywhere in `SoundManager.ts`. After ~6 replays Chrome can silently stop audio. **Fix:** share one `SoundManager` across games, or `close()` in `Game.stop()`.

### P0 — can permanently hang a run **(CO-OP ONLY)**

> **Solo is correct** (`Game.ts:464-467`): solo skips `down()` and goes straight to `eliminate()`. P2 is eliminated at start in solo (`Game.ts:186`). Do not "fix" solo.

- **Both players downed = mission never ends.** `AISystem` excludes downed players from targeting (`AISystem.ts:25`); enraged zombies with no living target idle (`updateEnraged`). Downed players cannot revive each other (`Game.ts:379`: reviver must not be downed). No bleed-out timer — `Player.down()` sets the flag and only enraged contact escalates to eliminated (`Game.ts:451-452`). `checkMissionEnd()` fails only when **both** eliminated (`Game.ts:617-619`). Result: both down in co-op = crawl forever; only Esc → Restart escapes. **Fix:** bleed-out timer and/or fail when no player can act.

### P1 — co-op correctness & feel

- **Every sound is spatialized to Player 1.** All `this.sound.*` call sites pass `this.p1.position` as the listener, including P2's footsteps and gunfire (`Game.ts` — e.g. 368-369, 393-395). P2 hears the world through P1's ears. **Fix:** camera midpoint or per-player listener at call sites.
- **Horde scream cascade is silent.** `SoundType` includes `'scream'` (`NoiseSystem.ts:12`); `propagateScreams()` alerts zombies (`NoiseSystem.ts:66-74`) but nothing calls `sound.playScream`. Biggest noise punishment gives no audio warning.
- **No zombie–zombie separation.** `AISystem` resolves walls only (`AISystem.ts:50-52`). 18-cap horde stacks into one pile (worse after ×1.35 sprites).
- **HUD is not diegetic** despite docs saying otherwise — corner panels, no wear/heat gauge (`HUD.ts`).
- **Zombies grind corners** when A* returns `[]` — `steer()` falls back to direct `moveToward(target)` (`AISystem.ts:135-136`). Visible "stuck against wall", distinct from spawn-in-wall (fixed PR #33).

### P2 — performance

- **No raycast caching** (`CLAUDE.md` §1 mandates it). `renderLighting()` runs full raycast every frame, including while paused and during hit-stop.
- **Decals unbounded within a sector** — cleared only on sector change (`Game.ts` advanceSector).
- **Per-frame allocations** in the 60 Hz loop: `Entity.position` getter, `NoiseSystem.propagate`, `propagateScreams` filter.

### P3 — robustness & first impression

- **No `blur` / `visibilitychange` handling** — alt-tab can leave keys logically held.
- **No loading spinner** during `assets.loadAll()` in `main.ts`.
- **No favicon / meta description / OG tags** in `index.html`.
- **No volume or sensitivity persistence** — only loadouts use `localStorage`; master gain hardcoded `0.6` in `SoundManager.ts`.
- **Asset 404s swallowed** — `AssetLoader` `onerror` resolves silently.
- **`howler` is an unused dependency** — `SoundManager` is pure Web Audio API.
- **`reticle_crosshair.png` still in AssetLoader manifest** but never drawn (procedural reticle since PR #14) — wasted fetch.
- **`generate_assets.py` footgun** — see §2 rule 6.
- **`README.md`** is still minimal.

### Phase 7

- `SessionManager.ts` is a client stub, imported by nothing. No `Protocol.ts`, no transport, no lobby UI wired up. Plan in `docs/PHASE7_ONLINE_LOBBY_PLAN.md`.

### 5.1 Resolved since the PR #14 audit

These were open in the Sept 25 audit at `b0319d8` but are **fixed on current `main`**:

| Finding (old audit) | Status now |
|---|---|
| `node_modules/` committed, Linux can't build | `.gitignore` + `npm install` works |
| No test suite / lint | 257 Vitest tests + ESLint |
| No gamepad / touch | `Gamepad.ts`, `TouchControls.ts`, menu nav |
| No `localStorage` at all | `LoadoutStorage.ts` for armory |
| No difficulty options | EASY / NORMAL / HARD |
| Identical layout every run | `sectorLayout.ts` shuffle |
| Zombie ramp backwards (5→7→6) | S3 now 8 zombies, 498 HP > S2's 466 |
| Horde spawn inside wall boxes | PR #33: `rollSurgeSpawn` + `ejectFromBoxes` |
| No stealth grade on end screen | GHOST/SHADOW/OPERATOR/LOUD |
| Zero `any` outside SessionManager | Still true (PR #14) |

**Still partially true:** persistence exists for loadouts only — no personal bests, unlocks, or volume. Stealth rating is per-run, not saved.

---

## 6. Engagement — will a player come back?

**Verdict (2026-09-25):** first run is solid; **second-run hooks are thin.** The stealth core, feel (hit-stop, shake, decals), and `audio_stalker` archetype are strengths — do not regress them while adding retention.

### Still missing (confirmed by grep / code read)

- **No personal best or run history** — end screen shows stats + stealth rating but nothing persists (`ExtractionModal.ts`; only `LoadoutStorage` touches `localStorage`).
- **All 7 weapons free from run 1** — no unlock economy in `weapons.ts`.
- **Entire game fits one 1280×720 screen** — no scrolling; camera zoom/follow is mostly dead code waiting on larger sector art. Lighting's "around the corner" fantasy is limited.
- **~21 authored zombie slots** (5 + 7 + 8) with 2 alts each — shuffle helps but route archetypes are memorizable by run 3.
- **No music / ambient bed** — `SoundType` is combat SFX only; `'scream'` never plays.
- **No tutorial** — noise mechanic is never explicitly taught.

### What works (keep)

- Noise meter + foot ring (`HUD.ts`) make stealth readable.
- Difficulty + layout shuffle + stealth rating add some variety.
- Solo down/eliminate logic is thoughtful (`Game.ts:464-467`).

### Ranked by excitement-per-hour

| # | Change | Leverage |
|---|---|---|
| 1 | **Persist best run + personal-best compare on end screen** | Cheapest "one more run" hook; stats already computed |
| 2 | **Sectors larger than viewport** | Camera code ready; unlocks exploration + lighting value |
| 3 | **Gate 4–5 weapons behind performance** | Armory becomes a reward loop |
| 4 | **Sector modifiers** (blackout, hush, heavy…) | Reuses existing systems; see §7 |
| 5 | **Ambient audio + emit missing scream SFX** | Tension between encounters |
| 6 | **~20 s onboarding beat** (loud shot → stalker) | Teaches the core mechanic |

---

## 7. What's next (recommended order)

### Stability first (protect what exists)

1. **Restart leaks** — `InputManager` window listeners + `SoundManager` `AudioContext` (P0, ~1 PR).
2. **Co-op downed hang** — bleed-out timer or fail when nobody can act (P0, ~15 lines + test).
3. **Co-op audio listener + scream SFX** (P1, small, serves headline mechanic).
4. **Zombie separation** (P1, pairs with horde cap).
5. **PR CI on `pull_request`** — typecheck/lint/test before merge (~15 lines in workflow).
6. **Playtest full runs** on NORMAL / EASY / HARD — tune from notes, not guesses.

### Retention & content (make run 2 worth it)

7. **Personal best persistence** on end screen (engagement #1).
8. **Sector modifiers** between sectors — blackout, scavenger, hush, heavy; show on briefing.
9. **Reward choice between sectors** — medkit / 2 mags / battery; `MenuGamepadNav` ready.
10. **Larger sector maps** — highest single change to what the game *is*.

### Large bet

11. **Phase 7 online co-op** — see `docs/PHASE7_ONLINE_LOBBY_PLAN.md`. Milestones: transport → lobby → shared play → polish. PeerJS, host-authoritative, no deterministic lockstep.

### Smaller ideas

- Spread model for `recoilMult`; raycast cache; decal cap; `visibilitychange` pause; drop unused `howler` + `reticle_crosshair` from manifest; sync `CLAUDE.md` noise numbers and file tree.

---

## 8. How things were tested (reuse these)

- **Unit tests** (`tests/*.test.ts`) — game logic in Node without a browser.
- **Mutation check** — break the rule, confirm a test fails.
- **Sector alignment** — `tests/sectors.test.ts` (144 cases): every spawn alt inside map, not in a box, reachable, door paths, S3 roof edge walks.
- **Surge spawn safety** — `tests/hordeSurge.test.ts`: 300× `rollSurgeSpawn` on S3 must be `isFreePosition` with path to evac pad.
- **Browser checks** (manual / Playwright): title → armory → deploy; gamepad init script; touch emulation.
- **Art alignment** — plot spots over sector background images (PIL); caught sky spawns tests couldn't.

Typecheck passing does **not** replace a browser playtest for feel, reticle legibility, or corner-grinding behaviour.

---

## 9. History

Work landed through PRs **#1–#33** on `main`: deploy pipeline, art, asset-path fix, title screen, sprites/backgrounds, wall alignment, lighting, flashlight battery, reticle/sprite sizing (PR #14), `.gitignore`, test suite, lint, loadouts, gamepad, touch, difficulty, layout shuffle, Sector 3 roof edge, bolts/radio/door cleanup, progress handoff (PR #32), horde surge spawn fix (PR #33). See `git log --merges`.

---

## 10. Handoff notes

- **Never run `generate_assets.py` wholesale** — clobbers real character art.
- **`npm install` then `npm run dev`** — `node_modules/` is git-ignored; fresh clones work on Linux/macOS.
- **Vite `server.allowedHosts`** is set in `vite.config.ts` — keep it when editing.
- **`progress.md` (this file) is canonical.** If `docs/IMPROVEMENTS.md` exists elsewhere, keep in sync or delete the duplicate.
- **Co-op down hang affects co-op only** — solo eliminate-on-0-HP is intentional and correct.
- **Horde spawn:** use `MapManager.rollSurgeSpawn`, not raw `rawSurgeSpawnPoint` — the latter can land in blockers by design (tested).
