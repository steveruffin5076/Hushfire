#!/usr/bin/env python3
"""
HUSHFIRE — Master Asset Generator
Generates both vector SVGs and crisp anti-aliased PNG sprites for all characters,
zombies, weapons, attachments, items, and VFX.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = "/home/user/public/assets"
os.makedirs(f"{BASE_DIR}/sprites", exist_ok=True)
os.makedirs(f"{BASE_DIR}/weapons", exist_ok=True)
os.makedirs(f"{BASE_DIR}/items", exist_ok=True)
os.makedirs(f"{BASE_DIR}/fx", exist_ok=True)

# Helper for supersampled drawing (draw at 4x and resize with Lanczos for smooth anti-aliased edges)
def create_canvas(w=128, h=128, scale=4):
    img = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    return img, draw, scale

def finalize_sprite(img, w=128, h=128):
    return img.resize((w, h), Image.Resampling.LANCZOS)

# ==========================================
# 1. CHARACTER SPRITES (TOP-DOWN 128x128)
# Center is (64, 64), Aim facing RIGHT (+X axis)
# ==========================================

def draw_player_infiltrator():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s

    # Tactical backpack / rig (behind shoulders)
    d.rounded_rectangle([cx - 28*s, cy - 18*s, cx - 12*s, cy + 18*s], radius=6*s, fill="#16181E", outline="#252932", width=2*s)

    # Left & Right Shoulders / Vest (Matte Black / Charcoal)
    d.ellipse([cx - 16*s, cy - 28*s, cx + 18*s, cy + 28*s], fill="#1C1F26", outline="#2F3542", width=3*s)
    
    # Left Arm forward holding weapon handguard
    d.polygon([(cx + 4*s, cy - 24*s), (cx + 34*s, cy - 14*s), (cx + 30*s, cy - 6*s), (cx + 2*s, cy - 14*s)], fill="#232731")
    # Right Arm forward holding weapon grip
    d.polygon([(cx + 4*s, cy + 24*s), (cx + 32*s, cy + 12*s), (cx + 28*s, cy + 4*s), (cx + 2*s, cy + 14*s)], fill="#232731")

    # Primary Weapon (Suppressed SMG / Carbine pointing right)
    # Gun receiver & barrel
    d.rectangle([cx + 18*s, cy - 4*s, cx + 46*s, cy + 4*s], fill="#111215", outline="#3A3F4D", width=2*s)
    # Long Suppressor cylinder
    d.rounded_rectangle([cx + 46*s, cy - 5*s, cx + 62*s, cy + 5*s], radius=2*s, fill="#2B303A", outline="#4A5262", width=1*s)
    # Tactical Flashlight on right rail
    d.rectangle([cx + 30*s, cy + 4*s, cx + 44*s, cy + 8*s], fill="#333742", outline="#505666", width=1*s)
    # Flashlight LED emitter lens
    d.ellipse([cx + 43*s, cy + 4*s, cx + 46*s, cy + 8*s], fill="#EBF4FA")

    # Tactical Helmet (Center)
    d.ellipse([cx - 14*s, cy - 14*s, cx + 14*s, cy + 14*s], fill="#0F1115", outline="#373D4A", width=2*s)
    # Night-vision monocular flipped up / amber comm headset
    d.rectangle([cx + 6*s, cy - 12*s, cx + 12*s, cy - 8*s], fill="#00E676") # Green NVG indicator LED
    d.ellipse([cx - 4*s, cy - 16*s, cx + 4*s, cy - 12*s], fill="#3A3F4D") # Comms left
    d.ellipse([cx - 4*s, cy + 12*s, cx + 4*s, cy + 16*s], fill="#3A3F4D") # Comms right

    # Light beam preview hint (semi-transparent subtle ray cone)
    d.polygon([(cx + 46*s, cy + 6*s), (cx + 64*s, cy - 6*s), (cx + 64*s, cy + 18*s)], fill=(235, 244, 250, 45))

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/player_infiltrator.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <defs>
        <radialGradient id="infilLight" cx="46" cy="68" r="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EBF4FA" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#EBF4FA" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Tactical Rig -->
      <rect x="36" y="46" width="16" height="36" rx="6" fill="#16181E" stroke="#252932" stroke-width="2"/>
      <!-- Shoulders -->
      <ellipse cx="64" cy="64" rx="18" ry="28" fill="#1C1F26" stroke="#2F3542" stroke-width="3"/>
      <!-- Arms -->
      <path d="M68 40 L98 50 L94 58 L66 50 Z" fill="#232731"/>
      <path d="M68 88 L96 76 L92 68 L66 78 Z" fill="#232731"/>
      <!-- Suppressed Weapon -->
      <rect x="82" y="60" width="28" height="8" fill="#111215" stroke="#3A3F4D" stroke-width="1.5"/>
      <rect x="110" y="59" width="16" height="10" rx="2" fill="#2B303A" stroke="#4A5262" stroke-width="1"/>
      <!-- Flashlight -->
      <rect x="94" y="68" width="14" height="4" fill="#333742"/>
      <circle cx="108" cy="70" r="2" fill="#EBF4FA"/>
      <!-- Helmet -->
      <circle cx="64" cy="64" r="14" fill="#0F1115" stroke="#373D4A" stroke-width="2"/>
      <circle cx="72" cy="54" r="2" fill="#00E676"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/player_infiltrator.svg", "w") as f:
        f.write(svg_content)

def draw_player_breacher():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s

    # Heavy Defibrillator / Breaching Rig (Back)
    d.rounded_rectangle([cx - 32*s, cy - 22*s, cx - 14*s, cy + 22*s], radius=8*s, fill="#1A1815", outline="#473A2B", width=3*s)
    # Red cross on trauma pack
    d.rectangle([cx - 24*s, cy - 8*s, cx - 20*s, cy + 8*s], fill="#D32F2F")
    d.rectangle([cx - 28*s, cy - 4*s, cx - 16*s, cy + 4*s], fill="#D32F2F")

    # Armored Heavy Shoulders / Ballistic Vest (OD Green / Dark Armor)
    d.ellipse([cx - 16*s, cy - 32*s, cx + 20*s, cy + 32*s], fill="#262D24", outline="#3E4C3A", width=3*s)
    # Shotgun shell loops across vest
    for i in range(-12, 16, 6):
        d.rectangle([cx - 2*s, cy + (i-2)*s, cx + 4*s, cy + (i+2)*s], fill="#C0392B", outline="#E74C3C", width=1*s)

    # Thick Armored Arms holding Shotgun / Heavy Rifle
    d.polygon([(cx + 4*s, cy - 28*s), (cx + 36*s, cy - 16*s), (cx + 30*s, cy - 6*s), (cx + 2*s, cy - 16*s)], fill="#2E382B")
    d.polygon([(cx + 4*s, cy + 28*s), (cx + 34*s, cy + 14*s), (cx + 28*s, cy + 4*s), (cx + 2*s, cy + 16*s)], fill="#2E382B")

    # Tactical Shotgun (Heavy Barrel & Pump)
    d.rectangle([cx + 18*s, cy - 5*s, cx + 52*s, cy + 5*s], fill="#15171A", outline="#4B5361", width=2*s)
    d.rectangle([cx + 26*s, cy - 6*s, cx + 38*s, cy + 6*s], fill="#3F4652") # Ribbed pump grip
    # Quad-Port Muzzle Brake
    d.rectangle([cx + 52*s, cy - 7*s, cx + 58*s, cy + 7*s], fill="#5A6273", outline="#768196", width=1*s)
    # Bulky Amber Halogen Light
    d.rectangle([cx + 34*s, cy + 5*s, cx + 48*s, cy + 11*s], fill="#3A352A", outline="#736140", width=1*s)
    d.ellipse([cx + 47*s, cy + 5*s, cx + 50*s, cy + 11*s], fill="#FF9E1B") # Warm Amber Lens

    # Ballistic Combat Helmet
    d.ellipse([cx - 15*s, cy - 15*s, cx + 15*s, cy + 15*s], fill="#1B211A", outline="#43523F", width=2*s)
    # Tinted Heavy Visor (Curved front)
    d.arc([cx - 12*s, cy - 12*s, cx + 14*s, cy + 12*s], start=290, end=70, fill="#E67E22", width=3*s)

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/player_breacher.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <!-- Trauma Pack -->
      <rect x="32" y="42" width="18" height="44" rx="8" fill="#1A1815" stroke="#473A2B" stroke-width="2"/>
      <rect x="40" y="56" width="3" height="16" fill="#D32F2F"/>
      <rect x="34" y="62" width="15" height="4" fill="#D32F2F"/>
      <!-- Shoulders -->
      <ellipse cx="64" cy="64" rx="20" ry="32" fill="#262D24" stroke="#3E4C3A" stroke-width="3"/>
      <!-- Shells -->
      <line x1="62" y1="52" x2="68" y2="52" stroke="#E74C3C" stroke-width="3"/>
      <line x1="62" y1="60" x2="68" y2="60" stroke="#E74C3C" stroke-width="3"/>
      <line x1="62" y1="68" x2="68" y2="68" stroke="#E74C3C" stroke-width="3"/>
      <!-- Arms -->
      <path d="M68 36 L100 48 L94 58 L66 48 Z" fill="#2E382B"/>
      <path d="M68 92 L98 80 L92 70 L66 80 Z" fill="#2E382B"/>
      <!-- Shotgun & Muzzle Brake -->
      <rect x="82" y="59" width="34" height="10" fill="#15171A" stroke="#4B5361" stroke-width="1.5"/>
      <rect x="116" y="57" width="6" height="14" fill="#5A6273" stroke="#768196" stroke-width="1"/>
      <circle cx="112" cy="73" r="3" fill="#FF9E1B"/>
      <!-- Helmet & Visor -->
      <circle cx="64" cy="64" r="15" fill="#1B211A" stroke="#43523F" stroke-width="2"/>
      <path d="M72 55 A 12 12 0 0 1 72 73" fill="none" stroke="#E67E22" stroke-width="3"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/player_breacher.svg", "w") as f:
        f.write(svg_content)

def draw_player_downed():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s
    # Blood pool under downed player
    d.ellipse([cx - 28*s, cy - 20*s, cx + 32*s, cy + 24*s], fill=(136, 14, 14, 180))
    # Downed torso collapsed sideways
    d.ellipse([cx - 18*s, cy - 14*s, cx + 18*s, cy + 18*s], fill="#1C1F26", outline="#373D4A", width=2*s)
    # Helmet tilted down
    d.ellipse([cx - 4*s, cy - 12*s, cx + 20*s, cy + 12*s], fill="#0F1115", outline="#2F3542", width=2*s)
    # Flashing Cyan Distress Beacon Pulse
    d.ellipse([cx - 22*s, cy - 6*s, cx - 14*s, cy + 2*s], fill="#00E5FF", outline="#E0F7FA", width=2*s)
    # Stretched arm reaching for help
    d.line([(cx + 14*s, cy + 4*s), (cx + 38*s, cy + 16*s)], fill="#232731", width=5*s)

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/player_downed.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <ellipse cx="66" cy="66" rx="30" ry="22" fill="#880E0E" fill-opacity="0.7"/>
      <ellipse cx="60" cy="62" rx="18" ry="16" fill="#1C1F26" stroke="#373D4A" stroke-width="2"/>
      <circle cx="72" cy="62" r="13" fill="#0F1115" stroke="#2F3542" stroke-width="2"/>
      <circle cx="46" cy="58" r="5" fill="#00E5FF" stroke="#E0F7FA" stroke-width="2"/>
      <line x1="74" y1="68" x2="98" y2="80" stroke="#232731" stroke-width="5" stroke-linecap="round"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/player_downed.svg", "w") as f:
        f.write(svg_content)

# ==========================================
# 2. ZOMBIE SPRITES (TOP-DOWN 128x128)
# ==========================================

def draw_zombie_lurker(aggro=False):
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s

    # Tattered decaying clothing & decayed skin
    skin_color = "#3A4438" if not aggro else "#485340"
    cloth_color = "#24201E"
    eye_color = "#E53935" if aggro else "#D4E157" # Yellow when dormant, red when aggro

    # Slumped rotting shoulders
    d.ellipse([cx - 16*s, cy - 24*s, cx + 16*s, cy + 24*s], fill=cloth_color, outline="#161413", width=2*s)
    
    # Clawed outstretched decomposing arms
    arm_reach = 36*s if aggro else 22*s
    d.polygon([(cx + 2*s, cy - 20*s), (cx + arm_reach, cy - 14*s), (cx + (arm_reach - 4*s), cy - 6*s), (cx, cy - 12*s)], fill=skin_color)
    d.polygon([(cx + 2*s, cy + 20*s), (cx + arm_reach, cy + 14*s), (cx + (arm_reach - 4*s), cy + 6*s), (cx, cy + 12*s)], fill=skin_color)

    # Rotting Head / Exposed Skull
    d.ellipse([cx - 12*s, cy - 12*s, cx + 14*s, cy + 12*s], fill=skin_color, outline="#1B2219", width=2*s)
    # Sunken tapetum lucidum eyes
    d.ellipse([cx + 6*s, cy - 6*s, cx + 11*s, cy - 2*s], fill=eye_color)
    d.ellipse([cx + 6*s, cy + 2*s, cx + 11*s, cy + 6*s], fill=eye_color)

    if aggro:
        # Gaping snarling bloody jaw
        d.polygon([(cx + 10*s, cy - 3*s), (cx + 18*s, cy), (cx + 10*s, cy + 3*s)], fill="#7F0000")

    name = "zombie_lurker_aggro" if aggro else "zombie_lurker"
    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/{name}.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <ellipse cx="64" cy="64" rx="16" ry="24" fill="{cloth_color}" stroke="#161413" stroke-width="2"/>
      <path d="M66 44 L{"100" if aggro else "86"} 50 L{"96" if aggro else "82"} 58 L64 52 Z" fill="{skin_color}"/>
      <path d="M66 84 L{"100" if aggro else "86"} 78 L{"96" if aggro else "82"} 70 L64 76 Z" fill="{skin_color}"/>
      <circle cx="65" cy="64" r="13" fill="{skin_color}" stroke="#1B2219" stroke-width="2"/>
      <circle cx="73" cy="60" r="2.5" fill="{eye_color}"/>
      <circle cx="73" cy="68" r="2.5" fill="{eye_color}"/>
      {'<polygon points="74,62 82,64 74,66" fill="#7F0000"/>' if aggro else ''}
    </svg>'''
    with open(f"{BASE_DIR}/sprites/{name}.svg", "w") as f:
        f.write(svg_content)

def draw_zombie_audio_stalker():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s
    skin = "#D2D7DF" # Pale, chalky, eyeless flesh

    # Emaciated shoulders
    d.ellipse([cx - 14*s, cy - 22*s, cx + 14*s, cy + 22*s], fill="#424750", outline="#2B2F38", width=2*s)
    # Long thin reaching talons
    d.polygon([(cx, cy - 18*s), (cx + 38*s, cy - 8*s), (cx + 34*s, cy - 2*s), (cx - 2*s, cy - 12*s)], fill=skin)
    d.polygon([(cx, cy + 18*s), (cx + 38*s, cy + 8*s), (cx + 34*s, cy + 2*s), (cx - 2*s, cy + 12*s)], fill=skin)

    # Blind head with prominent ear cavities / auditory horn mutations
    d.ellipse([cx - 12*s, cy - 14*s, cx + 14*s, cy + 14*s], fill=skin, outline="#8C93A0", width=2*s)
    # Large cupped mutated acoustic ears
    d.ellipse([cx - 2*s, cy - 20*s, cx + 8*s, cy - 12*s], fill="#A84848", outline="#732626", width=2*s)
    d.ellipse([cx - 2*s, cy + 12*s, cx + 8*s, cy + 20*s], fill="#A84848", outline="#732626", width=2*s)

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/zombie_audio_stalker.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <ellipse cx="64" cy="64" rx="14" ry="22" fill="#424750" stroke="#2B2F38" stroke-width="2"/>
      <path d="M64 46 L102 56 L98 62 L62 52 Z" fill="{skin}"/>
      <path d="M64 82 L102 72 L98 66 L62 76 Z" fill="{skin}"/>
      <circle cx="65" cy="64" r="14" fill="{skin}" stroke="#8C93A0" stroke-width="2"/>
      <!-- Mutated Ears -->
      <ellipse cx="67" cy="48" rx="5" ry="4" fill="#A84848" stroke="#732626" stroke-width="1.5"/>
      <ellipse cx="67" cy="80" rx="5" ry="4" fill="#A84848" stroke="#732626" stroke-width="1.5"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/zombie_audio_stalker.svg", "w") as f:
        f.write(svg_content)

def draw_zombie_bio_carrier():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s
    # Swollen belly with glowing toxic green fluid
    d.ellipse([cx - 22*s, cy - 26*s, cx + 20*s, cy + 26*s], fill="#1C3829", outline="#00E676", width=3*s)
    # Toxic pustules
    d.ellipse([cx - 10*s, cy - 18*s, cx + 2*s, cy - 8*s], fill="#69F0AE")
    d.ellipse([cx - 4*s, cy + 8*s, cx + 8*s, cy + 18*s], fill="#69F0AE")
    d.ellipse([cx - 14*s, cy - 2*s, cx - 2*s, cy + 8*s], fill="#00C853")

    # Mutated head spewing green mist
    d.ellipse([cx + 2*s, cy - 12*s, cx + 24*s, cy + 12*s], fill="#2E4A37", outline="#00E676", width=2*s)
    d.ellipse([cx + 14*s, cy - 5*s, cx + 18*s, cy - 1*s], fill="#B9F6CA")
    d.ellipse([cx + 14*s, cy + 1*s, cx + 18*s, cy + 5*s], fill="#B9F6CA")

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/zombie_bio_carrier.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <ellipse cx="63" cy="64" rx="21" ry="26" fill="#1C3829" stroke="#00E676" stroke-width="3"/>
      <circle cx="59" cy="51" r="5" fill="#69F0AE"/>
      <circle cx="66" cy="77" r="5" fill="#69F0AE"/>
      <circle cx="55" cy="67" r="6" fill="#00C853"/>
      <circle cx="77" cy="64" r="12" fill="#2E4A37" stroke="#00E676" stroke-width="2"/>
      <circle cx="85" cy="61" r="2" fill="#B9F6CA"/>
      <circle cx="85" cy="67" r="2" fill="#B9F6CA"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/zombie_bio_carrier.svg", "w") as f:
        f.write(svg_content)

def draw_zombie_armored_brute():
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s
    # Heavy ex-SWAT tactical body armor
    d.ellipse([cx - 20*s, cy - 34*s, cx + 22*s, cy + 34*s], fill="#1E222A", outline="#454D5D", width=4*s)
    # Heavy ballistic helmet
    d.ellipse([cx - 14*s, cy - 16*s, cx + 18*s, cy + 16*s], fill="#111317", outline="#606B82", width=3*s)
    # Visor with crack and glowing eye
    d.arc([cx - 6*s, cy - 10*s, cx + 16*s, cy + 10*s], start=300, end=60, fill="#FF5252", width=3*s)

    # Heavy Riot Shield held in front (curved polycarbon barrier)
    d.rounded_rectangle([cx + 26*s, cy - 36*s, cx + 38*s, cy + 36*s], radius=4*s, fill="#2C3540", outline="#78909C", width=3*s)
    # Shield police decal line
    d.line([(cx + 32*s, cy - 28*s), (cx + 32*s, cy + 28*s)], fill="#ECEFF1", width=2*s)

    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/sprites/zombie_armored_brute.png")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <ellipse cx="65" cy="64" rx="21" ry="34" fill="#1E222A" stroke="#454D5D" stroke-width="4"/>
      <circle cx="66" cy="64" r="16" fill="#111317" stroke="#606B82" stroke-width="3"/>
      <path d="M74 54 A 12 12 0 0 1 74 74" fill="none" stroke="#FF5252" stroke-width="3"/>
      <!-- Riot Shield -->
      <rect x="90" y="28" width="12" height="72" rx="4" fill="#2C3540" stroke="#78909C" stroke-width="3"/>
      <line x1="96" y1="36" x2="96" y2="92" stroke="#ECEFF1" stroke-width="2"/>
    </svg>'''
    with open(f"{BASE_DIR}/sprites/zombie_armored_brute.svg", "w") as f:
        f.write(svg_content)

# ==========================================
# 3. WEAPONS & ATTACHMENTS (128x64 horizontal)
# ==========================================

def draw_weapons():
    weapons = {
        "weapon_mpx": {
            "body": [(20, 26, 75, 38), "#1F232B"],
            "mag": [(48, 38, 56, 56), "#14161B"],
            "barrel": [(75, 29, 100, 35), "#2E3440"],
            "stock": [(8, 29, 20, 35), "#14161B"]
        },
        "weapon_m4a1": {
            "body": [(22, 24, 80, 38), "#232832"],
            "mag": [(52, 38, 62, 58), "#171A21"],
            "barrel": [(80, 28, 114, 34), "#373E4D"],
            "stock": [(6, 26, 22, 36), "#171A21"]
        },
        "weapon_shotgun": {
            "body": [(20, 24, 82, 38), "#1A1D24"],
            "mag": [(40, 36, 68, 44), "#383E4C"], # Pump
            "barrel": [(82, 27, 118, 35), "#2A2F3A"],
            "stock": [(4, 25, 20, 37), "#332219"] # Polymer/wood stock
        },
        "weapon_crossbow": {
            "body": [(14, 28, 95, 36), "#22272F"],
            "limb_top": [(60, 6, 85, 28), "#3E4654"],
            "limb_bot": [(60, 36, 85, 58), "#3E4654"],
            "string": [(60, 8, 60, 56), "#00E676"]
        },
        "weapon_glock": {
            "body": [(38, 26, 82, 38), "#1E222A"],
            "grip": [(42, 38, 54, 56), "#15181E"],
            "barrel": [(82, 28, 94, 36), "#2B313D"]
        },
        "weapon_revolver": {
            "body": [(34, 26, 76, 38), "#4B5362"],
            "cylinder": [(52, 24, 68, 40), "#2A2F38"],
            "grip": [(36, 38, 48, 58), "#5D3A24"],
            "barrel": [(76, 28, 102, 36), "#606B7D"]
        },
        "weapon_knife": {
            "blade": [(45, 28, 105, 36), "#CFD8DC"],
            "handle": [(18, 27, 45, 37), "#1E222A"],
            "guard": [(43, 23, 47, 41), "#37474F"]
        }
    }

    for name, parts in weapons.items():
        img, d, s = create_canvas(128, 64)
        for part_name, spec in parts.items():
            if len(spec) == 2 and isinstance(spec[0], tuple) and len(spec[0]) == 4:
                # Rectangle
                coords, col = spec
                d.rectangle([coords[0]*s, coords[1]*s, coords[2]*s, coords[3]*s], fill=col)
            elif len(spec) == 2 and isinstance(spec[0], list):
                # Polygon
                coords, col = spec
                scaled_coords = [(pt[0]*s, pt[1]*s) for pt in coords]
                d.polygon(scaled_coords, fill=col)
            elif part_name == "string":
                coords, col = spec
                d.line([(coords[0]*s, coords[1]*s), (coords[2]*s, coords[3]*s)], fill=col, width=2*s)

        sprite = finalize_sprite(img, 128, 64)
        sprite.save(f"{BASE_DIR}/weapons/{name}.png")

        # SVG export
        svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64" width="128" height="64">']
        for part_name, spec in parts.items():
            if len(spec) == 2 and isinstance(spec[0], tuple):
                c, col = spec
                svg.append(f'  <rect x="{c[0]}" y="{c[1]}" width="{c[2]-c[0]}" height="{c[3]-c[1]}" rx="2" fill="{col}" stroke="#101216" stroke-width="1"/>')
            elif part_name == "string":
                c, col = spec
                svg.append(f'  <line x1="{c[0]}" y1="{c[1]}" x2="{c[2]}" y2="{c[3]}" stroke="{col}" stroke-width="2"/>')
            elif len(spec) == 2 and isinstance(spec[0], list):
                c, col = spec
                pts = " ".join([f"{pt[0]},{pt[1]}" for pt in c])
                svg.append(f'  <polygon points="{pts}" fill="{col}" stroke="#101216" stroke-width="1"/>')
        svg.append('</svg>')
        with open(f"{BASE_DIR}/weapons/{name}.svg", "w") as f:
            f.write("\n".join(svg))

def draw_attachments():
    # 1. Suppressor
    img, d, s = create_canvas(64, 64)
    d.rounded_rectangle([10*s, 24*s, 54*s, 40*s], radius=4*s, fill="#2C323D", outline="#4A5468", width=2*s)
    d.line([(18*s, 24*s), (18*s, 40*s)], fill="#1E222A", width=2*s)
    d.line([(46*s, 24*s), (46*s, 40*s)], fill="#1E222A", width=2*s)
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/weapons/attachment_suppressor.png")
    with open(f"{BASE_DIR}/weapons/attachment_suppressor.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="24" width="44" height="16" rx="4" fill="#2C323D" stroke="#4A5468" stroke-width="2"/><line x1="18" y1="24" x2="18" y2="40" stroke="#1E222A" stroke-width="2"/><line x1="46" y1="24" x2="46" y2="40" stroke="#1E222A" stroke-width="2"/></svg>')

    # 2. Muzzle Brake
    img, d, s = create_canvas(64, 64)
    d.rectangle([14*s, 22*s, 50*s, 42*s], fill="#3F4756", outline="#636F87", width=2*s)
    # Gas ports
    for x in (22, 32, 42):
        d.rectangle([x*s, 24*s, (x+4)*s, 30*s], fill="#181B22")
        d.rectangle([x*s, 34*s, (x+4)*s, 40*s], fill="#181B22")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/weapons/attachment_muzzle_brake.png")
    with open(f"{BASE_DIR}/weapons/attachment_muzzle_brake.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="14" y="22" width="36" height="20" rx="2" fill="#3F4756" stroke="#636F87" stroke-width="2"/><rect x="22" y="24" width="4" height="6" fill="#181B22"/><rect x="32" y="24" width="4" height="6" fill="#181B22"/><rect x="42" y="24" width="4" height="6" fill="#181B22"/><rect x="22" y="34" width="4" height="6" fill="#181B22"/><rect x="32" y="34" width="4" height="6" fill="#181B22"/><rect x="42" y="34" width="4" height="6" fill="#181B22"/></svg>')

    # 3. Flashlight
    img, d, s = create_canvas(64, 64)
    d.rectangle([12*s, 26*s, 44*s, 38*s], fill="#2A303C", outline="#475166", width=2*s)
    d.polygon([(44*s, 23*s), (54*s, 20*s), (54*s, 44*s), (44*s, 41*s)], fill="#3B4454", outline="#59667E")
    d.ellipse([51*s, 22*s, 55*s, 42*s], fill="#EBF4FA")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/weapons/attachment_flashlight.png")
    with open(f"{BASE_DIR}/weapons/attachment_flashlight.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="26" width="32" height="12" fill="#2A303C" stroke="#475166" stroke-width="2"/><polygon points="44,23 54,20 54,44 44,41" fill="#3B4454"/><ellipse cx="53" cy="32" rx="2" ry="10" fill="#EBF4FA"/></svg>')

    # 4. Green Laser Module
    img, d, s = create_canvas(64, 64)
    d.rectangle([14*s, 24*s, 42*s, 40*s], fill="#1C1F26", outline="#3B4252", width=2*s)
    d.ellipse([40*s, 28*s, 46*s, 36*s], fill="#00E676", outline="#B9F6CA", width=1*s)
    d.line([(46*s, 32*s), (62*s, 32*s)], fill="#00E676", width=2*s)
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/weapons/attachment_laser.png")
    with open(f"{BASE_DIR}/weapons/attachment_laser.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="14" y="24" width="28" height="16" fill="#1C1F26" stroke="#3B4252" stroke-width="2"/><circle cx="43" cy="32" r="4" fill="#00E676"/><line x1="46" y1="32" x2="62" y2="32" stroke="#00E676" stroke-width="2"/></svg>')

# ==========================================
# 4. ITEMS & PICKUPS (64x64)
# ==========================================

def draw_pickups():
    # Ammo Box
    img, d, s = create_canvas(64, 64)
    d.rectangle([10*s, 16*s, 54*s, 48*s], fill="#354A2F", outline="#5B7D51", width=2*s)
    d.rectangle([20*s, 20*s, 44*s, 44*s], fill="#273822")
    # Gold bullet stencil
    d.rectangle([28*s, 26*s, 36*s, 38*s], fill="#F1C40F")
    d.polygon([(28*s, 26*s), (32*s, 20*s), (36*s, 26*s)], fill="#F39C12")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/items/pickup_ammo.png")
    with open(f"{BASE_DIR}/items/pickup_ammo.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="16" width="44" height="32" rx="3" fill="#354A2F" stroke="#5B7D51" stroke-width="2"/><rect x="20" y="20" width="24" height="24" fill="#273822"/><rect x="28" y="26" width="8" height="12" fill="#F1C40F"/><polygon points="28,26 32,20 36,26" fill="#F39C12"/></svg>')

    # Medkit
    img, d, s = create_canvas(64, 64)
    d.rectangle([10*s, 14*s, 54*s, 50*s], fill="#ECEFF1", outline="#B0BEC5", width=2*s)
    # Red cross
    d.rectangle([28*s, 22*s, 36*s, 42*s], fill="#E53935")
    d.rectangle([20*s, 28*s, 44*s, 36*s], fill="#E53935")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/items/pickup_medkit.png")
    with open(f"{BASE_DIR}/items/pickup_medkit.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="14" width="44" height="36" rx="4" fill="#ECEFF1" stroke="#B0BEC5" stroke-width="2"/><rect x="28" y="22" width="8" height="20" fill="#E53935"/><rect x="20" y="28" width="24" height="8" fill="#E53935"/></svg>')

    # Battery Cell
    img, d, s = create_canvas(64, 64)
    d.rectangle([16*s, 18*s, 48*s, 50*s], fill="#263238", outline="#546E7A", width=2*s)
    d.rectangle([26*s, 12*s, 38*s, 18*s], fill="#90A4AE")
    # Lightning bolt icon
    d.polygon([(34*s, 22*s), (24*s, 34*s), (32*s, 34*s), (30*s, 46*s), (40*s, 32*s), (32*s, 32*s)], fill="#00E5FF")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/items/pickup_battery.png")
    with open(f"{BASE_DIR}/items/pickup_battery.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="16" y="18" width="32" height="32" rx="2" fill="#263238" stroke="#546E7A" stroke-width="2"/><rect x="26" y="12" width="12" height="6" fill="#90A4AE"/><polygon points="34,22 24,34 32,34 30,46 40,32 32,32" fill="#00E5FF"/></svg>')

    # Keycard
    img, d, s = create_canvas(64, 64)
    d.rounded_rectangle([12*s, 18*s, 52*s, 46*s], radius=4*s, fill="#1565C0", outline="#42A5F5", width=2*s)
    d.rectangle([16*s, 24*s, 28*s, 36*s], fill="#FFD54F") # Golden microchip
    d.line([(32*s, 26*s), (46*s, 26*s)], fill="#FFFFFF", width=2*s)
    d.line([(32*s, 32*s), (44*s, 32*s)], fill="#FFFFFF", width=2*s)
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/items/pickup_keycard.png")
    with open(f"{BASE_DIR}/items/pickup_keycard.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="18" width="40" height="28" rx="4" fill="#1565C0" stroke="#42A5F5" stroke-width="2"/><rect x="16" y="24" width="12" height="12" rx="2" fill="#FFD54F"/><line x1="32" y1="26" x2="46" y2="26" stroke="#FFFFFF" stroke-width="2"/><line x1="32" y1="32" x2="44" y2="32" stroke="#FFFFFF" stroke-width="2"/></svg>')

# ==========================================
# 5. VFX & HUD ASSETS (64x64 / 128x128)
# ==========================================

def draw_vfx():
    # Reticle Crosshair
    img, d, s = create_canvas(64, 64)
    cx, cy = 32 * s, 32 * s
    d.ellipse([cx - 16*s, cy - 16*s, cx + 16*s, cy + 16*s], outline="#00E5FF", width=2*s)
    d.line([(cx - 24*s, cy), (cx - 10*s, cy)], fill="#00E5FF", width=2*s)
    d.line([(cx + 10*s, cy), (cx + 24*s, cy)], fill="#00E5FF", width=2*s)
    d.line([(cx, cy - 24*s), (cx, cy - 10*s)], fill="#00E5FF", width=2*s)
    d.line([(cx, cy + 10*s), (cx, cy + 24*s)], fill="#00E5FF", width=2*s)
    d.ellipse([cx - 2*s, cy - 2*s, cx + 2*s, cy + 2*s], fill="#FF1744") # Center red laser pip
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/fx/reticle_crosshair.png")
    with open(f"{BASE_DIR}/fx/reticle_crosshair.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="none" stroke="#00E5FF" stroke-width="2"/><line x1="8" y1="32" x2="22" y2="32" stroke="#00E5FF" stroke-width="2"/><line x1="42" y1="32" x2="56" y2="32" stroke="#00E5FF" stroke-width="2"/><line x1="32" y1="8" x2="32" y2="22" stroke="#00E5FF" stroke-width="2"/><line x1="32" y1="42" x2="32" y2="56" stroke="#00E5FF" stroke-width="2"/><circle cx="32" cy="32" r="2" fill="#FF1744"/></svg>')

    # Acoustic Decibel Wave Ripple
    img, d, s = create_canvas(128, 128)
    cx, cy = 64 * s, 64 * s
    d.ellipse([cx - 20*s, cy - 20*s, cx + 20*s, cy + 20*s], outline=(0, 229, 255, 200), width=3*s)
    d.ellipse([cx - 40*s, cy - 40*s, cx + 40*s, cy + 40*s], outline=(0, 229, 255, 120), width=2*s)
    d.ellipse([cx - 58*s, cy - 58*s, cx + 58*s, cy + 58*s], outline=(0, 229, 255, 60), width=1*s)
    sprite = finalize_sprite(img, 128, 128)
    sprite.save(f"{BASE_DIR}/fx/acoustic_ripple.png")
    with open(f"{BASE_DIR}/fx/acoustic_ripple.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="20" fill="none" stroke="#00E5FF" stroke-width="3" stroke-opacity="0.8"/><circle cx="64" cy="64" r="40" fill="none" stroke="#00E5FF" stroke-width="2" stroke-opacity="0.5"/><circle cx="64" cy="64" r="58" fill="none" stroke="#00E5FF" stroke-width="1" stroke-opacity="0.25"/></svg>')

    # Muzzle Flash
    img, d, s = create_canvas(64, 64)
    cx, cy = 32 * s, 32 * s
    # Starburst
    pts = []
    for i in range(16):
        angle = i * (math.pi / 8)
        rad = (26*s if i % 2 == 0 else 8*s)
        pts.append((cx + rad * math.cos(angle), cy + rad * math.sin(angle)))
    d.polygon(pts, fill="#FF6D00")
    # Inner white core
    d.ellipse([cx - 6*s, cy - 6*s, cx + 6*s, cy + 6*s], fill="#FFFFFF")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/fx/muzzle_flash.png")
    with open(f"{BASE_DIR}/fx/muzzle_flash.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><polygon points="58,32 37,34 50,45 35,37 41,50 32,38 23,50 29,37 14,45 27,34 6,32 27,30 14,19 29,27 23,14 32,26 41,14 35,27 50,19 37,30" fill="#FF6D00"/><circle cx="32" cy="32" r="6" fill="#FFFFFF"/></svg>')

    # Blood Splatter Decal
    img, d, s = create_canvas(64, 64)
    cx, cy = 32 * s, 32 * s
    d.ellipse([cx - 18*s, cy - 14*s, cx + 16*s, cy + 18*s], fill="#7F0000")
    d.ellipse([cx - 6*s, cy - 24*s, cx + 8*s, cy - 14*s], fill="#5F0000")
    d.ellipse([cx + 14*s, cy + 8*s, cx + 24*s, cy + 16*s], fill="#880E0E")
    d.ellipse([cx - 24*s, cy + 6*s, cx - 14*s, cy + 14*s], fill="#7F0000")
    sprite = finalize_sprite(img, 64, 64)
    sprite.save(f"{BASE_DIR}/fx/blood_splatter.png")
    with open(f"{BASE_DIR}/fx/blood_splatter.svg", "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="31" cy="34" r="16" fill="#7F0000"/><circle cx="33" cy="13" r="6" fill="#5F0000"/><circle cx="51" cy="44" r="5" fill="#880E0E"/><circle cx="13" cy="42" r="5" fill="#7F0000"/></svg>')

print("Generating Character Sprites...")
draw_player_infiltrator()
draw_player_breacher()
draw_player_downed()

print("Generating Zombie Sprites...")
draw_zombie_lurker(aggro=False)
draw_zombie_lurker(aggro=True)
draw_zombie_audio_stalker()
draw_zombie_bio_carrier()
draw_zombie_armored_brute()

print("Generating Weapon Sprites...")
draw_weapons()
draw_attachments()

print("Generating Item Pickups...")
draw_pickups()

print("Generating VFX & HUD Sprites...")
draw_vfx()

print("ALL ASSETS SUCCESSFULLY GENERATED!")
