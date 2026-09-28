import { KeyValueStorage } from './LoadoutStorage';

const STORAGE_KEY = 'hushfire.settings.v1';

export interface GameSettings {
  masterVolume: number;
  /** Multiplier on mouse aim delta (1 = default). */
  mouseSensitivity: number;
  pauseOnBlur: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.6,
  mouseSensitivity: 1,
  pauseOnBlur: true
};

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadGameSettings(storage: KeyValueStorage | null = defaultStorage()): GameSettings {
  const base = { ...DEFAULT_SETTINGS };
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return base;
    const o = parsed as Partial<GameSettings>;
    if (typeof o.masterVolume === 'number') base.masterVolume = Math.min(1, Math.max(0, o.masterVolume));
    if (typeof o.mouseSensitivity === 'number') base.mouseSensitivity = Math.min(2.5, Math.max(0.25, o.mouseSensitivity));
    if (typeof o.pauseOnBlur === 'boolean') base.pauseOnBlur = o.pauseOnBlur;
  } catch {
    // ignore
  }
  return base;
}

export function saveGameSettings(settings: GameSettings, storage: KeyValueStorage | null = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
