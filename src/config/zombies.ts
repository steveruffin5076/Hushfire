export type ZombieState = 'DORMANT' | 'SUSPICIOUS' | 'ENRAGED';

export interface ZombieDef {
  id: string;
  name: string;
  maxHealth: number;
  walkSpeed: number;
  sprintSpeed: number;
  lightAwarenessTimeSec: number;
  isBlindToLight?: boolean;
  isArmoredFront?: boolean;
}

// Difficulty-tuned down (~20-25% less health/speed, ~40-50% more reaction
// time before spotting) so a lone operative has a fair chance without a
// second gun covering them.
export const ZOMBIE_REGISTRY: Record<string, ZombieDef> = {
  lurker: {
    id: 'lurker',
    name: 'Sleeping Lurker',
    maxHealth: 40,
    walkSpeed: 38,
    sprintSpeed: 115,
    lightAwarenessTimeSec: 1.8
  },
  audio_stalker: {
    id: 'audio_stalker',
    name: 'Audio-Stalker (Blind)',
    maxHealth: 60,
    walkSpeed: 58,
    sprintSpeed: 170,
    lightAwarenessTimeSec: 9999, // Immune to flashlight vision
    isBlindToLight: true
  },
  bio_carrier: {
    id: 'bio_carrier',
    name: 'Bio-Carrier',
    maxHealth: 48,
    walkSpeed: 42,
    sprintSpeed: 100,
    lightAwarenessTimeSec: 2.1
  },
  armored_brute: {
    id: 'armored_brute',
    name: 'Armored Sentry Brute',
    maxHealth: 170,
    walkSpeed: 30,
    sprintSpeed: 85,
    lightAwarenessTimeSec: 1.5,
    isArmoredFront: true
  }
};
