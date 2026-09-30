# AGENTS.md — Cloud / coding agent instructions

## Co-op model (do not revert)

**There is no local / same-machine co-op.** Do not implement or restore:

- A second keyboard layout for Operative 2 (arrows, IJKL, numpad, `'` / `\` for P2, etc.)
- `getPlayer2Input` or any path that reads local keys for host-side P2
- Couch / split gamepad assignment where pad 2 drives P2 on one PC
- Armory or gameplay modes for “two players on one keyboard”

**Supported modes:**

| Mode | Operative 2 |
|------|-------------|
| **Solo** | Eliminated at mission start — one human, one keyboard/mouse/touch/gamepad |
| **Online co-op** | Guest on **another device**; host applies `guestRemoteInput` only (`Game.ts` update loop) |

Each client uses **P1 controls only** (`getPlayer1Input`). On the guest client, snapshots remap so local P1 = host P2.

When adding features (NVG, melee, HUD key hints), assume **one local player per machine**. P2 HUD on the host is **partner status**, not local keybinds.

## Art pipeline

`art/` is **authoring only** — it is not copied into `dist/` and does not ship on GitHub Pages. Runtime sprites load from `public/assets/animations/` via `AnimationCatalog` (`src/graphics/animation/`). JSON shapes are defined in `sheetTypes.ts` (topdown_animation_pack / baked sheets).

### Folder layout

| Path | Purpose |
|------|---------|
| `art/models/` | Imported meshes: `.glb` / `.fbx` from Meshy, Tripo, Hunyuan, plus Mixamo-rigged characters |
| `art/blend/` | Blender sources: `hushfire_sprite_scene.blend` (shared lighting/camera rig) and **one `.blend` per character** |
| `art/scripts/` | `render_sprites.py` — headless Blender render into `art/renders/` |
| `art/renders/` | Raw PNG frame output (**gitignored**) |

### Target sheet format (what the game expects)

Shipped assets live at `public/assets/animations/<character_id>/` as paired **WebP + JSON** (`image` field points at the WebP). Character IDs: `player_infiltrator`, `player_breacher`, `zombie_lurker`, `zombie_lurker_aggro`, `zombie_audio_stalker`, `zombie_bio_carrier`, `zombie_armored_brute` (see `AnimationCatalog.ts`).

**Standard walk / simple clip row** (`WalkSheetMeta`, `SimpleClipSheetMeta`):

- **Cell size:** `556 × 304` px (operative pistol/rifle/knife loadouts, most zombies’ `walk_sheet`)
- **Layout:** single horizontal row (`layout: "row"`)
- **Walk:** typically `8` frames; optional `footfall_frames`, `stride_steps`, `steps_per_s`, `pivots_cell_px.torso` (reference torso pivot ≈ `[137.3, 139.2]` in cell space)
- **Simple clips** (`idle_sheet`, `recoil_sheet`, `hit_sheet`, loadout `attack_sheet`): `clips[]` with `name`, `frames`, `frame_ms`, `loop`, optional `events`

**Multi-row clips** (`MultiClipSheetMeta`, e.g. `downed_sheet`, some `attack_sheet`):

- **Layout:** `rows` with `clips[].row`
- **Cell size:** per-character `cell_width` × `cell_height` (not always 556×304 — copy an existing JSON for that archetype or rebake consistently)

**Operative 1 loadouts:** shared `player_infiltrator/downed_sheet` + `hit_sheet`; per-weapon folders `loadouts/{knife,pistol,rifle}/` with `walk_sheet`, `idle_sheet`, and weapon-specific `recoil_sheet` or `attack_sheet`.

**Exception:** `zombie_armored_brute` walk cells use `275 × 556` (rotated bake); match existing JSON before replacing.

**Draw vs bake:** On-screen draw size is set in `Game.ts` (`PLAYER_SPRITE_SIZE`, `ZOMBIE_SPRITE_SIZE`); sheet `frame_width` is the scale reference in `drawSheetFrame` / `CharacterAnimController`. Changing bake geometry requires updating sidecar JSON pivots and verifying in-game footfalls / attack events.

### Blender → ship workflow

1. Import rigged mesh into `art/models/`, link into `art/blend/<character_id>.blend` (or the shared `hushfire_sprite_scene.blend`).
2. Top-down **orthographic** camera; character **faces +X** (game aim axis). Render with `art/scripts/render_sprites.py` → `art/renders/<character_id>/<clip>/`.
3. Composite frames into horizontal (or multi-row) PNG sheets at the target cell sizes above; write matching JSON (pivots, clip timing, `footfall_frames` / `events` where needed).
4. Import into the repo: `npm run import-anim-pack` from an extracted pack layout, or place WebP + JSON under `public/assets/animations/` and run `GITHUB_ACTIONS=true npm run build` to verify Pages paths (`docs/ANIMATION_IMPORT.md`).

WebP export in CI/scripts uses quality **92** (`scripts/import-anim-pack.mjs`, `rebake-knife-attack-sheet.mjs`).

## Git workflow

After any code change (including small follow-ups), **commit and push** to the working branch before ending the turn. Do not leave uncommitted work on the agent VM unless the user explicitly asks not to push.
