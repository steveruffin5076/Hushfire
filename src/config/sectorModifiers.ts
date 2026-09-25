/** Per-run twist picked in the armory — reuses existing systems (see progress.md §7). */
export type SectorModifierId = 'blackout' | 'scavenger' | 'hush' | 'heavy';

export interface SectorModifierDef {
  id: SectorModifierId;
  name: string;
  /** One line shown in the armory and under the sector name in the HUD. */
  blurb: string;
}

export const SECTOR_MODIFIERS: Record<SectorModifierId, SectorModifierDef> = {
  blackout: {
    id: 'blackout',
    name: 'BLACKOUT',
    blurb: '50% battery at deploy — no battery pickups this run'
  },
  scavenger: {
    id: 'scavenger',
    name: 'SCAVENGER',
    blurb: 'Half the sector pickups are stripped from each map'
  },
  hush: {
    id: 'hush',
    name: 'HUSH',
    blurb: 'Loud gunfire calls reinforcements twice as fast'
  },
  heavy: {
    id: 'heavy',
    name: 'HEAVY',
    blurb: 'Each sector spawns with an extra armored brute'
  }
};

export const SECTOR_MODIFIER_ORDER: readonly SectorModifierId[] = ['blackout', 'scavenger', 'hush', 'heavy'];

export function pickSectorModifier(rand: () => number = Math.random): SectorModifierId {
  const i = Math.floor(rand() * SECTOR_MODIFIER_ORDER.length);
  return SECTOR_MODIFIER_ORDER[Math.min(i, SECTOR_MODIFIER_ORDER.length - 1)];
}

export function getSectorModifier(id: SectorModifierId): SectorModifierDef {
  return SECTOR_MODIFIERS[id];
}

/** Sector pickup list after a run modifier is applied. */
export function filterPickupsForModifier<T extends { type: string }>(pickups: T[], modifier: SectorModifierId): T[] {
  let list = pickups;
  if (modifier === 'blackout') list = list.filter(p => p.type !== 'battery');
  if (modifier === 'scavenger') list = list.filter((_, i) => i % 2 === 0);
  return list;
}
