# HUSHFIRE — Weapon Customization & Ballistics Specification
**Game Title:** HUSHFIRE  
**Genre:** 2-Player Co-op Stealth/Assault Zombie Extraction Shooter  
**Engine Compatibility:** Canvas 2D / PixiJS / WebGL / Three.js  

---

## 1. Core Mechanics & Sound Propagation Formula

In *HUSHFIRE*, every weapon action produces two distinct physical signatures:
1. **Acoustic Signature (Sound Radius in Meters):** Propagates radially through the level, attenuated by walls, doors, and obstacles.
2. **Visual Signature (Muzzle Flash Radius & Duration):** Casts real-time light into the pitch-black environment, alerting zombies with line-of-sight.

### Sound Propagation Formula
$$\text{Alert Radius } (R) = R_{\text{base}} \times M_{\text{muzzle}} \times M_{\text{ammo}} \times \prod (1 - D_{\text{wall}})$$

Where:
* $R_{\text{base}}$ = Base weapon sound radius (m)
* $M_{\text{muzzle}}$ = Muzzle attachment multiplier (e.g., Suppressor: $0.15$, Muzzle Brake: $1.15$)
* $M_{\text{ammo}}$ = Ammo multiplier (e.g., Subsonic: $0.80$, High-Velocity: $1.20$)
* $D_{\text{wall}}$ = Wall attenuation dampening factor ($0.65$ for solid concrete, $0.35$ for drywall/glass)

---

## 2. Base Weapons Roster

### Primary Weapons
| Weapon | Class | Base Dmg | Fire Rate (RPM) | Mag Size | Reload (s) | Base Sound ($R_{\text{base}}$) | Muzzle Flash (Radius / Dur) | Spread / Recoil |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MPX-S Tactical** | SMG | 22 | 800 | 30 | 1.8s | 24m | 2.5m / 0.04s | Low / Very Low |
| **M4A1 CQB** | Assault Rifle | 38 | 650 | 30 | 2.2s | 42m | 4.8m / 0.05s | Med / Moderate |
| **Mossberg 590** | Tactical Shotgun| 8x18 (144)| 75 | 8 | 0.6s/shell | 55m | 7.0m / 0.08s | Wide Cone / High |
| **Viper Tac-Crossbow** | Silent Marksman | 115 | 45 | 1 (Bolt) | 1.4s | **1.2m** | **0.0m / 0.0s** | Pinpoint / None |
| **M1A Scout DMR** | Semi-Auto Rifle| 85 | 260 | 15 | 2.5s | 48m | 5.5m / 0.06s | Very Low / High Kick |

### Secondary Weapons
| Weapon | Class | Base Dmg | Fire Rate (RPM) | Mag Size | Reload (s) | Base Sound ($R_{\text{base}}$) | Muzzle Flash (Radius / Dur) | Spread / Recoil |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Glock 19 Tac** | 9mm Handgun | 28 | 400 | 15 | 1.4s | 26m | 2.2m / 0.04s | Low / Low |
| **Colt Python .357** | Heavy Revolver | 95 | 140 | 6 | 2.8s | 52m | 6.2m / 0.07s | Low / Massive |
| **Carbon Combat Knife** | Melee (Blade) | 60 (Back: 400)| 110 | ∞ | 0.0s | **0.5m** | **0.0m / 0.0s** | Melee Arc / None |

---

## 3. Weapon Customization: Muzzle Attachments

### Deep Comparison: Suppressors vs. Muzzle Brakes vs. Compensators vs. Flash Hiders

```
                                [ MUZZLE ATTACHMENTS ]
                                          |
        +------------------+--------------+-------------+--------------------+
        |                  |                            |                    |
   [ SUPPRESSOR ]    [ MUZZLE BRAKE ]            [ COMPENSATOR ]      [ FLASH HIDER ]
   • Sound: -85%     • Recoil: -40%              • Horiz Kick: -50%   • Flash: -95%
   • Flash: -70%     • Sound: +15%               • Sound: +10%        • Sound: Unchanged
   • Dmg: -10%       • Flash: +25%               • Fire Rate: +5%     • Ergo: +10%
   • Range: -15%     • Concussive Stun: 5%       • Ideal for Spray    • Night-Sight Ready
```

### Attachment Stats Matrix
| Attachment | Sound Multiplier ($M_{\text{muzzle}}$) | Muzzle Flash Multiplier | Damage Modifier | Recoil Reduction | Bullet Velocity | Primary Tactical Use |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Titanium Suppressor** | **0.15** (-85%) | **0.30** (-70%) | -10% | +5% Kick | -15% | **Stealth Ghost Run:** Room clearing without waking adjacent chambers. |
| **Quad-Port Muzzle Brake**| **1.15** (+15%) | **1.25** (+25%) | 0% | **-40% Vertical** | +5% | **Full Assault:** High sustained DPS on armored brutes and swarms. |
| **Linear Compensator** | **1.10** (+10%) | 1.00 (Normal) | 0% | **-50% Horizontal**| 0% | **Crowd Spray:** Tight burst grouping for rapid automatic fire. |
| **Vortex Flash Hider** | 1.00 (Normal) | **0.05** (-95%) | 0% | -10% | 0% | **Shadow Ambush:** Preserves night vision; no flash alert in pitch black. |
| **Sawed-off / Loud Choke**| **1.35** (+35%) | **1.40** (+40%) | +15% Pellet Dmg | -20% (Pellet spread)| -10% | **Panic Defense:** Maximum lethal stopping power; deafening boom. |

---

## 4. Rail & Underbarrel: Flashlights vs. Laser Sights vs. Hybrids

Lighting is a dual-edged sword in *HUSHFIRE*: light reveals zombies, but light directly shined onto zombie faces alerts them within 1.2–1.8 seconds.

```
       [ WIDE TACTICAL LIGHT ]                  [ MIL-SPEC LASER SIGHT ]
            \              /                               |
             \  65° Cone  /                         Pencil-thin beam
              \          /                       Zero ambient illumination
               \        /                        100% Invisible to Lurkers
                \  💡  /                                   |
                 [P1]                                     [P2]
```

### Illumination & Aiming Matrix
| Attachment | Cone Angle | Distance | Ambient Light | Hip-Fire Accuracy | Zombie Alert Modifier | Battery / Passive Trait |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wide Flood Flashlight** | **75° Wide** | 16 meters | High (lights up whole room) | +10% | **High Alert:** Awakens sleeping lurkers in 1.2s of direct beam | Consumes standard battery; reveals hidden loot & floor traps. |
| **Long-Beam Spotlight** | **32° Narrow** | **35 meters** | Low spill | +15% | **Medium Alert:** Snipers can spot distant threats before entering room | Long reach, but blinds tunnel vision flanks. |
| **IR / Visible Green Laser** | **1° Beam** | Infinite | **Zero** | **+45% Hip-Fire** | **Zero Alert:** Sleeping zombies NEVER wake from laser contact | Pinpoint crosshair in total darkness; no flashlight assistance. |
| **Tactical Hybrid (Light+Laser)**| 55° Mid | 22 meters | Moderate | +30% | Normal Alert | Toggleable (Key: T): Light ON / Laser ONLY / All OFF. |
| **UV Blacklight Module** | 50° Mid | 12 meters | Faint Violet | 0% | **Negative Alert:** Doesn't wake normal zombies | Reveals glowing toxic trails, bio-carrier weak spots, and keypad codes! |

---

## 5. Magazine & Ammunition Types

| Ammunition Type | Acoustic Multiplier | Armor Penetration | Flesh Damage | Special Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Standard FMJ** | 1.00 | Normal | 100% | Reliable baseline. |
| **Subsonic 9mm / 300 BLK**| **0.75 (-25%)** | -20% | 90% | Synergizes with Suppressors for true silent infiltration. |
| **Hollow-Point (JHP)** | 1.05 | -45% | **145%** | Massive bleeding; stagger effect on unarmored sprinters. |
| **Incendiary Dragontoothed**| 1.30 (+30%) | +10% | 110% + Fire DoT | Ignites targets; corpse light burns for 6 seconds (lighting up the room). |
| **High-Pressure Armor Piercing**| 1.20 (+20%) | **+85%** | 95% | Pierces through riot shields and multiple zombies in a line. |

---

## 6. Co-op Duo Synergy Presets

### Preset A: "Shadow Phantoms" (Full Stealth)
* **Player 1 (Scout):** Viper Crossbow + Suppressed Glock 19 + Green Laser + Decoy Chirper.
* **Player 2 (Infiltrator):** MPX-S (Titanium Suppressor + Subsonic Rounds) + Carbon Knife + UV Blacklight + Door Wedges.
* *Strategy:* Zero sound footprint. Silently eliminate isolated lurkers, sneak past swarms, pick locks, and reach extraction without firing a single unsilenced shot.

### Preset B: "Breach & Burn" (Full Assault)
* **Player 1 (Pointman):** Mossberg 590 (Loud Choke) + Colt Python .357 + Wide Flood Light + Pipe Bombs.
* **Player 2 (Gunner):** M4A1 CQB (Quad-Port Muzzle Brake + 60-rnd Drum) + Glock 19 + Spotlight + Deployable Turret.
* *Strategy:* Deliberately lure the horde into narrow choke points. Muzzle flashes light up the pitch-black hallway while devastating firepower wipes out waves.

### Preset C: "The Infiltration Compromise" (Stealth-Into-Assault)
* **Player 1 (Silent Spotter):** Suppressed DMR + Green Laser (Takes out distant sentries silently).
* **Player 2 (Heavy Backup):** Suppressed MPX-S + Backup Unsilenced Shotgun + Wide Tactical Light.
* *Strategy:* Move silently until someone makes a mistake; if the alarm sounds, Player 2 switches to the shotgun and holds the extraction door while Player 1 snipes high-threat targets.
