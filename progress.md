# HUSHFIRE — Progress & Handoff

Last updated: 2026-09-25 (playtest pass, sector rewards, Phase 7 lobby). Written as a handoff for another developer or AI assistant, e.g. Cursor. Read this first, then `CLAUDE.md`.

**Status in one line:** the full single-machine game is playable and deployed. Title → armory → 3 sectors → evac, solo or 2-player local co-op, on keyboard/mouse, gamepad or touch. **Online lobby (Phase 7 milestone 1) is wired; gameplay sync is still local-only per browser.**

- Live site: https://steveruffin5076.github.io/Hushfire/
- Repo: https://github.com/steveruffin5076/Hushfire (default branch `main`)

---

## 1. Quick start

```bash
npm install        # after any pull that touched package.json
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit (covers src/ and tests/)
npm run lint       # ESLint + typescript-eslint; `any` is an error
npm test           # Vitest, 276 tests in tests/
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
  net/
    Protocol.ts           Typed NetMessage union + PROTO_VERSION
    roomCode.ts           generateRoomCode, peerIdForRoom, hash parsing
    SessionManager.ts     PeerJS transport: host/guest, loadout sync, host-gated deploy
  ui/                     HUD, ArmoryMenu (+ online lobby), MainMenu (+ create/join), PauseMenu,
                          SectorRewardMenu, ExtractionModal, LobbyPanel, QuitScreen,
                          LoadoutStorage (localStorage), MenuGamepadNav, StealthRating, theme
tests/                    20 Vitest files (see §6)
docs/                     Design specs + PHASE7_ONLINE_LOBBY_PLAN.md
public/assets/            Processed game art (sprites, backgrounds, branding, items, fx)
images/                   Raw art uploads from the owner (source material, not loaded by the game)
```

---

## 4. What's done

### Core loop
- Title screen (key art) → armory (mode, difficulty, loadouts) → Sector 1 Transit → Sector 2 Bio-Lab → Sector 3 Helipad → end screen.
- **Sector objectives:**
  - S1: find the keycard, override the blast door.
  - S2: hold the lockdown terminal for 3.5 s.
  - S3: hold the radio in the annex for 2.5 s, then hold the evac pad through the horde.
- **Between-sector reward (S1→S2, S2→S3):** clearing a sector's exit zone pauses the game and shows a supply-drop picker — field medkit (+50 HP each operative), ammo crate (+2 mags per weapon), or tactical battery (+50 charge). Gamepad-navigable via `MenuGamepadNav`.
- Solo (P2 never spawns; going down = elimination) or 2-player local co-op (downed players can be revived by holding interact nearby).
- Every living operative must reach the exit, and downed partners must be revived first. The evac clock only runs while someone is on the pad.
- Health, ammo and battery carry over between sectors. There are no checkpoints; a run is about 6–10 min.

### Lighting & stealth
- Darkness mask `rgba(5,5,8,0.96)`. Flashlight cones are raycast against walls.
- **Flashlight battery:** 100 charge lasts 300 s of on-time and only drains while on. At empty the light forces off and can't be relit. A battery pickup gives +50. There's a HUD bar and a clickable ON/OFF button for P1.
- **Noise:** footsteps (sneak 20 / walk 90 / sprint 260 px) and gunshots emit sound. Each wall crossed multiplies the radius by 0.28. The suspicious threshold is 0.38. Enraged needs 0.8, or 0.55 for gunshots.
- **Sector-alert gunfire:** any shot louder than 150 px wakes **every** zombie in the sector, ignoring walls. After a 2 s "HORDE INCOMING" warning, 1 zombie (2 in co-op) spawns from a map edge; 8 s cooldown between reinforcement waves; capped at 18 zombies total. Silent weapons (knife, crossbow) never trigger this. Suppressed MPX/Glock stay under the threshold; suppressed M4/shotgun/revolver still alert the sector.
- **Close-range notice:** a zombie that can see a player moving faster than a sneak turns ENRAGED within 40 px (dormant) or 100 px (suspicious). Sneaking or standing still stays hidden.
- The flood light and spotlight alert zombies they shine on. The UV light and laser don't.
- Knife backstab (400 dmg) from the zombie's rear 120°. The knife never uses ammo.
- Brute front armour ×0.25 unless armour-piercing.
- **Bio-carrier:** a pulsing green ring. On death its 400 px blast enrages everything in range, shown by a shockwave ring.
- **Suppressor:** sound ×0.35. The MPX and Glock stay "stealth ready" (≤150 px); the M4, shotgun and revolver don't.

### Combat & items
- **Weapons:** MPX, M4A1, shotgun, crossbow (primary); Glock 17, revolver, knife (secondary).
- **Attachments:** muzzle, rail/light and ammo type are chosen per weapon.
- **Ammo crate:** +2 mags per gun, capped at the starting reserve. It stays on the floor if both guns are full.
- **Crossbow bolts:** walking over a stuck bolt returns it to reserve.
- **Pickups:** ammo, medkit (+50 HP), battery (+50), keycard.

### Difficulty & replayability
- **Difficulty** (`config/difficulty.ts`), chosen in the armory:

  | | Zombie HP | Contact dmg | Notice radius | Evac hold | Fastest wave |
  |---|---|---|---|---|---|
  | EASY | ×0.8 | 11/s | ×0.75 | 90 s | 6 s |
  | NORMAL | ×1 | 15/s | ×1 | 120 s | 4 s |
  | HARD | ×1.25 | 22/s | ×1.4 | 150 s | 3 s |

- **Layout shuffle:** every zombie and pickup has 2 alternative spots (`alts`), and one is picked per run. Types and counts never change, so sector HP stays 358 → 466 → 498.
- **Evac horde waves:** every 10 s down to the difficulty minimum. Co-op waves are 2 zombies. Mix: lurker 40 / stalker 25 / bio 25 / brute 10%. Capped at 18 zombies. Spawns are validated so they never land inside Sector 3's off-roof blocker boxes (`MapManager.rollSurgeSpawn`).
- **Warnings:** "HORDE INCOMING" banner 2 s before each evac wave and before sector-alert reinforcement waves.
- **End screen:** difficulty, sector reached, time, kills, shots, silent kills, zombies alerted, stealth rating (GHOST 0 / SHADOW ≤3 / OPERATOR ≤8 / LOUD).

### Online co-op — Phase 7 milestone 1 (lobby only)
- **Title screen:** START GAME (local), CREATE CO-OP SESSION, JOIN SESSION (code input).
- **Invite link:** `#HUSH-XXXXX` hash in the URL; guest auto-enters the armory lobby.
- **PeerJS transport** (`peerjs@1.5.5`): room code maps to peer id `hushfire-HUSH-XXXXX`. STUN via Google. Outbound queue while the DataChannel opens.
- **Armory online mode:** room code + copy-link, connection status, ready pills, debounced loadout broadcast (120 ms), host-gated deploy with shared seed.
- **Each peer deploys locally** with their own loadout in the P1 slot and the partner's in P2 — same as the Phase 7 plan's lobby-only milestone. Zombies, damage and extraction are **not** shared yet (§11 gameplay sync is next).
- **Dependency:** `peerjs` in `package.json`.

### Controls
- **Keyboard/mouse** (P1 WASD + mouse, P2 arrows + IJKL). The full table is in `docs/COOP_SESSION_GUIDE.md` §5.
- **Gamepad** (standard layout):
  - Solo → the first pad is P1. Co-op with one pad → P2. Two pads → one each.
  - The menus are pad-navigable too: a cyan highlight moves between buttons, A presses, and B resumes from pause.
- **Touch:**
  - On-screen twin-stick controls for P1 appear after the first touch.
  - Pushing the aim stick past its ring fires.
  - Buttons: SPRINT/SNEAK toggles, RELOAD, USE, SWAP, LIGHT, pause.
  - Upright phones get a "rotate to landscape" prompt.
- The armory remembers mode, difficulty and both loadouts in `localStorage`. Saves from older builds are checked field by field.

### Art
- P1, P2 and all zombie archetypes, including the lurker aggro variant, use the owner's uploaded top-down art.
- Each sector has a background image.
- **Sector 3:** off-roof blocker walls stop anyone walking over the sky. Horde surge spawns use the same box set — raw map-edge rolls can land inside a blocker, so `rollSurgeSpawn` rejects them and `resolveCircleCollision` ejects any circle trapped in a box interior.
- **Sector 2:** no door, because nothing in the art anchors one.

---

## 5. Known issues, quirks & doc drift

- **`CLAUDE.md` is partly out of date.**
  - §2 still quotes the original noise numbers (dampening 0.65, threshold 0.3). The live values are in `src/config/constants.ts` (0.72, 0.38, gunshot enrage 0.55).
  - Its file-structure tree lists only the original files; §3 above is the current map.
  - Phase 7 is partially built — lobby works, gameplay sync does not.
- **`docs/PHASE7_ONLINE_LOBBY_PLAN.md` header still says "PLAN ONLY"** — the lobby portion is implemented; update that doc when convenient.
- **Crossbow warm-up:** the crossbow can't fire in the first 1.33 s after page load, because `lastShotTime` starts at 0 against `performance.now()`. Harmless.
- **Split HUD button:** the HUD flashlight button only takes clicks for P1, since local co-op shares one mouse.
- **Touch is P1 only:** two players on one phone isn't supported.
- **`recoilMult` is unused:** it's defined on muzzles, but nothing reads it (there's no spread model). The muzzle brake, compensator and flash hider are weak as a result.
- **Online co-op limits:** no TURN relay (strict NAT pairs may fail to connect); free `0.peerjs.com` PeerServer has no SLA; gameplay is not synchronized — each browser runs its own sim after deploy.
- **2026-09-25 playtest pass:** automated balance review (`tests/playtestBalance.test.ts`) confirms EASY/HARD contact DPS, evac pacing and sector HP scale as intended. Owner previously confirmed movement/firing on the live site and sector-alert horde behaviour.
- **Zombies can still grind corners:** when A* returns no path, `AISystem` falls back to walking straight at the target. That's visible "stuck against a wall" behaviour, not trapped inside geometry — a separate issue from the horde spawn fix in PR #33.

---

## 6. How things were tested (reuse these)

- **Unit tests** (`tests/*.test.ts`). Game logic runs in Node. Examples:
  - `new MapManager()`, `new AISystem()`, `new CombatSystem(map, noise)`
  - `new Player(...)`, `new Zombie(...)`
  - `InputManager` with stubbed `window` and `navigator.getGamepads` (see `tests/gamepad.test.ts`, `tests/touch.test.ts`)
- **Mutation check:** for important rules, temporarily break the code and confirm a test fails before trusting it.
- **Browser checks:** Playwright drives `npm run dev`.
  - Title → armory → deploy.
  - Simulated gamepads via an init script that overrides `navigator.getGamepads`.
  - Phone emulation (`hasTouch`, 844×390) with CDP `Input.dispatchTouchEvent` for multi-touch.
- **Art alignment:** plot every spot (spawns, zombie/pickup alts, boxes) over the sector's background image with PIL and look at it. This caught spots in the sky that the tests couldn't.
- **Surge spawn safety** (`tests/hordeSurge.test.ts`): Monte-Carlo `rollSurgeSpawn` on Sector 3 — every point must be `isFreePosition` and have a nav path to the evac pad. `tests/collision.test.ts` also checks `ejectFromBoxes` for a point deep inside a blocker.
- **Sector alert** (`tests/sectorAlert.test.ts`): `isSectorAlertingShot` threshold, `CombatSystem` callback, sector-wide ENRAGE.
- **Sector rewards** (`tests/sectorReward.test.ts`): medkit/ammo/battery math mirrors pickup behaviour.
- **Playtest balance** (`tests/playtestBalance.test.ts`): cross-difficulty DPS, HP totals, evac pacing, sector-horde cooldown sanity.
- **Online room codes** (`tests/roomCode.test.ts`): `generateRoomCode`, `peerIdForRoom`, hash detection.
- **Deterministic Playwright loop:** `Game.renderGameToText()` + `Game.advanceTime()` wired in `main.ts`. Example: `node scripts/dev-playtest.mjs http://localhost:3000/`.

---

## 7. What's next (recommended order)

1. **Human playtest a full run** on NORMAL, then EASY and HARD — tune feel from notes (automated balance tests passed; human feel pass still valuable).
2. **Phase 7 milestone 2 — gameplay sync** (large): host-authoritative `Game`, guest input at 60 Hz, snapshots at ~30 Hz, render remap so the guest's mouse drives their operative. See `docs/PHASE7_ONLINE_LOBBY_PLAN.md` §11.
3. **Sector modifiers** (medium): a random twist per run that reuses existing systems. Examples:
   - *Blackout:* 50% battery, no battery pickups.
   - *Scavenger:* half the pickups.
   - *Hush:* extra reinforcement pressure on top of the base sector-alert system (e.g. halve the 8 s cooldown or double wave size).
   - *Heavy:* +1 brute.
   Show the active modifier on the briefing.
4. **Smaller ideas:** a spread model so `recoilMult` matters; more sectors on existing art; a survival mode on the Sector 3 map; self-hosted PeerServer for production reliability.

---

## 8. History

All work landed through PRs #1–#33 on `main`: deploy pipeline, art pipeline, asset-path fix, title screen, sprite and background replacements, wall alignment, lighting, flashlight battery, `.gitignore`, test suite, lint, loadout saving, gamepad, touch, gamepad menus, design-review bug fixes and tuning, layout shuffle, difficulty levels, Sector 3 roof edge, bolts/radio/door cleanup, progress handoff rewrite (PR #32), horde surge spawn-in-wall fix (PR #33). See `git log --merges` for details.

**2026-09-25 session (local, not yet merged):**
- Sector-alert horde frenzy — loud gunfire (>150 px) wakes every zombie and calls edge reinforcements. Owner playtested and confirmed.
- Automated playtest balance review (`tests/playtestBalance.test.ts`).
- Between-sector reward picker (`SectorRewardMenu.ts`, `Game.onSectorReward`).
- Phase 7 lobby: `Protocol.ts`, `roomCode.ts`, PeerJS `SessionManager`, `LobbyPanel`, armory online mode, title create/join buttons (`peerjs@1.5.5`).
