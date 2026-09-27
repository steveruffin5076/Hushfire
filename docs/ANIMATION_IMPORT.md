# Animation sheet import

Baked character animations live under `public/assets/animations/<character>/` (WebP + JSON). The game loads them at boot via `AnimationCatalog` (`src/main.ts`).

## Update from a new zip

1. Extract the pack to `.tmp_anim_pack_v2/` at the repo root (or pass another path).
2. Run:

```bash
npm run import-anim-pack
```

The script prefers `.tmp_anim_pack_v2`, then `.tmp_anim_pack`, then an optional CLI path. It converts each `sprites/<character>/*_sheet.png` to WebP (quality 92) and writes JSON with an `image` field.

3. Commit `public/assets/animations/` when shipping new art.
4. Verify on GitHub Pages: `GITHUB_ACTIONS=true npm run build` and confirm `/Hushfire/assets/animations/**` returns 200.

Characters: `player_infiltrator`, `player_breacher`, five zombie folders (see `scripts/import-anim-pack.mjs`).

If sheets fail to load, `Game` falls back to static PNGs from `AssetLoader`.
