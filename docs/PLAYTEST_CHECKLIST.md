# Playtest checklist (solo & local co-op)

Use after meaningful gameplay or animation changes. Online co-op is out of scope for this list.

## Setup

- [ ] `npm install` && `npm test` && `npm run typecheck`
- [ ] `npm run dev` — hard-refresh if assets changed

## Solo — NORMAL

- [ ] Title → armory: **SOLO** has no **READY** button; deploy to Sector 1
- [ ] Flashlight battery drains; **T** / HUD button toggles light
- [ ] Walk / sprint / sneak; footsteps audible; sheet anim feet match movement (if animations loaded)
- [ ] Suppressed MPX stays stealth-ready; loud weapon triggers sector alert + horde warning
- [ ] Zombie contact: brief red vignette, **no** stuck red operative sprite
- [ ] Armored brute reads larger than other zombies; collision still fair at doors
- [ ] Sector 1 keycard → door → exit → reward picker → Sector 2
- [ ] Evac holdout (Sector 3): horde waves, extraction complete → end screen stats

## Local 2-player

- [ ] P1 keyboard + P2 gamepad (or second keyboard layout): both move, aim, revive
- [ ] Shared flashlight darkness; both must reach exit; downed revive works

## Gunfeel polish

- [ ] Firing rifles/shotgun ejects brass casings that skitter and fade
- [ ] Muzzle brake vs compensator feels different spread (recoil attachment)

## Pages build (before release)

```bash
GITHUB_ACTIONS=true npm run build
node scripts/verify-pages-assets.mjs
```

Serve `dist/` under `/Hushfire/` and spot-check one mission (animations not 404).
