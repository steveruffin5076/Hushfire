# HUSHFIRE — Art Specification & Asset Manifest
**Document Version:** 1.0  
**Resolution Standard:** Top-Down 2D / 2.5D Pixel & Vector Hybrid  
**Color Palette Aesthetic:** Grim Industrial High-Contrast Noir  

---

## 1. Master Color Palette

| Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Abyssal Void** | `#050508` | Ambient darkness overlay, unlit sectors |
| **Wet Concrete** | `#1A1D24` | Floor tiles, asphalt, foundation walls |
| **Rusted Bulkhead** | `#2C1E1A` | Metal doors, structural beams, industrial containers |
| **Bio-Hazard Amber** | `#FF9E1B` | Player 2 flashlight, warning signs, alarm lights |
| **Pure Arc White** | `#EBF4FA` | Player 1 LED flashlight, fluorescent tube lights |
| **Lurker Phosphorus** | `#D4E157` | Zombie eye reflection in shadows (Dormant state) |
| **Enraged Crimson** | `#E53935` | Zombie eyes (Aggro state), muzzle flashes, laser sights |
| **Bio-Sludge Green** | `#00E676` | Spitter bile, acid pools, UV blacklight trails |
| **Muzzle Flare Orange** | `#FF6D00` | Unsuppressed gunfire dynamic light |

---

## 2. Character & Operative Sprites

### Sprite Dimensions & Frame Rates
* **Authored Size:** $128 \times 128\text{ px}$ transparent PNG per character (top-down view looking down at helmet/shoulders). This is the source resolution the art ships at, and therefore the ceiling on draw size — past $128\text{ px}$ the sprite upscales, and `index.html` sets `image-rendering: pixelated`, so it goes crunchy rather than soft.
* **Draw Size:** Operatives render at $94\text{ px}$ (`PLAYER_SPRITE_SIZE` in `src/core/Game.ts`); infected render per-archetype at $78$–$108\text{ px}$ (see §3). All are down-scales of the $128\text{ px}$ art.
* **Pivot Point:** Exact center $(64, 64)$ of the source art, drawn centered so it stays the rotation origin for smooth 360-degree rotation toward the mouse cursor.
* **Format:** Transparent PNG spritesheet or procedural Canvas 2D vector drawing.
* **Draw size is not hitbox size.** Collision uses a separate $16\text{ px}$ radius for both operatives and infected (`PLAYER_RADIUS`, `ZOMBIE_RADIUS`), so sprites render roughly $2.9\times$ their collision circle. Resizing sprites is therefore a purely visual change with no effect on hit detection, contact damage, collision resolution or pathfinding — keep it that way unless a difficulty change is actually intended.
* **Anything anchored to a sprite must scale with it.** The light spill that keeps an operative visible (`CARRY_LIGHT_RADIUS`), the muzzle-flash barrel offset, the downed revive ring, the infected eye tell and the infected health bar are all derived as ratios of the relevant draw size. Hardcoding them is how the eye tell and health bar came to be tuned for one archetype and misplaced on the others.

### Operative 1: "Ghost" (Infiltrator)
* **Visual Signature:** Lightweight tactical harness, black balaclava with single flipped-up night monocular (dim green dot), suppressed holster on thigh, sleek LED flashlight mounted on primary weapon.
* **Animation Sequences:**
  1. `idle`: 4 frames (subtle breathing sway)
  2. `crouch_walk`: 8 frames (low profile, minimal footstep animation)
  3. `run`: 8 frames (heavy stride, weapon bobbing)
  4. `aim_fire`: 3 frames (muzzle blast recoil kickback)
  5. `reload`: 6 frames (mag eject, pouch pull, mag seat, bolt release)
  6. `downed`: 4 frames (crawling on one elbow, distress beacon flashing)

### Operative 2: "Anvil" (Breacher)
* **Visual Signature:** Heavy ceramic plate carrier, tactical helmet with tinted visor, shotgun shell caddy strapped across chest, bulky weapon-mounted halogen lamp with warm amber tint.
* **Animation Sequences:** Same frame structure as Operative 1 with heavier recoil recoil recovery and wider shoulder stance.

---

## 3. Zombie Sprites & Visual States

Draw sizes are the values in `ZOMBIE_SPRITE_SIZE` (`src/core/Game.ts`). All four are authored at $128 \times 128\text{ px}$ and drawn down-scaled; the relative ordering below (stalker slight, brute largest) is the art direction and must survive any resize.

| Infected Class | Draw Size | Shadow Appearance | Aggro Tell | Death FX |
| :--- | :--- | :--- | :--- | :--- |
| **Lurker** | $86 \times 86\text{ px}$ | Slumped posture against wall, head down, dull glowing eyes | Snaps upright, unhinges jaw, eyes flare red | Collapses forward, dark blood decal pools on floor |
| **Audio-Stalker** | $78 \times 78\text{ px}$ | Blind, bulbous mutated auditory horns on head, pale skin | Head twitches erratically toward sound sources | Disintegrates into bone splinters on high-caliber impact |
| **Bio-Carrier** | $102 \times 102\text{ px}$ | Swollen belly with translucent skin and glowing green fluid | Spews acidic puddle ($3\text{m}$ radius) when alerted | Explodes into toxic cloud that damages vision for 8s |
| **Armored Sentry**| $108 \times 108\text{ px}$ | Former SWAT with riot shield, ballistic vest, cracked helmet | Charges forward, deflects frontal bullets with sparks | Staggers when flanked; back spine glows exposed |

The sensory-state eye tell is drawn on top of the sprite as two dots offset along the facing vector, scaled as ratios of that archetype's draw size ($0.17$ forward, $\pm 0.06$ lateral, radius $0.0375$): dull green when `DORMANT`, yellow when `SUSPICIOUS`, red when `ENRAGED`.

---

## 4. Lighting & Shadow Generation Specifications

* **Dynamic Light Mask:** Rendered to an offscreen buffer at full resolution (`1920x1080` or viewport size).
* **Flashlight Mesh:**
  * **P1 Arc:** $65^\circ$ FOV, 18-meter radius, linear falloff with soft radial edges (`#EBF4FA`).
  * **P2 Arc:** $75^\circ$ FOV, 14-meter radius, warm halogen tint (`#FFB347`).
* **Dynamic Occlusion:**
  * Every wall corner creates 2 ray endpoints: one directly at the vertex and one slightly past it ($\pm 0.001\text{ rad}$) to project infinite shadow geometry to the screen boundaries.
* **Laser Sight Beam:**
  * $1\text{ px}$ anti-aliased line, opacity $0.85$, color `#FF1744` (Red) or `#00E676` (Green).
  * Raycast test terminates laser at first collided wall or zombie, rendering a glowing $3\text{ px}$ dot at impact.

---

## 5. Diegetic HUD & Tactical Interface

* **Ammo & Status Display:**
  * Rendered as a floating holographic HUD element adjacent to player character ($28\text{ px}$ offset behind the aim vector).
  * Current Mag count / Total Ammo in clean monospace font (`Chakra Petch` or `Share Tech Mono`).
  * Suppressor wear / heat gauge if applicable.
* **Acoustic Ripple Effect (Sound Meter):**
  * When moving or shooting, an expanding translucent wireframe ring ripples outward from the operative’s feet.
  * Ring radius matches the exact zombie alert threshold for the current action (e.g., $1.5\text{m}$ for crouch-walk, $55\text{m}$ for unsuppressed shotgun).
* **Crosshair Reticle:**
  * **Color:** `#FF1744` — the same red §4 specifies for the laser sight, so aiming reads as one system. Previously cyan (`#00E5FF`) via `fx/reticle_crosshair.png`.
  * **Weight:** $3\text{ px}$ stroke, full opacity, round caps, over a $6\text{ px}$ `rgba(0,0,0,0.55)` under-stroke. The outline is what keeps the red legible against bright sector floors, blood decals and the damage vignette.
  * **Shape:** a ring plus four external ticks at the cardinal axes and a small center pip. The ring radius scales with the weapon's spread cone ($0.9 \times$ spread), so a shotgun reads visibly wider than an SMG.
  * **Drawn procedurally, not from the PNG asset.** Stroke weight must stay constant in screen space; a raster scaled to the spread thins to under $1\text{ px}$ for non-shotgun weapons, which is why the old crosshair read as faint. `fx/reticle_crosshair.png` is still loaded but no longer drawn.
  * **Drawn after the lighting pass**, in screen space, last of all. `ShadowRenderer` composites `rgba(5,5,8,0.96)` darkness over everything outside a light cone, so a world-space reticle is buried whenever the pointer leaves the flashlight — which is most of the screen in this game.
  * **It is the cursor.** The OS pointer is hidden during gameplay (`canvas.style.cursor = 'none'`), and the reticle is positioned at the pointer's exact screen position, so it replaces it. It therefore may never be dimmed by the darkness mask, the damage flash, or the HUD panels. An arrow still appears over the clickable HUD flashlight button, which is a screen-space control the reticle gives no affordance for.
  * *Not yet implemented:* widening during movement or sustained automatic fire. Spread currently differs only between pellet and single-projectile weapons.
