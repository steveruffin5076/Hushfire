/** Operative equipment — separate from per-weapon muzzle / rail / ammo attachments. */
export type OperativeGearId = 'none' | 'nvg' | 'flare_pack';

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

export const OPERATIVE_GEAR_ORDER: OperativeGearId[] = ['none', 'nvg', 'flare_pack'];
