import { Point, Segment } from '../lighting/Raycaster';
import { ZombieArchetype } from '../entities/Zombie';
import { PickupType } from '../entities/Pickup';

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
  briefing: 'Find the keycard, override the blast door',
  boxes: [
    { x1: 300, y1: 20, x2: 340, y2: 260 },
    { x1: 300, y1: 440, x2: 340, y2: 700 },
    { x1: 560, y1: 200, x2: 600, y2: 520 },
    { x1: 800, y1: 100, x2: 840, y2: 380 },
    { x1: 800, y1: 480, x2: 840, y2: 700 },
    { x1: 1060, y1: 20, x2: 1080, y2: 280 },
    { x1: 1060, y1: 440, x2: 1080, y2: 700 }
  ],
  doorWalls: [
    { p1: { x: 1070, y: 280 }, p2: { x: 1070, y: 440 } }
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
  briefing: 'Disable the lockdown sequence at the lab terminal',
  boxes: [
    { x1: 200, y1: 20, x2: 224, y2: 300 },
    { x1: 200, y1: 420, x2: 224, y2: 700 },
    { x1: 420, y1: 160, x2: 444, y2: 560 },
    { x1: 620, y1: 20, x2: 644, y2: 240 },
    { x1: 620, y1: 380, x2: 644, y2: 700 },
    { x1: 840, y1: 180, x2: 864, y2: 540 },
    { x1: 1020, y1: 20, x2: 1044, y2: 300 },
    { x1: 1020, y1: 460, x2: 1044, y2: 700 }
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
    { x: 950, y: 380, angle: Math.PI, archetype: 'audio_stalker' }
  ],
  pickups: [
    { x: 300, y: 380, type: 'ammo' },
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
  briefing: 'Call evac on the radio, then hold the pad until the chopper lands',
  boxes: [
    { x1: 260, y1: 140, x2: 340, y2: 220 },
    { x1: 260, y1: 500, x2: 340, y2: 580 },
    { x1: 520, y1: 80, x2: 600, y2: 160 },
    { x1: 520, y1: 560, x2: 600, y2: 640 },
    { x1: 1060, y1: 200, x2: 1140, y2: 280 },
    { x1: 1060, y1: 440, x2: 1140, y2: 520 }
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
