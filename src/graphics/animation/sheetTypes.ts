/** Sidecar JSON shapes from topdown_animation_pack (baked sheets). */

export interface PivotPx {
  torso?: [number, number];
  grip?: [number, number];
}

export interface WalkSheetMeta {
  image: string;
  frame_width: number;
  frame_height: number;
  frames: number;
  layout: 'row';
  stride_steps?: number;
  footfall_frames?: number[];
  pivots_cell_px: { torso: [number, number]; grip?: [number, number]; part?: [number, number] };
  steps_per_s?: number;
}

export interface ClipDef {
  name: string;
  row?: number;
  frames: number;
  frame_ms: number | number[];
  loop: boolean;
  events?: Record<string, number>;
}

export interface MultiClipSheetMeta {
  image: string;
  cell_width: number;
  cell_height: number;
  layout: 'row' | 'rows';
  clips: ClipDef[];
  pivot_cell_px: [number, number];
}

export interface SimpleClipSheetMeta {
  image: string;
  frame_width: number;
  frame_height: number;
  layout: 'row';
  clips: ClipDef[];
  pivots_cell_px?: { torso: [number, number] };
  pivot_cell_px?: [number, number];
}

export type CharacterAnimId =
  | 'player_infiltrator'
  | 'player_breacher'
  | 'zombie_lurker'
  | 'zombie_lurker_aggro'
  | 'zombie_audio_stalker'
  | 'zombie_bio_carrier'
  | 'zombie_armored_brute';
