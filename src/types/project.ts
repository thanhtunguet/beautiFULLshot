// Project file types — matches .bshot project.json schema

import type { Annotation } from './annotations';

// Background types match background-store.ts
export type BackgroundType = 'gradient' | 'solid' | 'transparent' | 'wallpaper' | 'image' | 'auto';

export interface GradientMeta {
  id: string;
  name: string;
  colors: string[];
}

export interface WallpaperMeta {
  id: string;
  src: string;       // file path reference (not embedded)
  thumbnail: string;
}

export interface BackgroundMeta {
  type: BackgroundType;
  gradient: GradientMeta | null;
  solidColor: string | null;
  wallpaper: WallpaperMeta | null;
  blurAmount: number;
  shadowBlur: number;
  cornerRadius: number;
  paddingPercent: number;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
  /** Dominant color computed for the 'auto' background type. v2 field. */
  autoColor: string | null;
  /** Whether a `background.png` entry is embedded in the archive for a
   * custom-image background. v2 field — absent/false on v1 files. */
  hasCustomImage: boolean;
}

/** Committed crop settings. v2 field — absent on v1 files. */
export interface CropMeta {
  aspectRatio: number | null;
}

export interface CanvasMeta {
  originalWidth: number;
  originalHeight: number;
}

export interface ExportSettingsMeta {
  format: 'png' | 'jpeg';
  quality: number;
  pixelRatio: number;
  outputAspectRatio: string;
}

// The project.json contents
export interface ProjectMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceImage: string;
  canvas: CanvasMeta;
  background: BackgroundMeta;
  annotations: Annotation[];
  exportSettings: ExportSettingsMeta;
  /** Committed crop aspect ratio. v2 field — absent on v1 files. */
  crop?: CropMeta | null;
  /** Next number to assign for the "number" annotation tool. v2 field —
   * defaults to 1 (matches pre-v2 behavior) when absent. */
  numberCounter?: number;
}

/** Current .bshot project.json schema version this build writes. */
export const CURRENT_PROJECT_VERSION = 2;

// What Rust returns from read_project/pick_and_open: metadata + raw PNG bytes
export interface ProjectLoadResult {
  metadata: ProjectMetadata;
  screenshotBytes: number[]; // Array<number> comes from JSON serialization over IPC
  backgroundImageBytes?: number[] | null;
}

// What we send to Rust for write_project
export interface ProjectSaveData {
  metadata: ProjectMetadata;
  screenshotBytes: number[];
  backgroundImageBytes?: number[] | null;
}
