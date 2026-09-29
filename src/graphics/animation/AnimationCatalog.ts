import type { CharacterAnimId, MultiClipSheetMeta, SimpleClipSheetMeta, WalkSheetMeta } from './sheetTypes';
import type { CharacterSheetSet } from './CharacterAnimController';
import { CharacterAnimController } from './CharacterAnimController';

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

/** Loads baked animation sheets from public/assets/animations/<character>/. */
export class AnimationCatalog {
  private sets = new Map<CharacterAnimId, CharacterSheetSet>();
  ready = false;

  async loadAll(): Promise<void> {
    const baseUrl = `${import.meta.env.BASE_URL}assets/animations`;
    for (const id of CHARACTERS) {
      const base = `${baseUrl}/${id}`;
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

  has(id: CharacterAnimId): boolean {
    return this.sets.has(id);
  }

  createController(id: CharacterAnimId): CharacterAnimController | null {
    const set = this.sets.get(id);
    return set ? new CharacterAnimController(set) : null;
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
