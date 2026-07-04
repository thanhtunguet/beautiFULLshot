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
}

// What Rust returns from read_project: metadata + raw PNG bytes
export interface ProjectLoadResult {
  metadata: ProjectMetadata;
  screenshotBytes: number[]; // Array<number> comes from JSON serialization over IPC
}

// What we send to Rust for write_project
export interface ProjectSaveData {
  metadata: ProjectMetadata;
  screenshotBytes: number[];
}
