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
* **Base Size:** $48 \times 48\text{ px}$ canvas per frame (top-down view looking down at helmet/shoulders).
* **Pivot Point:** Exact center $(24, 24)$ for smooth 360-degree rotation toward mouse cursor.
* **Format:** Transparent PNG spritesheet or procedural Canvas 2D vector drawing.

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

| Infected Class | Dimensions | Shadow Appearance | Aggro Tell | Death FX |
| :--- | :--- | :--- | :--- | :--- |
| **Lurker** | $44 \times 44\text{ px}$ | Slumped posture against wall, head down, dull glowing eyes | Snaps upright, unhinges jaw, eyes flare red | Collapses forward, dark blood decal pools on floor |
| **Audio-Stalker** | $40 \times 40\text{ px}$ | Blind, bulbous mutated auditory horns on head, pale skin | Head twitches erratically toward sound sources | Disintegrates into bone splinters on high-caliber impact |
| **Bio-Carrier** | $52 \times 52\text{ px}$ | Swollen belly with translucent skin and glowing green fluid | Spews acidic puddle ($3\text{m}$ radius) when alerted | Explodes into toxic cloud that damages vision for 8s |
| **Armored Sentry**| $56 \times 56\text{ px}$ | Former SWAT with riot shield, ballistic vest, cracked helmet | Charges forward, deflects frontal bullets with sparks | Staggers when flanked; back spine glows exposed |

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
  * Dynamic brackets that widen during movement or sustained automatic fire to show bullet spread cone.
