# HUSHFIRE — Progress & Handoff

Last updated: 2026-09-25 (modifiers, rewards, playtest balance). Written as a handoff for another developer or AI assistant, e.g. Cursor. Read this first, then `CLAUDE.md`.

**Status in one line:** the full single-machine game is playable and deployed. Title → armory → 3 sectors → evac, solo or 2-player local co-op, on keyboard/mouse, gamepad or touch. Per-run sector modifiers and between-sector rewards are live. **Phase 7 gameplay sync is still not built** (online lobby code exists but each peer runs its own sim after deploy).

- Live site: https://steveruffin5076.github.io/Hushfire/
- Repo: https://github.com/steveruffin5076/Hushfire (default branch `main`)

---

## 1. Quick start

```bash
npm install        # after any pull that touched package.json
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit (covers src/ and tests/)
npm run lint       # ESLint + typescript-eslint; `any` is an error
npm test           # Vitest, 282 tests in tests/
npm run build      # tsc && vite build → dist/
```

CI (`.github/workflows/deploy-pages.yml`) runs `npm ci` → `npm run lint` → `npm test` → `npm run build` on every push to `main`, then deploys to GitHub Pages. **A failing lint or test blocks the deploy.**

---

## 2. Rules that must not be broken

1. **Asset paths.** The site is served under `/Hushfire/`. Never hardcode `'/assets/...'` in `src/`. Always use `` `${import.meta.env.BASE_URL}assets/...` `` (see `src/core/AssetLoader.ts`, `src/ui/MainMenu.ts`). This broke once already and silently dropped every sprite to placeholder art. After touching asset loading, verify with `GITHUB_ACTIONS=true npm run build` and serve `dist/` under a `/Hushfire/` subpath. See `CLAUDE.md` §4.
2. **`node_modules/` and `dist/` are git-ignored.** Never commit them.
3. **Keep lint, typecheck and tests green.** Add a test for every behaviour change. Most game logic is plain TypeScript and testable without a browser (see §6).
4. **Walls must match the art.** Each sector's `boxes` in `src/config/sectors.ts` are hand-aligned to the background image. If you move walls, spawns or pickups, the tests in `tests/sectors.test.ts` check that every possible spot is in the map, not in a wall, and reachable. Also eyeball it: plot the spots over the background image (§6).
5. **Sprites:** 128×128 PNG, transparent background, facing +X (right), rotation pivot at the canvas center. They're rotated live with `ctx.rotate(angle)`, so front-facing or 3/4-view art looks wrong. Draw size is cosmetic (`PLAYER_SPRITE_SIZE` / `ZOMBIE_SPRITE_SIZE` in `Game.ts`) and separate from the collision radius (16 px).
6. **Workflow the owner uses:** small PRs to `main`, one topic each, merged once checks pass. Update this file when something ships.

---

## 3. Code map

```text
src/
  main.ts                 Bootstrap: SessionManager → MainMenu → ArmoryMenu → Game; pause/reward/end wiring
  config/
    constants.ts          Speeds, noise radii, thresholds, flashlight battery, sector-alert constants
    difficulty.ts         EASY/NORMAL/HARD table (HP, contact dmg, notice, evac hold, wave speed)
    sectorModifiers.ts    Per-run twists: blackout, scavenger, hush, heavy
    sectors.ts            3 sector definitions: wall boxes, doors, spawns, zombies+alts, pickups+alts, objective, exit/evac
    sectorLayout.ts       Per-run shuffle: picks one spot per zombie/pickup from its alts
    weapons.ts            Weapons + muzzle/rail/ammo modifiers
    zombies.ts            Zombie archetypes (lurker, audio_stalker, bio_carrier, armored_brute)
  core/
    Game.ts               Orchestrator (~1100 lines): fixed 60 Hz update, render, pickups, objectives, sector advance, evac, end
    Input.ts              Keyboard/mouse for P1 and P2, merges gamepad + touch; poll()/endFrame()/resetEdges()
    Gamepad.ts            Pure gamepad mapping + pad assignment rules
    TouchControls.ts      On-screen twin-stick controls for P1 (drawn on canvas)
    Camera.ts             Follow/zoom/shake; worldToScreen/screenToWorld
    AssetLoader.ts        All sprite/bg/fx URLs (BASE_URL-safe)
    SoundManager.ts       Web Audio synth, spatial panning, wall muffling
  entities/               Entity, Player (ammo, battery, revive), Zombie, Projectile (bolts), Pickup
  lighting/               Raycaster (cone polygons), Flashlight, ShadowRenderer (darkness mask)
  systems/
    AISystem.ts           Zombie senses (light, close-range notice) + movement/pathing
    NoiseSystem.ts        Sound events → SUSPICIOUS/ENRAGED, wall dampening
    CombatSystem.ts       Firing, hitscan, melee/backstab, armour, bolts, sector-alert callback
    MapManager.ts         Walls, collision, pickups, doors, extraction zone, NavGrid, surge spawn validation
    NavGrid.ts            A* grid pathfinding
    Geometry.ts           Segment math, angleBetween
    HordeSurge.ts         Evac wave pacing, isSectorAlertingShot, mix, raw edge spawn points
  net/                    Protocol, roomCode, SessionManager (PeerJS lobby — gameplay sync not wired)
  ui/                     HUD, ArmoryMenu, MainMenu, PauseMenu, SectorRewardMenu, ExtractionModal,
                          LobbyPanel, LoadoutStorage, MenuGamepadNav, StealthRating, theme
tests/                    21 Vitest files (see §6)
docs/                     Design specs + PHASE7_ONLINE_LOBBY_PLAN.md
public/assets/            Processed game art (sprites, backgrounds, branding, items, fx)
images/                   Raw art uploads from the owner (source material, not loaded by the game)
```

---

## 4. What's done

### Core loop
- Title screen (key art) → armory (mode, difficulty, loadouts, run modifier) → Sector 1 Transit → Sector 2 Bio-Lab → Sector 3 Helipad → end screen.
- **Sector objectives:**
  - S1: find the keycard, override the blast door.
  - S2: hold the lockdown terminal for 3.5 s.
  - S3: hold the radio in the annex for 2.5 s, then hold the evac pad through the horde.
- **Between-sector reward (S1→S2, S2→S3):** clearing a sector's exit zone pauses the game and offers a supply drop — field medkit (+50 HP), ammo crate (+2 mags per weapon), or tactical battery (+50 charge). Gamepad-navigable.
- **Per-run sector modifiers** (`config/sectorModifiers.ts`), rolled in the armory (reroll button), shown on the armory protocol panel and in-game HUD:
  - *Blackout:* 50% battery at deploy; battery pickups stripped from every sector.
  - *Scavenger:* half the pickups each sector.
  - *Hush:* sector-alert reinforcement cooldown halved (4 s instead of 8 s).
  - *Heavy:* +1 armored brute spawns in each sector.
- Solo (P2 never spawns; going down = elimination) or 2-player local co-op (downed players can be revived by holding interact nearby).
- Every living operative must reach the exit, and downed partners must be revived first. The evac clock only runs while someone is on the pad.
- Health, ammo and battery carry over between sectors. There are no checkpoints; a run is about 6–10 min.

### Lighting & stealth
- Darkness mask `rgba(5,5,8,0.96)`. Flashlight cones are raycast against walls.
- **Flashlight battery:** 100 charge lasts 300 s of on-time and only drains while on. At empty the light forces off and can't be relit. A battery pickup gives +50. There's a HUD bar and a clickable ON/OFF button for P1.
- **Noise:** footsteps (sneak 20 / walk 90 / sprint 260 px) and gunshots emit sound. Each wall crossed multiplies the radius by 0.28. The suspicious threshold is 0.38. Enraged needs 0.8, or 0.55 for gunshots.
- **Sector-alert gunfire:** any shot louder than 150 px wakes **every** zombie in the sector, ignoring walls. After a 2 s "HORDE INCOMING" warning, 1 zombie (2 in co-op) spawns from a map edge; 8 s cooldown between reinforcement waves (4 s under *Hush*); capped at 18 zombies total.
- **Close-range notice:** a zombie that can see a player moving faster than a sneak turns ENRAGED within 40 px (dormant) or 100 px (suspicious). Sneaking or standing still stays hidden.
- Knife backstab (400 dmg) from the zombie's rear 120°. Suppressor keeps MPX/Glock stealth-ready (≤150 px).

### Difficulty & replayability
- **Difficulty** (`config/difficulty.ts`): EASY / NORMAL / HARD — zombie HP, contact DPS, notice radius, evac holdout length, fastest wave interval.
- **Layout shuffle:** every zombie and pickup has 2 alternative spots per run.
- **Evac horde waves** during Sector 3 holdout with "HORDE INCOMING" warnings.
- **End screen:** difficulty, run modifier, sector reached, time, kills, shots, silent kills, zombies alerted, stealth rating.

### Controls
- Keyboard/mouse, gamepad (menus + gameplay), touch (P1 only). Armory remembers mode, difficulty and loadouts in `localStorage`.

### Art
- P1, P2, all zombie archetypes, sector background images. Sector 3 off-roof blocker walls validated for horde spawns.

---

## 5. Known issues, quirks & doc drift

- **`CLAUDE.md` is partly out of date** — noise numbers and file tree; §3 above is current.
- **`recoilMult` is unused** — no spread model yet.
- **Zombies can still grind corners** when A* fails.
- **Online lobby exists but gameplay is not synchronized** — each browser runs its own `Game` after deploy (Phase 7 milestone 2).
- **2026-09-25:** automated playtest balance review passed (`tests/playtestBalance.test.ts`); owner previously confirmed movement, firing, and sector-alert horde behaviour on the live site.

---

## 6. How things were tested (reuse these)

- **Unit tests** (`tests/*.test.ts`) — game logic in Node without a browser.
- **Playtest balance** (`tests/playtestBalance.test.ts`) — cross-difficulty DPS, HP totals, evac pacing.
- **Sector modifiers** (`tests/sectorModifiers.test.ts`) — pickup filtering, modifier pick pool.
- **Sector rewards** (`tests/sectorReward.test.ts`) — medkit/ammo/battery math.
- **Sector alert** (`tests/sectorAlert.test.ts`) — loud gun sector frenzy.
- **Deterministic Playwright loop:** `window.render_game_to_text()` + `window.advanceTime()` in `main.ts`; `node scripts/dev-playtest.mjs http://localhost:3000/`.

---

## 7. What's next (recommended order)

1. **Human playtest a full run** on NORMAL, then EASY and HARD — tune feel from notes (automated balance tests already pass).
2. **Phase 7 milestone 2 — gameplay sync** (large): host-authoritative `Game`, guest input, snapshots, render remap. See `docs/PHASE7_ONLINE_LOBBY_PLAN.md` §11.
3. **Smaller ideas:** spread model so `recoilMult` matters; more sectors on existing art; survival mode on Sector 3; self-hosted PeerServer for production reliability.

---

## 8. History

PRs #1–#33 on `main`: full game loop, art, tests, gamepad, touch, difficulty, sector-alert horde frenzy, horde spawn safety (PR #33).

**2026-09-25 session (local):** between-sector reward picker, per-run sector modifiers (blackout/scavenger/hush/heavy), automated playtest balance suite, progress handoff update. Sector-alert horde and online lobby code from earlier in the day are in the tree but gameplay sync is explicitly deferred.
