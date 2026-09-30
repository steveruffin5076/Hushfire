import type { CharacterAnimId, MultiClipSheetMeta, SimpleClipSheetMeta, WalkSheetMeta } from './sheetTypes';
import type { CharacterSheetSet, OperativeLoadoutPack } from './CharacterAnimController';
import { CharacterAnimController } from './CharacterAnimController';
import type { OperativeWeaponLoadoutId } from './operativeLoadout';

const CHARACTERS: CharacterAnimId[] = [
  'player_infiltrator',
  'player_breacher',
  'zombie_lurker',
  'zombie_lurker_aggro',
  'zombie_audio_stalker',
  'zombie_bio_carrier',
  'zombie_armored_brute'
];

const PLAYER_CHARS: CharacterAnimId[] = ['player_infiltrator', 'player_breacher'];
const ZOMBIE_ATTACK_CHARS: CharacterAnimId[] = [
  'zombie_lurker',
  'zombie_lurker_aggro',
  'zombie_audio_stalker',
  'zombie_bio_carrier',
  'zombie_armored_brute'
];

const OPERATIVE_LOADOUTS: OperativeWeaponLoadoutId[] = ['knife', 'pistol', 'rifle'];

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json() as Promise<T>;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${url}`));
    img.src = url;
  });
}

async function loadSheetPair<T extends { image: string }>(
  base: string,
  name: string
): Promise<{ image: HTMLImageElement; meta: T } | null> {
  try {
    const meta = await loadJson<T>(`${base}/${name}.json`);
    const image = await loadImage(`${base}/${meta.image}`);
    return { image, meta };
  } catch {
    return null;
  }
}

async function loadOperativeLoadoutPack(
  base: string,
  loadout: OperativeWeaponLoadoutId
): Promise<OperativeLoadoutPack | null> {
  const lb = `${base}/loadouts/${loadout}`;
  const walk = await loadSheetPair<WalkSheetMeta>(lb, 'walk_sheet');
  if (!walk) return null;

  const pack: OperativeLoadoutPack = { walk };
  const idle = await loadSheetPair<SimpleClipSheetMeta>(lb, 'idle_sheet');
  const recoil = await loadSheetPair<SimpleClipSheetMeta>(lb, 'recoil_sheet');
  const attack = await loadSheetPair<SimpleClipSheetMeta>(lb, 'attack_sheet');
  const hit = await loadSheetPair<SimpleClipSheetMeta>(lb, 'hit_sheet');
  if (idle) pack.idle = idle;
  if (recoil) pack.recoil = recoil;
  if (attack) pack.attack = attack;
  if (hit) pack.hit = hit;
  return pack;
}

function mergeLoadoutIntoSet(
  pack: OperativeLoadoutPack,
  shared: { downed?: CharacterSheetSet['downed']; hit?: CharacterSheetSet['hit'] }
): CharacterSheetSet {
  return {
    walk: pack.walk,
    idle: pack.idle,
    downed: shared.downed,
    recoil: pack.recoil,
    hit: pack.hit ?? shared.hit,
    attack: pack.attack
  };
}

/** Loads baked animation sheets from public/assets/animations/<character>/. */
export class AnimationCatalog {
  private sets = new Map<CharacterAnimId, CharacterSheetSet>();
  private infiltratorLoadouts = new Map<OperativeWeaponLoadoutId, OperativeLoadoutPack>();
  private infiltratorSharedHit?: CharacterSheetSet['hit'];
  private infiltratorKnifeAttack?: CharacterSheetSet['attack'];
  private infiltratorLoadoutApplied = new WeakMap<CharacterAnimController, OperativeWeaponLoadoutId>();
  ready = false;

  async loadAll(): Promise<void> {
    const baseUrl = `${import.meta.env.BASE_URL}assets/animations`;
    for (const id of CHARACTERS) {
      const base = `${baseUrl}/${id}`;

      if (id === 'player_infiltrator') {
        const pistolProbe = await loadSheetPair<WalkSheetMeta>(
          `${base}/loadouts/pistol`,
          'walk_sheet'
        );
        if (pistolProbe) {
          await this.loadInfiltratorLoadouts(base);
          continue;
        }
      }

      const walk = await loadSheetPair<WalkSheetMeta>(base, 'walk_sheet');
      if (!walk) continue;

      const set: CharacterSheetSet = { walk };
      const downed = await loadSheetPair<MultiClipSheetMeta>(base, 'downed_sheet');
      if (downed) set.downed = downed;

      if (PLAYER_CHARS.includes(id)) {
        const recoil = await loadSheetPair<SimpleClipSheetMeta>(base, 'recoil_sheet');
        const hit = await loadSheetPair<SimpleClipSheetMeta>(base, 'hit_sheet');
        const attack = await loadSheetPair<SimpleClipSheetMeta>(base, 'attack_sheet');
        if (recoil) set.recoil = recoil;
        if (hit) set.hit = hit;
        if (attack) set.attack = attack;
      }
      if (ZOMBIE_ATTACK_CHARS.includes(id)) {
        const attack = await loadSheetPair<MultiClipSheetMeta>(base, 'attack_sheet');
        if (attack) set.attack = attack;
      }
      this.sets.set(id, set);
    }
    this.ready = this.sets.size > 0;
  }

  private async loadInfiltratorLoadouts(base: string) {
    const downed = await loadSheetPair<MultiClipSheetMeta>(base, 'downed_sheet');
    const sharedHit = await loadSheetPair<SimpleClipSheetMeta>(base, 'hit_sheet');
    this.infiltratorSharedHit = sharedHit ?? undefined;

    for (const loadout of OPERATIVE_LOADOUTS) {
      const pack = await loadOperativeLoadoutPack(base, loadout);
      if (pack) this.infiltratorLoadouts.set(loadout, pack);
    }

    const knife = this.infiltratorLoadouts.get('knife');
    this.infiltratorKnifeAttack = knife?.attack;

    const defaultPack =
      this.infiltratorLoadouts.get('pistol') ?? this.infiltratorLoadouts.get('rifle');
    if (!defaultPack) return;

    const set = mergeLoadoutIntoSet(defaultPack, {
      downed: downed ?? undefined,
      hit: sharedHit ?? undefined
    });
    this.sets.set('player_infiltrator', set);
  }

  has(id: CharacterAnimId): boolean {
    return this.sets.has(id);
  }

  createController(id: CharacterAnimId): CharacterAnimController | null {
    const set = this.sets.get(id);
    if (!set) return null;
    const ctrl = new CharacterAnimController({ ...set });
    if (id === 'player_infiltrator' && this.infiltratorKnifeAttack) {
      ctrl.setQuickMeleeAttack(this.infiltratorKnifeAttack);
    }
    return ctrl;
  }

  /** Operative 1: swap baked sheets when primary / secondary / melee changes. */
  syncInfiltratorLoadout(
    ctrl: CharacterAnimController,
    loadout: OperativeWeaponLoadoutId,
    opts?: { force?: boolean }
  ) {
    if (!opts?.force && this.infiltratorLoadoutApplied.get(ctrl) === loadout) return;
    const pack = this.infiltratorLoadouts.get(loadout);
    if (!pack) return;
    ctrl.applyOperativeLoadout(pack, this.infiltratorSharedHit, this.infiltratorKnifeAttack);
    this.infiltratorLoadoutApplied.set(ctrl, loadout);
  }

  characterHasAttack(id: CharacterAnimId): boolean {
    if (id === 'player_infiltrator') {
      return !!this.infiltratorKnifeAttack || !!this.sets.get(id)?.attack;
    }
    return !!this.sets.get(id)?.attack;
  }
}

export function playerAnimId(playerNumber: 1 | 2): CharacterAnimId {
  return playerNumber === 1 ? 'player_infiltrator' : 'player_breacher';
}

export function zombieAnimId(archetype: string, aggroLurker: boolean): CharacterAnimId {
  if (archetype === 'lurker' && aggroLurker) return 'zombie_lurker_aggro';
  if (archetype === 'audio_stalker') return 'zombie_audio_stalker';
  if (archetype === 'bio_carrier') return 'zombie_bio_carrier';
  if (archetype === 'armored_brute') return 'zombie_armored_brute';
  return 'zombie_lurker';
}
