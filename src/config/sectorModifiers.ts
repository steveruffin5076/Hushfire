/** Per-run twist picked in the armory — `none` is the default vanilla run. */
export type SectorModifierId = 'none' | 'blackout' | 'scavenger' | 'hush' | 'heavy';

export interface SectorModifierDef {
  id: SectorModifierId;
  name: string;
  /** One line shown in the armory and under the sector name in the HUD. */
  blurb: string;
}

export const SECTOR_MODIFIERS: Record<SectorModifierId, SectorModifierDef> = {
  none: {
    id: 'none',
    name: 'NONE',
    blurb: 'Standard operation — no extra twist this run'
  },
  blackout: {
    id: 'blackout',
    name: 'BLACKOUT',
    blurb: '50% battery at deploy — no battery pickups this run'
  },
  scavenger: {
    id: 'scavenger',
    name: 'SCAVENGER',
    blurb: 'Half the supplies are stripped — objectives always remain'
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

/** Armory dropdown order (`none` first = default). */
export const SECTOR_MODIFIER_ORDER: readonly SectorModifierId[] = ['none', 'blackout', 'scavenger', 'hush', 'heavy'];

/** Random/daily twists — never rolls `none`. */
export const RANDOM_SECTOR_MODIFIER_ORDER: readonly SectorModifierId[] = SECTOR_MODIFIER_ORDER.filter(id => id !== 'none');

export function pickSectorModifier(rand: () => number = Math.random): SectorModifierId {
  const order = RANDOM_SECTOR_MODIFIER_ORDER;
  const i = Math.floor(rand() * order.length);
  return order[Math.min(i, order.length - 1)];
}

export function getSectorModifier(id: SectorModifierId): SectorModifierDef {
  return SECTOR_MODIFIERS[id];
}

/**
 * Pickup types a run cannot be completed without. The Sector 1 keycard opens the
 * blast door, so stripping it makes the run unwinnable — any "remove pickups"
 * modifier must leave these alone (see filterPickupsForModifier).
 */
const OBJECTIVE_CRITICAL_PICKUPS: ReadonlySet<string> = new Set(['keycard']);

/** Sector pickup list after a run modifier is applied. */
export function filterPickupsForModifier<T extends { type: string }>(pickups: T[], modifier: SectorModifierId): T[] {
  if (modifier === 'none') return pickups;
  let list = pickups;
  if (modifier === 'blackout') list = list.filter(p => p.type !== 'battery');
  if (modifier === 'scavenger') {
    // Halve the optional supplies, but never the objective-critical ones: the
    // keycard sits at a fixed index in the authored pickup list, so an
    // every-other-entry strip deleted it every single run and soft-locked
    // Sector 1 (25% of armory rolls, since the modifier is picked at random).
    let optionalIndex = 0;
    list = list.filter(p => {
      if (OBJECTIVE_CRITICAL_PICKUPS.has(p.type)) return true;
      const keep = optionalIndex % 2 === 0;
      optionalIndex++;
      return keep;
    });
  }
  return list;
}
