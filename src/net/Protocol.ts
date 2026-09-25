import type { WeaponLoadout } from '../entities/Player';

/** Lobby + deploy wire format (Phase 7). Gameplay INPUT/SNAPSHOT messages land in a later milestone. */
export type NetMessage =
  | { t: 'hello'; code: string; proto: number }
  | { t: 'loadout'; loadout: WeaponLoadout; ready: boolean }
  | { t: 'deploy'; seed: number; hostLoadout: WeaponLoadout; guestLoadout: WeaponLoadout }
  | { t: 'bye' };

export const PROTO_VERSION = 1;
