# HUSHFIRE — Co-op Session Architecture & How to Play Guide
**Feature:** 2-Player Co-op Networking, Lobby Creation & Controls  
**Platforms:** Browser (Zero-Install, URL Room Link, or Same-Screen Local Play)  

---

## 1. The Two Ways to Play Co-op

*HUSHFIRE* supports two modes of cooperative play:

```
                                [ CO-OP MODES ]
                                       |
            +--------------------------+--------------------------+
            |                                                     |
  [ MODE 1: ONLINE URL LOBBY ]                          [ MODE 2: SAME-SCREEN LOCAL ]
  • Player 1 clicks "CREATE SESSION"                    • Two players on 1 keyboard / gamepad
  • Generates 4-letter code / shareable URL             • P1: WASD + Mouse
  • Player 2 clicks link and joins instantly            • P2: Arrow Keys + IJKL / Gamepad
  • Zero downloads, zero port-forwarding                • Perfect for couch co-op / testing
```

---

## 2. Mode 1: Online Co-op (Room Code / Share Link)

### How the Player Experience Works
1. **Player 1 (Host):**
   * Enters the Main Menu $\to$ clicks **"CREATE CO-OP SESSION"**.
   * The game generates a unique room code (e.g., `ROOM-7749`) and a copyable direct link:
     `https://hushfire.app/#ROOM-7749`
   * Player 1 sits in the Armory Lobby waiting for partner.
2. **Player 2 (Partner):**
   * Clicks the link sent by Player 1 (or types the 4-digit code into "JOIN SESSION").
   * Connects within ~500ms directly to Player 1.
3. **The Ready Check:**
   * Both players see each other's chosen Operative (Infiltrator vs. Breacher) and weapon attachments in real-time.
   * Both click **"READY TO DEPLOY"** $\to$ the mission begins!

---

## 3. Recommended Networking Tech: PeerJS (WebRTC) vs. PartyKit (WebSocket)

### Option A: PeerJS / WebRTC DataChannel (Recommended for 2-Player Indie Web)
* **Why it's ideal:** 
  * Free, serverless, and peer-to-peer.
  * Extremely low latency (<30ms) because data travels directly between Player 1 and Player 2 without an intermediate game server.
* **Architecture:**
  * Free public PeerJS signaling server connects the two browsers.
  * Once the connection is established, the game runs directly browser-to-browser via `RTCDataChannel`.

```
[ Browser 1 (Host) ] <====== WebRTC DataChannel ======> [ Browser 2 (Guest) ]
         \                                                    /
          +=====> [ Free PeerJS Signaling Server ] <==========+
                  (Only used for first 2 seconds to connect)
```

### Option B: PartyKit / Cloudflare Workers (WebSocket Relay)
* If your players are behind strict corporate firewalls/symmetric NATs, PartyKit provides a lightweight, zero-maintenance WebSocket relay with room isolation.

---

## 4. Network Protocol & Synchronization Model

For a 2-player top-down game, **Host-Authoritative with Client Prediction** is the simplest and most robust architecture:

```
[ PLAYER 1 (HOST) ]                                 [ PLAYER 2 (GUEST) ]
───────────────────                                 ────────────────────
Runs full physics simulation                        Runs local movement prediction
Authoritative for:                                  Sends inputs to Host:
• Zombie spawns, health, AI states                  • { moveX, moveY, aimAngle, isFiring, reload }
• Loot drops & door states                          Receives game snapshot (30Hz):
• Extraction timer                                  • { p1, p2, zombies[], extractionTimer }
Sends full state snapshot at 30Hz ────────────────► Interpolates smooth positions
```

### Packet Payloads

#### Client -> Host Input Packet (60Hz, ~18 bytes)
```json
{
  "t": "input",
  "seq": 1420,
  "x": 1.0,
  "y": -1.0,
  "angle": 1.57,
  "fire": true,
  "sprint": false,
  "sneak": false,
  "reload": false
}
```

#### Host -> Client World Snapshot (30Hz, ~250 bytes)
```json
{
  "t": "snapshot",
  "p1": { "x": 340, "y": 280, "angle": 0.42, "hp": 100, "weapon": "mpx", "mag": 28, "noise": 30 },
  "p2": { "x": 310, "y": 295, "angle": 1.85, "hp": 120, "weapon": "shotgun", "mag": 8, "noise": 0 },
  "zombies": [
    { "id": 1, "x": 580, "y": 220, "angle": 3.14, "hp": 50, "state": "DORMANT" },
    { "id": 3, "x": 720, "y": 410, "angle": -1.2, "hp": 75, "state": "ENRAGED" }
  ],
  "timer": 114
}
```

---

## 5. Mode 2: Same-Screen Local Co-op Controls

For instant testing on one computer (or playing locally on the couch):

| Action | Player 1 (Infiltrator) | Player 2 (Breacher) |
| :--- | :--- | :--- |
| **Move Up / Down / Left / Right** | `W` / `S` / `A` / `D` | `Up` / `Down` / `Left` / `Right` Arrow Keys |
| **Aim Direction** | Mouse Cursor | `I` / `K` / `J` / `L` (or right analog stick) |
| **Primary Fire** | Left Mouse Button | `Numpad 0` or `Enter` (or Right Trigger) |
| **Sprint** | `Spacebar` | `Right Shift` |
| **Sneak (Crouch-Walk)** | `Left Ctrl` or `Left Shift` | `Right Ctrl` |
| **Reload** | `R` | `/` (Slash) |
| **Interact / Revive Partner** | `F` or `E` | `.` (Period) |
| **Switch Weapon** | `Q` (or `1` / `2` to pick directly) | `,` (Comma) (or `Numpad 1` / `Numpad 2`) |
| **Flashlight On/Off** | `T` (or click the HUD button) | `'` (Quote) |
| **Pause** | `Esc` | `Esc` |

### Gamepad

Any controller the browser reports with the standard layout (Xbox, PlayStation, most modern pads) works alongside the keyboard. Press a button once after plugging it in; browsers hide pads until then.

* **Solo:** the first pad drives Player 1.
* **Co-op, one pad:** it drives Player 2, and Player 1 keeps keyboard + mouse.
* **Co-op, two pads:** the first pad is Player 1, the second is Player 2.

| Action | Gamepad |
| :--- | :--- |
| **Move** | Left stick |
| **Aim** | Right stick (holds its last direction when released) |
| **Primary Fire** | Right Trigger (RT / R2) |
| **Sprint** | Left Bumper (LB / L1) or click the left stick |
| **Sneak** | Left Trigger (LT / L2) |
| **Reload** | X (PlayStation: Square) |
| **Interact / Revive Partner** | A (PlayStation: Cross) |
| **Switch Weapon** | Y (PlayStation: Triangle) |
| **Primary / Secondary** | D-pad Left / Right |
| **Flashlight On/Off** | B (PlayStation: Circle) |
| **Pause / Resume** | Start / Options |

Menus (title screen, armory, pause menu) still need a mouse or a tap.

### Touch (phones & tablets)

On-screen controls appear after the first touch and drive Player 1 (solo is the intended mode on a phone). The game asks you to rotate to landscape if the device is held upright.

| Action | Touch |
| :--- | :--- |
| **Move** | Drag anywhere on the left half (the stick appears under your thumb) |
| **Aim** | Drag anywhere on the right half |
| **Primary Fire** | Push the aim stick past the red dashed ring; a light push aims without firing |
| **Sprint / Sneak** | `SPRINT` / `SNEAK` buttons (left edge), tap to toggle on/off |
| **Reload / Interact** | `RELOAD` / `USE` buttons (right edge), hold |
| **Switch Weapon / Flashlight** | `SWAP` / `LIGHT` buttons (right edge) |
| **Pause** | `II` button (top center) |

---

## 6. How to Test Co-op Locally with Claude Code

1. Start your local server:
   ```bash
   npm run dev
   ```
2. Open two browser windows side-by-side:
   * **Window 1:** `http://localhost:3000` (Click "Host Game" $\to$ copy room code).
   * **Window 2:** `http://localhost:3000/#ROOM-CODE` (Joins Window 1 automatically).
3. Both windows will connect via WebRTC loopback, giving you a full 2-player multiplayer test environment without needing a second device!
