# HUSHFIRE — Progress & Handoff

Last updated: 2026-09-25, against branch implementing stability + personal-best work (post PR #33). Written as a handoff for another developer or AI assistant, e.g. Cursor. Read this first, then `CLAUDE.md`.

**Status in one line:** the full single-machine game is playable and deployed. Title → armory → 3 sectors → evac, solo or 2-player local co-op, on keyboard/mouse, gamepad or touch. **Online co-op (Phase 7) is the main thing not built yet.**

- Live site: https://steveruffin5076.github.io/Hushfire/
- Repo: https://github.com/steveruffin5076/Hushfire (default branch `main`)

---

## 1. Quick start

```bash
npm install        # after any pull that touched package.json
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit (covers src/ and tests/)
npm run lint       # ESLint + typescript-eslint; `any` is an error
npm test           # Vitest, 265 tests in tests/
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
    CombatSystem.ts       Firing, hitscan, melee/backstab, armour, bolts (collectStuckBolts)
    MapManager.ts         Walls, collision, pickups, doors, extraction zone, NavGrid, surge spawn validation
    NavGrid.ts            A* grid pathfinding
    Geometry.ts           Segment math, angleBetween
    HordeSurge.ts         Evac wave pacing, mix, raw edge spawn points (validated by MapManager)
  ui/                     HUD, ArmoryMenu, MainMenu, PauseMenu, ExtractionModal (end screen), QuitScreen,
                          LoadoutStorage (localStorage), MenuGamepadNav, StealthRating, theme
  net/SessionManager.ts   Phase 7 stub only — not wired to anything
tests/                    16 Vitest files, one per system (see §6)
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
- Solo (P2 never spawns; going down = elimination) or 2-player local co-op (downed players can be revived by holding interact nearby).
- Every living operative must reach the exit, and downed partners must be revived first. The evac clock only runs while someone is on the pad.
- Health, ammo and battery carry over between sectors. There are no checkpoints; a run is about 6–10 min.

### Lighting & stealth
- Darkness mask `rgba(5,5,8,0.96)`. Flashlight cones are raycast against walls.
- **Flashlight battery:** 100 charge lasts 300 s of on-time and only drains while on. At empty the light forces off and can't be relit. A battery pickup gives +50. There's a HUD bar and a clickable ON/OFF button for P1.
- **Noise:** footsteps (sneak 20 / walk 90 / sprint 260 px) and gunshots emit sound. Each wall crossed multiplies the radius by 0.28. The suspicious threshold is 0.38. Enraged needs 0.8, or 0.55 for gunshots.
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
- **Warnings:** "HORDE INCOMING" banner 2 s before each wave.
- **End screen:** difficulty, sector reached, time, kills, shots, silent kills, zombies alerted, stealth rating (GHOST 0 / SHADOW ≤3 / OPERATOR ≤8 / LOUD). **Personal bests** per difficulty persist in `localStorage` (`RunRecords.ts`): longest survival, most kills, fewest alerts on a win.

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
- **Crossbow warm-up:** the crossbow can't fire in the first 1.33 s after page load, because `lastShotTime` starts at 0 against `performance.now()`. Harmless.
- **Split HUD button:** the HUD flashlight button only takes clicks for P1, since local co-op shares one mouse.
- **Touch is P1 only:** two players on one phone isn't supported.
- **`recoilMult` is unused:** it's defined on muzzles, but nothing reads it (there's no spread model). The muzzle brake, compensator and flash hider are weak as a result.
- **Not playtested for feel:** the balance numbers (notice radii, suppressor 0.35, wave pacing, EASY/HARD) are reasoned from the code and unit-tested, but haven't been played by a human. The owner should playtest before more tuning.
- **Zombies can still grind corners:** when A* returns no path, `AISystem` falls back to walking straight at the target. That's visible "stuck against a wall" behaviour, not trapped inside geometry — a separate issue from the horde spawn fix in PR #33.

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

---

## 7. What's next (recommended order)

1. **Playtest a full run** on NORMAL, then EASY and HARD. Tune the numbers from real notes, not guesses.
2. **Larger sector maps** — camera zoom/follow code is ready; content is not.
3. **Sector modifiers** (medium): a random twist per run that reuses existing systems. Examples:
   - *Blackout:* 50% battery, no battery pickups.
   - *Scavenger:* half the pickups.
   - *Hush:* any unsuppressed shot calls a horde wave.
   - *Heavy:* +1 brute.
   Show the active modifier on the briefing.
4. **Reward choice between sectors** (medium): pick a medkit, 2 mags or a battery. It needs a small DOM menu with gamepad navigation, which `MenuGamepadNav` already handles.
5. **Phase 7 — online co-op** (large, several PRs). Recommended approach, which updates `docs/PHASE7_ONLINE_LOBBY_PLAN.md`:
   - **Transport:** PeerJS (WebRTC). The room code is the host's peer ID, and the link is `…/Hushfire/#HUSH-XXXX`. No server of our own, so it works on GitHub Pages.
   - **Model:** host-authoritative. Only the host runs `Game`. The guest sends `PlayerInputState` at 60 Hz, and the host broadcasts snapshots at about 30 Hz: player, zombie, bolt and pickup state, objective/evac state, and a list of sound/FX events so the guest can play audio. The guest renders snapshots with interpolation.
     - Don't do deterministic lockstep. `Math.random` is used by the layout shuffle and waves, and `Math.sin`/`atan2` can differ between browsers.
   - **Reordered milestones:** the plan's lobby-only milestone ends in two separate games, so get to shared play first.
     1. Transport, console-tested.
     2. Lobby: CREATE/JOIN link. Each player picks their own loadout; the host picks difficulty and deploys.
     3. Playable: guest input drives P2, the host sends snapshots, and a "view-only" `Game` mode renders them.
     4. Polish: guest-side prediction of its own movement, disconnect/reconnect, connect timeout and error messages.
   - **Known limit:** without a TURN relay, some network pairs (strict NAT) can't connect. Ship STUN-only with a clear error first. A paid TURN service is the owner's decision.
   - **Already done** from the old plan's prerequisites: the `.gitignore`, gamepad support, and removing `any` from `SessionManager`.
6. **Smaller ideas:** a spread model so `recoilMult` matters; raycast cache; more sectors on existing art; a survival mode on the Sector 3 map.

---

## 8. History

All work landed through PRs #1–#33 on `main` (stability/personal-best batch pending merge): deploy pipeline, art pipeline, asset-path fix, title screen, sprite and background replacements, wall alignment, lighting, flashlight battery, `.gitignore`, test suite, lint, loadout saving, gamepad, touch, gamepad menus, design-review bug fixes and tuning, layout shuffle, difficulty levels, Sector 3 roof edge, bolts/radio/door cleanup, progress handoff rewrite (PR #32), horde surge spawn-in-wall fix (PR #33). See `git log --merges` for details.
