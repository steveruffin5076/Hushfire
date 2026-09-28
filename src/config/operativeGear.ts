/** Operative equipment — separate from per-weapon muzzle / rail / ammo attachments. */
export type OperativeGearId = 'none' | 'extra_ammo' | 'extra_battery' | 'nvg' | 'flare_pack';

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
    description: '+50 flashlight charge at deploy.'
  },
  nvg: {
    id: 'nvg',
    name: 'Night Vision Goggles',
    description: 'Toggle green NVG in-mission (reduced dependence on weapon lights).'
  },
  flare_pack: {
    id: 'flare_pack',
    name: 'Flare Pack',
    description: 'Limited throwable flares — bright area light and loud noise.'
  }
};

export const OPERATIVE_GEAR_ORDER: OperativeGearId[] = ['none', 'extra_ammo', 'extra_battery', 'nvg', 'flare_pack'];
