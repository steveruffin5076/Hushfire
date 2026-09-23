# HUSHFIRE — Claude Code Development Roadmap & Architecture Plan
**Project Title:** HUSHFIRE  
**Architecture:** 2-Player Co-op Top-Down Stealth/Assault Zombie Extraction Game  
**Target Platform:** Web (Modern Desktop Browsers: Chrome, Firefox, Edge, Safari)  
**Execution Context:** Designed for execution via Claude Code CLI / Agent Mode  

---

## 1. Executive Technical Summary & Tech Stack

```
+---------------------------------------------------------------------------------+
|                                 CLIENT (BROWSER)                                |
|  +--------------------+  +-----------------------+  +------------------------+  |
|  | PixiJS / 2D Canvas |  | Raycast 2D Light Mesh |  | Howler.js / Web Audio  |  |
|  | Game Rendering     |  | Flashlight & Shadows  |  | Spatial Sound & Alerts |  |
|  +--------------------+  +-----------------------+  +------------------------+  |
|            |                         |                          |               |
|            +-------------------------+--------------------------+               |
|                                      |                                          |
|                          +-----------------------+                              |
|                          | Game State & Physics  |                              |
|                          | (Player, AI, Weapons) |                              |
|                          +-----------------------+                              |
|                                      | (WebSockets / WebRTC)                    |
+--------------------------------------|------------------------------------------+
                                       v
+---------------------------------------------------------------------------------+
|                         SERVER / NETWORKING LAYER                               |
|        Node.js / PartyKit / ws WebSocket Hub (State Sync & Matchmaking)         |
+---------------------------------------------------------------------------------+
```

### Recommended Technology Stack:
1. **Language & Build System:** TypeScript + Vite (Fast HMR, zero-config bundling).
2. **Graphics & Rendering:** PixiJS v8 OR Canvas 2D with custom polygon raycasting (`2D Shadow Caster` with Bresenham / Ray-Segment intersection).
3. **Physics & Collision:** Custom lightweight 2D circle/AABB SAT (Separating Axis Theorem) collision system for optimal 60 FPS performance.
4. **Networking:** 
   * *Phase 1–4:* Local Co-op (WASD for P1, Arrow Keys / Gamepad for P2) + Simulated Coop AI.
   * *Phase 5+:* PartyKit / Node `ws` WebSocket relay with server-authoritative zombie states and client-side prediction for smooth movement.
5. **Audio Engine:** Web Audio API with directional stereo panning, low-pass filter occlusion (muffling sounds behind walls).

---

## 2. Recommended Directory Structure

```text
hushfire/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── assets/
│   │   ├── audio/              # SFX: gunshots, suppressed clicks, groans, heartbeats
│   │   ├── images/             # Spritesheets, textures, UI icons
│   │   └── fonts/              # Military monospace / stencil fonts
│   └── favicon.ico
├── src/
│   ├── main.ts                 # Game bootstrap & loop
│   ├── config/
│   │   ├── weapons.ts          # Weapon definitions & attachment stat multipliers
│   │   ├── zombies.ts          # Zombie types, speeds, awareness thresholds
│   │   └── constants.ts        # Canvas dimensions, physics rates, lighting constants
│   ├── core/
│   │   ├── Game.ts             # Main game orchestrator & state machine
│   │   ├── Input.ts            # Mouse, Keyboard, Gamepad input mapping
│   │   ├── Camera.ts           # Dynamic camera tracking players & zoom
│   │   └── SoundManager.ts     # Spatial audio, attenuation, footsteps
│   ├── lighting/
│   │   ├── Raycaster.ts        # 2D Ray-line segment intersection
│   │   ├── Flashlight.ts       # Cone mesh generation & falloff gradient
│   │   └── ShadowRenderer.ts   # Dark ambient mask with subtractive light blending
│   ├── entities/
│   │   ├── Entity.ts           # Base class (x, y, radius, health)
│   │   ├── Player.ts           # Player movement, inventory, flashlight, health
│   │   ├── Zombie.ts           # State machine (DORMANT, ALERTED, HUNTING, ATTACKING)
│   │   ├── Projectile.ts       # Bullets, crossbow bolts, pellets, penetration
│   │   └── Pickup.ts           # Ammo boxes, medkits, keycards, batteries
│   ├── systems/
│   │   ├── NoiseSystem.ts      # Propagates sound circles, tests wall occlusion
│   │   ├── CombatSystem.ts     # Hit detection, damage, recoil, muzzle flash
│   │   ├── AISystem.ts         # Zombie sensory evaluation & A* navigation
│   │   └── MapManager.ts       # Tilemaps, collision segments, sector transitions
│   ├── ui/
│   │   ├── HUD.ts              # Minimal diegetic ammo, decibel meter, health
│   │   ├── ArmoryMenu.ts       # Pre-match weapon & attachment selector
│   │   └── ExtractionModal.ts  # Win/Loss run summary & stats
│   └── net/
│       ├── NetworkClient.ts    # WebSocket client message handler
│       └── Protocol.ts         # Binary / JSON packet schemas
└── docs/
    ├── WEAPON_CUSTOMIZATION.md # Complete ballistics & attachment stats
    ├── ART_SPECIFICATION.md    # Sprite dimensions, palettes, animations
    └── PLAN_AND_PHASES.md      # This file
```

---

## 3. Step-by-Step Implementation Roadmap

```
Phase 0 [Setup] ────────► Phase 1 [Lighting Engine] ───► Phase 2 [Player & Controls]
                                                                  │
Phase 5 [AI & Sound Engine] ◄── Phase 4 [Weapons & Mods] ◄────────┘
           │
           ▼
Phase 6 [Maps & Sectors] ────► Phase 7 [Net & Polish] ───► Ready for Release
```

---

### Phase 0: Project Setup & Core Scaffold
* **Goal:** Set up TypeScript, Vite dev server, Canvas context, and core 60 FPS tick loop.
* **Claude Code Tasks:**
  1. Initialize `package.json` with dependencies (`typescript`, `vite`, `howler`).
  2. Configure `vite.config.ts` and `tsconfig.json`.
  3. Create `index.html` with full-viewport canvas (`#game-canvas`), styled with dark slate UI background.
  4. Create `src/core/Game.ts` with delta-time (`dt`) accumulation loop and requestAnimationFrame.
* **Acceptance Criteria:**
  - `npm run dev` starts instantly.
  - Black canvas renders with a debug FPS counter and test box.

---

### Phase 1: 2D Raycasted Darkness & Flashlight Lighting System
* **Goal:** Create pitch-black darkness where vision only exists inside dynamic flashlight cones that cast real shadows behind walls and obstacles.
* **Technical Implementation:**
  1. Define wall obstacles as 2D line segments: `Segment { p1: Point, p2: Point }`.
  2. Implement 2D Ray-Casting (`Raycaster.ts`):
     * Cast rays from flashlight source $(x, y)$ toward all wall vertices plus offsets ($\theta \pm 0.0001$).
     * Sort ray intersection points by angle to form a closed illumination polygon.
  3. Render Shadow Mask:
     * Draw full-screen black overlay (`rgba(5, 5, 8, 0.98)`).
     * Set `ctx.globalCompositeOperation = 'destination-out'` to punch the flashlight polygon out of the darkness mask.
     * Fill with radial gradient (bright center $\to$ soft amber/white falloff $\to$ feathered edge).
  4. Add Muzzle Flash & Laser Sight:
     * Laser: thin line with glow filter, stopped by the first obstacle.
     * Muzzle flash: instant radial light pulse lasting 2 frames ($32\text{ms}$).
* **Acceptance Criteria:**
  - Walls cast geometric shadows.
  - Moving the mouse sweeps the flashlight cone; objects behind walls remain pitch black.

---

### Phase 2: Operative Movement & 2-Player Controls
* **Goal:** Implement responsive top-down character movement, facing direction, and support for dual players (Local Co-op: WASD + Mouse for P1, Arrow Keys + IJKL or Gamepad for P2).
* **Technical Implementation:**
  1. `Player.ts`: Position, velocity, acceleration, friction, collision radius ($r = 16\text{px}$).
  2. Movement states:
     * **Sneak (Left Ctrl / Shift):** Speed $1.2\text{ m/s}$, zero footstep noise.
     * **Walk:** Speed $2.8\text{ m/s}$, sound radius $3\text{m}$.
     * **Sprint (Space):** Speed $5.0\text{ m/s}$, sound radius $8\text{m}$, flashlight bobs erratically.
  3. Player 1 and Player 2 share the same darkness overlay: each casts their own flashlight cone, dynamically merging their fields of view!
  4. Implement Downed & Revive Mechanic:
     * When HP reaches 0, player crawls at $0.8\text{ m/s}$.
     * Partner holds `F` within $2\text{m}$ for 3.0 seconds to revive.
* **Acceptance Criteria:**
  - Both players can move and illuminate independent sectors.
  - Standing back-to-back creates a 360° defensive perimeter.

---

### Phase 3: Weapon Arsenal & Customization Engine
* **Goal:** Implement all 8 weapons and modular attachment slots from `WEAPON_CUSTOMIZATION.md`.
* **Technical Implementation:**
  1. `config/weapons.ts`: Data-driven weapon definitions (MPX-S, M4A1, Mossberg 590, Crossbow, DMR, Glock, Revolver, Knife).
  2. Modular attachment system:
     * **Muzzle Slot:** None, Suppressor, Muzzle Brake, Compensator, Flash Hider.
     * **Rail Slot:** Wide Flood Light, Long Spot-Beam, Green Laser, UV Blacklight.
     * **Ammo Slot:** Standard, Subsonic, Hollow Point, Armor Piercing.
  3. Projectile Physics:
     * Bullet raycasting / fast line sweeps to prevent tunneling through walls.
     * Shotgun pellet spread (8 distinct rays with angle jitter).
     * Crossbow bolt: projectile entity that sticks in targets or walls and can be retrieved.
* **Acceptance Criteria:**
  - Suppressed weapons generate microscopic muzzle flashes and minimal sound circles.
  - Unsilenced shotguns generate massive flashes and alert whole rooms.

---

### Phase 4: Acoustic Noise Propagation & Zombie Sensory AI
* **Goal:** Implement the "Stealth vs. Assault" reaction engine.
* **Technical Implementation:**
  1. `NoiseSystem.ts`:
     * When a gun fires, footstep triggers, or glass breaks, spawn a `SoundEvent { x, y, radius, type }`.
     * Check path distance to zombies; damp radius if passing through walls ($D_{\text{wall}} = 0.65$).
  2. `Zombie.ts` State Machine:
     * **DORMANT (Sleeping/Slumped):** Unaware. Awakens if sound radius reaches them OR if flashlight beam hits their face for $> 1.2\text{s}$.
     * **SUSPICIOUS (Yellow Eyes):** Pauses, sniffs/turns toward sound location, walks to investigate.
     * **ENRAGED (Red Eyes):** Screams (alerting adjacent zombies within $10\text{m}$), sprints directly at target.
     * **HORDE SURGE:** Triggered by loud assault fire or car alarms; ignores shadows, tracks by smell.
  3. Zombie Archetypes:
     * *Lurker:* Standard slow shambler.
     * *Audio-Stalker:* Blind (immune to flashlights), hyper-sensitive to footsteps.
     * *Bio-Carrier:* Explodes into toxic cloud on death; requires ranged kill.
* **Acceptance Criteria:**
  - Players can sneak behind sleeping lurkers with knives/suppressors without waking the room.
  - Firing an unsilenced shotgun triggers a cascading swarm response.

---

### Phase 5: Map Manager, Multi-Sector Progression & Extraction
* **Goal:** Multi-sector run loop from Sector 1 to Extraction.
* **Sectors:**
  1. **Sector 1 (Transit):** Subterranean rails, tight choke points, sleeping lurkers. Objective: Find keycard / override manual blast door.
  2. **Sector 2 (Bio-Lab):** Shattered glass hazards, swinging security cameras, bio-carriers. Objective: Disable lockdown sequence.
  3. **Sector 3 (Helipad / Surface):** Open air, pouring rain, storm lightning.
* **The Extraction Climax:**
  * Players activate the emergency radio at the helipad.
  * Sirens blare and stadium floodlights hum to life.
  * **Holdout Timer:** 120-second survival countdown where stealth is shattered and assault weapons are essential.
  * Chopper touches down; both surviving players must reach the ramp to extract.
* **Acceptance Criteria:**
  - Full game loop: Armory $\to$ Sector 1 $\to$ Sector 2 $\to$ Sector 3 $\to$ Extraction $\to$ Victory Screen.

---

### Phase 6: Diegetic HUD & Armory Menu
* **Goal:** Immersive UI that does not ruin night vision.
* **Features:**
  * Diegetic circular reticle showing current weapon spread and ammo count.
  * Footstep decibel ripple around player feet.
  * Pre-mission Armory: Interactive loadout configurator with weapon stats bars (Sound dB, Recoil, Damage, Ergonomics).

---

### Phase 7: Polish, Sound & WebSockets / WebRTC Multiplayer
* **Goal:** 2-player networked play across browsers and sensory polish.
* **Features:**
  * WebRTC DataChannel / PartyKit room code system (e.g. `hushfire.app/#ROOM123`).
  * Spatial audio effects via Web Audio API (occlusion, gunshot reverb in tunnels).
  * Screen shake, blood splatters that stick to walls, spent bullet casings.

---

## 4. Claude Code Quickstart Instructions

When developing this project in Agent Mode / Claude Code:

```bash
# 1. Initialize project
npm init -y
npm install -D typescript vite @types/node
npm install howler @types/howler

# 2. Run dev server
npm run dev

# 3. Development order:
# Step 1: Implement Canvas raycast lighting in src/lighting/Raycaster.ts
# Step 2: Implement dual flashlight blending in src/lighting/ShadowRenderer.ts
# Step 3: Implement player movement and twin-stick controls in src/entities/Player.ts
# Step 4: Implement noise circles and zombie sensory AI in src/systems/NoiseSystem.ts
# Step 5: Implement armory customization and weapon firing in src/systems/CombatSystem.ts
```
