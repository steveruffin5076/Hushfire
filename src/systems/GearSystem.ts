import { Player } from '../entities/Player';
import { RadialLight } from '../lighting/ShadowRenderer';

/** Soft NVG visibility bubble — wider than a weapon light, no wall raycast. */
export const NVG_LIGHT_RADIUS_PX = 340;

export function nvgLightsForPlayers(players: Player[]): RadialLight[] {
  const out: RadialLight[] = [];
  for (const p of players) {
    if (p.isEliminated || p.isDowned || p.operativeGear !== 'nvg' || !p.nvgOn) continue;
    out.push({ origin: { x: p.x, y: p.y }, radius: NVG_LIGHT_RADIUS_PX });
  }
  return out;
}
