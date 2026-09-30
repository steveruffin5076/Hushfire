import type { Player } from '../../entities/Player';

/** Baked sheet folders under `player_infiltrator/loadouts/`. */
export type OperativeWeaponLoadoutId = 'knife' | 'pistol' | 'rifle';

const PISTOL_SECONDARIES = new Set(['glock17']);

/** Maps active weapon slot + id to infiltrator loadout art (Operative 1 only). */
export function operativeLoadoutForPlayer(player: Player): OperativeWeaponLoadoutId {
  if (player.playerNumber !== 1) return 'rifle';
  if (player.activeSlot === 'melee') return 'knife';
  if (player.activeSlot === 'secondary') return 'pistol';
  if (PISTOL_SECONDARIES.has(player.activeWeaponId)) return 'pistol';
  return 'rifle';
}
