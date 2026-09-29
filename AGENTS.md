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

## Git workflow

After any code change (including small follow-ups), **commit and push** to the working branch before ending the turn. Do not leave uncommitted work on the agent VM unless the user explicitly asks not to push.
