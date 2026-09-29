/** Operative equipment — separate from per-weapon muzzle / rail / ammo attachments. */
export type OperativeGearId =
  | 'none'
  | 'extra_ammo'
  | 'extra_battery'
  | 'nvg'
  | 'flare_pack'
  | 'extra_grenade_pouches';

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
    description: 'Legacy loadout tag — configure flares under Grenade Pouch in the loadout tab.'
  },
  extra_grenade_pouches: {
    id: 'extra_grenade_pouches',
    name: 'Extra Grenade Pouches',
    description: '+1 HE grenade at deploy when HE is enabled in your Grenade Pouch loadout.'
  }
};

export const OPERATIVE_GEAR_ORDER: OperativeGearId[] = [
  'none',
  'extra_ammo',
  'extra_battery',
  'nvg',
  'flare_pack',
  'extra_grenade_pouches'
];
