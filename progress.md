# HUSHFIRE — Progress & Handoff

Last updated: 2026-09-28 (stability + personal bests ported onto online `main`; §9 task list includes walk-cycle animation tasks). Written as a handoff for another developer or AI assistant, e.g. Cursor. Read this first, then `CLAUDE.md`.

**Status in one line:** the full game is playable and deployed. Title → armory → 3 sectors → evac, **solo** (one operative) or **online co-op** (two operatives over PeerJS), on keyboard/mouse, gamepad or touch. **Phase 7 M1–M2 (lobby + host-authoritative gameplay sync) are wired.** Same-machine 2-player couch co-op was removed from the armory (legacy `coop` saves migrate to solo).

- Live site: https://steveruffin5076.github.io/Hushfire/
- Repo: https://github.com/steveruffin5076/Hushfire (default branch `main`)

---

## 1. Quick start

```bash
npm install        # after any pull that touched package.json
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit (covers src/ and tests/)
npm run lint       # ESLint + typescript-eslint; `any` is an error
npm test           # Vitest (see §6; count grows with each PR)
npm run build      # tsc && vite build → dist/
```

CI (`.github/workflows/deploy-pages.yml`) runs `npm ci` → `npm run lint` → `npm test` → `npm run build` on push to `main` and on `pull_request`. Deploy to GitHub Pages runs only on push to `main`. **A failing lint or test blocks the deploy.**

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
    Protocol.ts           Re-exports NetMessage + PROTO_VERSION from GameSnapshot
    GameSnapshot.ts       input/snapshot wire types, inputToNet/netToInput
    roomCode.ts           generateRoomCode, peerIdForRoom, hash parsing
    SessionManager.ts     PeerJS transport: lobby + gameplay input/snapshot relay
  ui/                     HUD, ArmoryMenu (+ online lobby), MainMenu (+ create/join), PauseMenu,
                          SectorRewardMenu, ExtractionModal, LobbyPanel, QuitScreen,
                          LoadoutStorage (localStorage), MenuGamepadNav, StealthRating, theme
tests/                    24 Vitest files (see §6)
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
- **Solo** (P2 never spawns; going down = elimination) or **online co-op** (two operatives over the network; downed partners can be revived by holding interact nearby). Same-keyboard local 2P is no longer offered in the armory.
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
- **End screen:** difficulty, sector reached, time, kills, shots, silent kills, zombies alerted, stealth rating (GHOST 0 / SHADOW ≤3 / OPERATOR ≤8 / LOUD). **Personal bests** per difficulty persist in `localStorage` (`RunRecords.ts`): longest survival, most kills, fewest alerts on a win.

### Sector modifiers (per-run twist)
- Rolled in the armory with **REROLL MODIFIER**; shown on the protocol panel, HUD, and end screen.
- **Blackout:** 50% battery at deploy; battery pickups stripped.
- **Scavenger:** half the sector pickups.
- **Hush:** sector-alert reinforcement cooldown halved (4 s vs 8 s).
- **Heavy:** +1 armored brute per sector.
- Tests: `tests/sectorModifiers.test.ts`.

### Online co-op — Phase 7 (lobby + gameplay sync)
- **Title screen:** START GAME (solo armory), CREATE CO-OP SESSION, JOIN SESSION (code input).
- **Invite link:** `#HUSH-XXXXX` hash in the URL; guest auto-enters the armory lobby.
- **PeerJS transport** (`peerjs@1.5.5`): room code maps to peer id `hushfire-HUSH-XXXXX`. STUN via Google + Metered STUN fallback. Optional TURN via `VITE_TURN_CREDENTIALS_URL` (see `.env.example`, `src/net/iceConfig.ts`). Outbound queue while the DataChannel opens.
- **Armory online mode:** full-width equal-column layout, viewport scale-to-fit (no page/panel scroll), ← BACK TO MAIN MENU, room code + copy-link, connection status, ready pills, **RETRY CONNECTION** on error, debounced loadout broadcast (120 ms), host-gated deploy with shared seed. Fixed operative slots: host = Op 1, guest = Op 2 (locked).
- **Connection fixes:** host no longer times out while waiting for a guest (guest-only 20 s timeout); `retryConnection()` reopens the same room for hosts.
- **Gameplay sync (M2):** host runs the authoritative `Game`; guest sends input at 60 Hz and renders ~30 Hz snapshots. Slot remap: guest's local P1 = host's P2. Shared layout seed via `mulberry32(seed)` on deploy. Wire format: `src/net/GameSnapshot.ts`.
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

- **Split HUD button:** the HUD flashlight button only takes clicks for P1, since co-op shares one mouse on the host machine.
- **Touch is P1 only:** two players on one phone isn't supported.
- **No same-machine 2P armory mode:** legacy `coop` / LOCAL was removed; only SOLO and ONLINE in the armory. Re-add only if couch co-op is wanted again.
- **Online co-op limits:**
  - **TURN not configured on GitHub Pages** — strict NAT / school Wi‑Fi / VPN often blocks STUN-only P2P. Sign up at [Metered Open Relay](https://www.metered.ca/tools/openrelay/), set `VITE_TURN_CREDENTIALS_URL` in CI secrets, rebuild.
  - Free `0.peerjs.com` PeerServer has no SLA — consider self-hosted `peerjs-server` for production.
  - Guest has no client-side prediction or snapshot interpolation (may feel laggy on high-latency links).
  - **Sector reward picker is host-only** — only the host sees `SectorRewardMenu` between sectors; choice is not synced to guest over the wire yet.
  - **Two-browser playtest still needed** on localhost and GitHub Pages after connection/layout fixes.
- **2026-09-25 playtest pass:** automated balance review (`tests/playtestBalance.test.ts`) confirms EASY/HARD contact DPS, evac pacing and sector HP scale as intended. Owner previously confirmed movement/firing on the live site and sector-alert horde behaviour.

### Recently fixed (2026-09-25)

- **Restart leaks:** `InputManager.dispose()` removes all window listeners; `getSharedSoundManager()` shares one `AudioContext` across games.
- **Co-op downed hang:** `BLEEDOUT_SEC` (25 s) escalates downed → eliminated (`tests/bleedout.test.ts`).
- **Co-op audio:** `Game.audioListener()` midpoint for spatial SFX.
- **Scream SFX:** `playZombieScream` on horde cascade (`tests/noise.test.ts`).
- **Zombie separation:** soft push in `AISystem` (`tests/aiSeparation.test.ts`).
- **Personal bests:** `RunRecords.ts` + end-screen banner (`tests/runRecords.test.ts`).
- **PR CI:** `pull_request` trigger on deploy workflow; deploy only on push to `main`.

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
- **Network input codec** (`tests/snapshotCodec.test.ts`): `inputToNet` / `netToInput` round-trip.
- **ICE config** (`tests/iceConfig.test.ts`): STUN fallback + optional TURN URL merge.
- **Crossbow warm-up** (`tests/crossbowWarmup.test.ts`): first-shot readiness after deploy.
- **AI pathing** (`tests/aiPathing.test.ts`): no straight-line grind when A* returns no route.
- **Deterministic Playwright loop:** `Game.renderGameToText()` + `Game.advanceTime()` wired in `main.ts`. Example: `node scripts/dev-playtest.mjs http://localhost:3000/`.

---

## 7. What's next (recommended order)

1. **Configure TURN for production** — free Metered Open Relay + `VITE_TURN_CREDENTIALS_URL` in GitHub Actions; retest guest connect on a non-LAN network.
2. **Two-browser online playtest** — host create → guest join → both READY → deploy → full 3-sector run on localhost and GitHub Pages.
3. **Online gameplay polish:** guest snapshot interpolation; sync sector-reward choice (or show read-only reward on guest); optional client-side prediction for guest movement.
4. **Human balance playtest** — full NORMAL run, then EASY/HARD feel pass (automated tests already pass).
5. **Smaller ideas:** re-add same-machine 2P if desired; more sectors; survival mode on Sector 3; self-hosted PeerServer.

---

## 9. Cursor task list (2026-09-25)

| # | Task | Status |
|---|------|--------|
| 1 | Crossbow warm-up | ✅ `Player.lastShotTime = -Infinity`, `tests/crossbowWarmup.test.ts` |
| 2 | Zombie corner-grinding | ✅ `AISystem.steer` holds when pathless, `tests/aiPathing.test.ts` |
| 3 | Stale docs | ✅ `CLAUDE.md`, `PHASE7_ONLINE_LOBBY_PLAN.md` updated |
| 4 | Phase 7 M2 gameplay sync | ✅ `GameSnapshot.ts`, host/guest paths in `Game.ts`, `SessionManager` relay |
| 5 | Sector modifiers | ✅ `config/sectorModifiers.ts` (pre-existing), tests pass |
| 6 | Recoil/spread model | ✅ `CombatSystem` reads `recoilMult`, `tests/weaponBalance.test.ts` |
| 7 | Armory empty loadout panel | ✅ init order fix (`setMode` after buttons exist) |
| 8 | Remove LOCAL armory mode | ✅ `GameMode = 'solo' \| 'online'` only |
| 9 | Back to main menu (armory) | ✅ `onBack` + `session.destroy()` |
| 10 | Ready pills stuck | ✅ unified `onStateChange` + `LobbyPanel.refresh()` |
| 11 | Fixed online operative slots | ✅ host Op 1 / guest Op 2, locked |
| 12 | Connection timeout bug | ✅ host no longer times out while waiting; guest 20 s + retry |
| 13 | Armory full-width layout | ✅ equal 50/50 columns, viewport scale-to-fit, no scroll |
| 14 | ICE / optional TURN | ✅ `iceConfig.ts`, `.env.example`, `tests/iceConfig.test.ts` |
| 15 | TURN on GitHub Pages | ⏸ needs owner API key in CI secrets |
| 16 | Self-hosted PeerServer | ⏸ TBD — owner must pick hosting |
| 17 | Online two-browser playtest | ⏸ owner task |
| 18 | Guest sector-reward sync | ⏸ not started |
| 19 | Guest snapshot interpolation | ⏸ not started |
| 20 | Walk-cycle art frames in `generate_assets.py` | ⏸ not started — extend the script with pose-parameterized SVG functions (e.g. 4-frame cycle: legs together / left-forward / legs together / right-forward) per player + zombie archetype, output as `<entity>_walk0..3.png` or one sprite sheet. Cursor can write the new pose functions; **running the script to regenerate `public/assets/sprites/*.png` is the owner's call**, per the "never run `generate_assets.py`" hard constraint. |
| 21 | Frame-swap animation in renderer | ⏸ not started — once walk frames exist, update `AssetLoader.ts` to load the frame set per entity and the render code in `Game.ts` (currently draws one static sprite rotated with `ctx.rotate`) to pick a frame by distance traveled / elapsed time instead of a fixed image. Pure code, no art dependency once task 20 ships frames. |
| 22 | Restart leaks + bleed-out + personal bests + PR CI | ✅ ported from `cursor/recommended-next-steps-e159` onto current `main` |

---

## 8. History

All work landed through PRs #1–#33 on `main`: deploy pipeline, art pipeline, asset-path fix, title screen, sprite and background replacements, wall alignment, lighting, flashlight battery, `.gitignore`, test suite, lint, loadout saving, gamepad, touch, gamepad menus, design-review bug fixes and tuning, layout shuffle, difficulty levels, Sector 3 roof edge, bolts/radio/door cleanup, progress handoff rewrite (PR #32), horde surge spawn-in-wall fix (PR #33). See `git log --merges` for details.

**2026-09-25 sessions:**
- Sector-alert horde frenzy — loud gunfire (>150 px) wakes every zombie and calls edge reinforcements. Owner playtested and confirmed.
- Automated playtest balance review (`tests/playtestBalance.test.ts`).
- Between-sector reward picker (`SectorRewardMenu.ts`, `Game.onSectorReward`).
- Phase 7 lobby + M2 gameplay sync: `Protocol.ts`, `roomCode.ts`, `GameSnapshot.ts`, PeerJS `SessionManager`, `LobbyPanel`, armory online mode, title create/join (`peerjs@1.5.5`).
- Sector modifiers, crossbow warm-up, AI pathing, recoil spread, ESLint CI fixes.
- Armory polish: remove LOCAL mode, back button, ready-state fix, fixed Op slots, full-width equal columns, viewport scale-to-fit, connection timeout/retry, `iceConfig.ts` + `.env.example`.

**2026-09-28:** Restart leak fixes (`InputManager.dispose`, shared `SoundManager`), online downed bleed-out (`BLEEDOUT_SEC`), spatial audio listener midpoint, scream SFX + zombie separation, `RunRecords` personal bests, `pull_request` CI — merged onto the online `main` tree.
