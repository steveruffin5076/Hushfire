import { Point, Segment } from '../lighting/Raycaster';
import { ZombieArchetype } from '../entities/Zombie';
import { PickupType } from '../entities/Pickup';
import { AssetKey } from '../core/AssetLoader';

export type ObjectiveKind = 'keycard_door' | 'lockdown_terminal' | 'evac_radio';

export interface BoxDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZombieSpawnDef {
  x: number;
  y: number;
  angle: number;
  archetype: ZombieArchetype;
}

export interface PickupDef {
  x: number;
  y: number;
  type: PickupType;
}

export interface ObjectiveDef {
  kind: ObjectiveKind;
  x: number;
  y: number;
  radius: number;
  label: string;
  /** Seconds of held interaction required. 0 = instant. */
  holdSec: number;
}

export interface SectorDef {
  id: number;
  name: string;
  briefing: string;
  /** Drawn stretched across the full play field in place of the flat grid floor when present. */
  backgroundKey?: AssetKey;
  boxes: BoxDef[];
  /** Walls removed once the sector objective completes (blast doors, shutters). */
  doorWalls: Segment[];
  playerSpawns: [Point, Point];
  zombies: ZombieSpawnDef[];
  pickups: PickupDef[];
  objective: ObjectiveDef;
  /** Walk here after the objective to advance. Absent on the final sector. */
  exitZone?: { x: number; y: number; radius: number };
  /** Final sector only: the chopper pad players must hold and board. */
  evacZone?: { x: number; y: number; radius: number; holdoutSec: number };
}

const SECTOR_1: SectorDef = {
  id: 1,
  name: 'SECTOR 1 — TRANSIT',
  backgroundKey: 'sector1_bg',
  briefing: 'Find the keycard, override the blast door',
  // Aligned to sector1_bg.jpg: the platform's equipment/trench row (~x310-395),
  // the rusty mesh divider between the two rail tracks (~x810-855), and the
  // support column on the platform's far right (~x1045-1090). The old wall at
  // x560-600 sat in open rail gravel with nothing drawn there, so it's dropped
  // rather than repositioned onto empty floor.
  boxes: [
    { x1: 310, y1: 20, x2: 395, y2: 260 },
    { x1: 310, y1: 440, x2: 395, y2: 700 },
    { x1: 810, y1: 60, x2: 855, y2: 380 },
    { x1: 810, y1: 480, x2: 855, y2: 700 },
    { x1: 1045, y1: 20, x2: 1090, y2: 280 },
    { x1: 1045, y1: 440, x2: 1090, y2: 700 }
  ],
  doorWalls: [
    { p1: { x: 1067, y: 280 }, p2: { x: 1067, y: 440 } }
  ],
  playerSpawns: [
    { x: 140, y: 340 },
    { x: 110, y: 400 }
  ],
  zombies: [
    { x: 420, y: 120, angle: Math.PI / 2, archetype: 'lurker' },
    { x: 450, y: 580, angle: -Math.PI / 2, archetype: 'lurker' },
    { x: 700, y: 360, angle: Math.PI, archetype: 'audio_stalker' },
    { x: 920, y: 240, angle: 0, archetype: 'bio_carrier' },
    { x: 960, y: 520, angle: Math.PI, archetype: 'armored_brute' }
  ],
  pickups: [
    { x: 220, y: 250, type: 'ammo' },
    { x: 430, y: 620, type: 'medkit' },
    { x: 680, y: 360, type: 'battery' },
    { x: 920, y: 620, type: 'keycard' },
    { x: 950, y: 160, type: 'ammo' }
  ],
  objective: { kind: 'keycard_door', x: 1030, y: 360, radius: 44, label: 'BLAST DOOR PANEL', holdSec: 0 },
  exitZone: { x: 1180, y: 360, radius: 60 }
};

const SECTOR_2: SectorDef = {
  id: 2,
  name: 'SECTOR 2 — BIO-LAB',
  backgroundKey: 'sector2_bg',
  briefing: 'Disable the lockdown sequence at the lab terminal',
  // sector2_bg.jpg is one open quarantine room — the only solid objects drawn
  // in it are two floor grates. The previous 8 chokepoint walls had no visual
  // counterpart at all (they floated over open tile), so they're replaced with
  // just these two, matching the grates' actual footprint.
  boxes: [
    { x1: 280, y1: 295, x2: 405, y2: 390 },
    { x1: 880, y1: 295, x2: 1005, y2: 390 }
  ],
  doorWalls: [
    { p1: { x: 1032, y: 300 }, p2: { x: 1032, y: 460 } }
  ],
  playerSpawns: [
    { x: 110, y: 340 },
    { x: 110, y: 410 }
  ],
  zombies: [
    { x: 320, y: 120, angle: Math.PI / 2, archetype: 'bio_carrier' },
    { x: 330, y: 600, angle: -Math.PI / 2, archetype: 'lurker' },
    { x: 530, y: 100, angle: Math.PI, archetype: 'audio_stalker' },
    { x: 540, y: 640, angle: Math.PI, archetype: 'bio_carrier' },
    { x: 740, y: 320, angle: Math.PI, archetype: 'armored_brute' },
    { x: 760, y: 600, angle: 0, archetype: 'lurker' },
    { x: 950, y: 460, angle: Math.PI, archetype: 'audio_stalker' }
  ],
  pickups: [
    { x: 300, y: 460, type: 'ammo' },
    { x: 520, y: 380, type: 'medkit' },
    { x: 720, y: 120, type: 'battery' },
    { x: 940, y: 620, type: 'ammo' },
    { x: 960, y: 140, type: 'medkit' }
  ],
  objective: { kind: 'lockdown_terminal', x: 940, y: 240, radius: 44, label: 'LOCKDOWN TERMINAL', holdSec: 3.5 },
  exitZone: { x: 1170, y: 380, radius: 60 }
};

const SECTOR_3: SectorDef = {
  id: 3,
  name: 'SECTOR 3 — HELIPAD',
  backgroundKey: 'sector3_bg',
  briefing: 'Call evac on the radio, then hold the pad until the chopper lands',
  // Nudged onto sector3_bg.jpg's actual rooftop equipment: the corridor
  // railing posts on the left (~x250-320), the walkway railing segments along
  // the top/bottom edge (~x500-580), the satellite dish housing on the right
  // (~x1075-1145), and the AC/vent unit cluster below it (~x990-1075).
  boxes: [
    { x1: 250, y1: 130, x2: 320, y2: 210 },
    { x1: 250, y1: 510, x2: 320, y2: 590 },
    { x1: 500, y1: 70, x2: 580, y2: 150 },
    { x1: 500, y1: 570, x2: 580, y2: 650 },
    { x1: 1075, y1: 195, x2: 1145, y2: 265 },
    { x1: 990, y1: 460, x2: 1075, y2: 545 }
  ],
  doorWalls: [],
  playerSpawns: [
    { x: 120, y: 340 },
    { x: 120, y: 410 }
  ],
  zombies: [
    { x: 420, y: 200, angle: Math.PI / 2, archetype: 'lurker' },
    { x: 440, y: 520, angle: -Math.PI / 2, archetype: 'lurker' },
    { x: 700, y: 180, angle: Math.PI, archetype: 'audio_stalker' },
    { x: 720, y: 540, angle: Math.PI, archetype: 'bio_carrier' },
    { x: 1000, y: 360, angle: Math.PI, archetype: 'armored_brute' },
    { x: 860, y: 620, angle: Math.PI, archetype: 'lurker' }
  ],
  pickups: [
    { x: 240, y: 360, type: 'ammo' },
    { x: 620, y: 360, type: 'medkit' },
    { x: 820, y: 200, type: 'ammo' },
    { x: 820, y: 520, type: 'battery' },
    { x: 960, y: 620, type: 'medkit' }
  ],
  objective: { kind: 'evac_radio', x: 300, y: 360, radius: 44, label: 'EMERGENCY RADIO', holdSec: 2.5 },
  evacZone: { x: 900, y: 360, radius: 90, holdoutSec: 120 }
};

export const SECTORS: SectorDef[] = [SECTOR_1, SECTOR_2, SECTOR_3];
