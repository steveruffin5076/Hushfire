/** Operative equipment — separate from per-weapon muzzle / rail / ammo attachments. */
export type OperativeGearId = 'none' | 'extra_ammo' | 'extra_battery' | 'nvg' | 'flare_pack' | 'grenade_pouch';

export interface OperativeGearDef {
  id: OperativeGearId;
  name: string;
  description: string;
}

export const OPERATIVE_GEAR_REGISTRY: Record<OperativeGearId, OperativeGearDef> = {
  none: {
    id: 'none',
    name: 'Standard Kit',
    description: 'No extra gear — flashlight and weapons only.'
  },
  extra_ammo: {
    id: 'extra_ammo',
    name: 'Extra Ammo Pouches',
    description: '+1 full magazine to reserve for each gun at deploy.'
  },
  extra_battery: {
    id: 'extra_battery',
    name: 'Spare Battery Cell',
    description: '+50 weapon flashlight charge at deploy (does not charge NVG).'
  },
  nvg: {
    id: 'nvg',
    name: 'Night Vision Goggles',
    description: 'Toggle green NVG in-mission — uses its own battery, separate from your flashlight.'
  },
  flare_pack: {
    id: 'flare_pack',
    name: 'Flare Pack',
    description: 'Legacy loadout tag — use Grenade Pouch for throwable flares in-mission.'
  },
  grenade_pouch: {
    id: 'grenade_pouch',
    name: 'Grenade Pouch',
    description: 'HE ×1, Incendiary ×1, Flashbang ×2, Flare ×2 — throw with [G] toward your aim (max range).'
  }
};

export const OPERATIVE_GEAR_ORDER: OperativeGearId[] = [
  'none',
  'extra_ammo',
  'extra_battery',
  'nvg',
  'flare_pack',
  'grenade_pouch'
];
