import type { PlayerInputState } from '../core/Input';
import type { SectorModifierId } from '../config/sectorModifiers';
import type { WeaponLoadout } from '../entities/Player';
import type { ZombieArchetype } from '../entities/Zombie';
import type { ZombieState } from '../config/zombies';
import type { PickupType } from '../entities/Pickup';
import type { SectorReward } from '../ui/SectorRewardMenu';

/** Guest → host input at 60 Hz. Slot is always 2 (guest operative on the host sim). */
export interface NetInputMessage {
  t: 'input';
  seq: number;
  moveX: number;
  moveY: number;
  aimAngle: number;
  isFiring: boolean;
  isSprinting: boolean;
  isSneaking: boolean;
  isReloading: boolean;
  isInteracting: boolean;
  isSwitchingWeapon: boolean;
  selectPrimary: boolean;
  selectSecondary: boolean;
  selectMelee: boolean;
  isMeleeAttack: boolean;
  isTogglingFlashlight: boolean;
  isTogglingNvg: boolean;
}

export interface NetPlayerSnap {
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  eliminated: boolean;
  activeWeaponId: string;
  activeSlot: 'primary' | 'secondary' | 'melee';
  mag: number;
  reserve: number;
  reloading: boolean;
  flashlightOn: boolean;
  battery: number;
  hasKeycard: boolean;
  nvgOn: boolean;
  nvgBattery: number;
}

export interface NetZombieSnap {
  id: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  archetype: ZombieArchetype;
  state: ZombieState;
}

export interface NetPickupSnap {
  x: number;
  y: number;
  type: PickupType;
}

export interface NetProjectileSnap {
  x: number;
  y: number;
  angle: number;
  stuck: boolean;
  ownerId: number;
}

export interface NetEvacSnap {
  active: boolean;
  occupied: boolean;
  holdoutTimer: number;
  complete: boolean;
}

/** Host → guest world state at ~30 Hz. */
export interface NetSnapshotMessage {
  t: 'snapshot';
  tick: number;
  missionTime: number;
  sectorIndex: number;
  objectiveProgress: number;
  objectiveComplete: boolean;
  evac: NetEvacSnap | null;
  p1: NetPlayerSnap;
  p2: NetPlayerSnap;
  zombies: NetZombieSnap[];
  pickups: NetPickupSnap[];
  projectiles: NetProjectileSnap[];
  paused: boolean;
  missionOver?: { victory: boolean };
}

export function inputToNet(seq: number, input: PlayerInputState): NetInputMessage {
  return {
    t: 'input',
    seq,
    moveX: input.moveX,
    moveY: input.moveY,
    aimAngle: input.aimAngle,
    isFiring: input.isFiring,
    isSprinting: input.isSprinting,
    isSneaking: input.isSneaking,
    isReloading: input.isReloading,
    isInteracting: input.isInteracting,
    isSwitchingWeapon: input.isSwitchingWeapon,
    selectPrimary: input.selectPrimary,
    selectSecondary: input.selectSecondary,
    selectMelee: input.selectMelee,
    isMeleeAttack: input.isMeleeAttack,
    isTogglingFlashlight: input.isTogglingFlashlight,
    isTogglingNvg: input.isTogglingNvg
  };
}

export function netToInput(msg: NetInputMessage): PlayerInputState {
  return {
    moveX: msg.moveX,
    moveY: msg.moveY,
    aimAngle: msg.aimAngle,
    isFiring: msg.isFiring,
    isSprinting: msg.isSprinting,
    isSneaking: msg.isSneaking,
    isReloading: msg.isReloading,
    isInteracting: msg.isInteracting,
    isSwitchingWeapon: msg.isSwitchingWeapon,
    selectPrimary: msg.selectPrimary,
    selectSecondary: msg.selectSecondary,
    selectMelee: msg.selectMelee,
    isMeleeAttack: msg.isMeleeAttack,
    isTogglingFlashlight: msg.isTogglingFlashlight,
    isTogglingNvg: msg.isTogglingNvg
  };
}

export type NetMessage =
  | { t: 'hello'; code: string; proto: number }
  | { t: 'loadout'; loadout: WeaponLoadout; ready: boolean }
  | { t: 'deploy'; seed: number; runModifier: SectorModifierId; hostLoadout: WeaponLoadout; guestLoadout: WeaponLoadout }
  | { t: 'sector_reward_open'; sectorName: string; nextSectorName: string }
  | { t: 'sector_reward_pick'; reward: SectorReward }
  | { t: 'bye' }
  | NetInputMessage
  | NetSnapshotMessage;

export const PROTO_VERSION = 5;
