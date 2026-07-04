// project-io.ts — Shared project I/O functions used by both
// the File menu hook and drag-drop handler

import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useBackgroundStore } from '../stores/background-store';
import { useExportStore } from '../stores/export-store';
import { useCropStore } from '../stores/crop-store';
import { useHistoryStore } from '../stores/history-store';
import { useProjectStore } from '../stores/project-store';
import { toast } from '../stores/toast-store';
import { readProject, normalizePath } from './file-api';
import { logError } from './logger';
import { GRADIENT_PRESETS } from '../data/gradients';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import type { ProjectMetadata } from '../types/project';

/**
 * Restore all stores from loaded project data.
 * Used by both File > Open and drag-drop.
 */
export function restoreProjectFromData(
  metadata: ProjectMetadata,
  screenshotBytes: Uint8Array
) {
  const canvasStore = useCanvasStore.getState();
  const annotationStore = useAnnotationStore.getState();
  const backgroundStore = useBackgroundStore.getState();
  const exportStore = useExportStore.getState();
  const historyStore = useHistoryStore.getState();
  const cropStore = useCropStore.getState();

  // Clear existing state
  canvasStore.clearCanvas();
  annotationStore.clearAnnotations();
  historyStore.clear();
  cropStore.clearCrop();

  // Load screenshot
  canvasStore.setImageFromBytes(
    screenshotBytes,
    metadata.canvas.originalWidth,
    metadata.canvas.originalHeight
  );

  // Restore annotations
  useAnnotationStore.setState({ annotations: metadata.annotations });

  // Restore background
  const bg = metadata.background;
  const bgActions = backgroundStore;
  switch (bg.type) {
    case 'gradient':
      if (bg.gradient) {
        // Look up original preset by ID, or reconstruct with defaults
        const preset = GRADIENT_PRESETS.find((g) => g.id === bg.gradient!.id);
        if (preset) {
          bgActions.setGradient(preset);
        } else {
          bgActions.setGradient({
            ...bg.gradient,
            direction: 'linear' as const,
          });
        }
      }
      break;
    case 'solid':
      if (bg.solidColor) bgActions.setSolidColor(bg.solidColor);
      break;
    case 'transparent':
      bgActions.setTransparent();
      break;
    case 'wallpaper':
      if (bg.wallpaper) {
        // Look up original preset by ID, or reconstruct from metadata
        const preset = WALLPAPER_PRESETS.find(
          (w) => w.id === bg.wallpaper!.id
        );
        if (preset) {
          bgActions.setWallpaper(preset);
        } else {
          bgActions.setWallpaper({
            id: bg.wallpaper.id,
            name: bg.wallpaper.id,
            categoryId: 'custom',
            url: bg.wallpaper.src,
            thumbnailUrl: bg.wallpaper.thumbnail,
            colors: [],
          });
        }
      }
      break;
    case 'auto':
      bgActions.setAuto();
      break;
  }
  bgActions.setBlurAmount(bg.blurAmount);
  bgActions.setShadowBlur(bg.shadowBlur);
  bgActions.setCornerRadius(bg.cornerRadius);
  bgActions.setPaddingPercent(bg.paddingPercent);
  bgActions.setBorderWidth(bg.borderWidth);
  bgActions.setBorderColor(bg.borderColor);
  bgActions.setBorderOpacity(bg.borderOpacity);

  // Restore export settings
  exportStore.setFormat(metadata.exportSettings.format);
  exportStore.setQuality(metadata.exportSettings.quality);
  exportStore.setPixelRatio(metadata.exportSettings.pixelRatio);
  exportStore.setOutputAspectRatio(metadata.exportSettings.outputAspectRatio);

  // Fit to view after restore
  setTimeout(() => canvasStore.fitToView(), 100);
}

/**
 * Build the current project metadata from all stores (for saving)
 */
export function buildProjectMetadata(): ProjectMetadata {
  const canvas = useCanvasStore.getState();
  const bg = useBackgroundStore.getState();
  const annotations = useAnnotationStore.getState().annotations;
  const exportSettings = useExportStore.getState();

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceImage: 'screenshot.png',
    canvas: {
      originalWidth: canvas.originalWidth,
      originalHeight: canvas.originalHeight,
    },
    background: {
      type: bg.type,
      gradient: bg.gradient
        ? {
            id: bg.gradient.id,
            name: bg.gradient.name,
            colors: bg.gradient.colors,
          }
        : null,
      solidColor: bg.solidColor,
      // WallpaperPreset uses url/thumbnailUrl, WallpaperMeta uses src/thumbnail
      wallpaper: bg.wallpaper
        ? {
            id: bg.wallpaper.id,
            src: bg.wallpaper.url,
            thumbnail: bg.wallpaper.thumbnailUrl || '',
          }
        : null,
      blurAmount: bg.blurAmount,
      shadowBlur: bg.shadowBlur,
      cornerRadius: bg.cornerRadius,
      paddingPercent: bg.paddingPercent,
      borderWidth: bg.borderWidth,
      borderColor: bg.borderColor,
      borderOpacity: bg.borderOpacity,
    },
    annotations: annotations as ProjectMetadata['annotations'],
    exportSettings: {
      format: exportSettings.format,
      quality: exportSettings.quality,
      pixelRatio: exportSettings.pixelRatio,
      outputAspectRatio: exportSettings.outputAspectRatio,
    },
  };
}

/**
 * Open a .bshot project from a file path.
 * Full flow: read -> restore -> update store -> toast.
 * Returns true on success.
 */
export async function openProjectFile(path: string): Promise<boolean> {
  try {
    const result = await readProject(path);

    // Convert number[] to Uint8Array (IPC serialization)
    const bytes = Array.isArray(result.screenshotBytes)
      ? new Uint8Array(result.screenshotBytes)
      : new Uint8Array(
          Object.values(
            result.screenshotBytes as unknown as Record<string, number>
          )
        );

    restoreProjectFromData(result.metadata, bytes);
    useProjectStore.getState().openProject(path);

    const displayPath = normalizePath(path);
    toast.success(
      'Opened',
      `Project loaded from ${displayPath.split(/[\\/]/).pop()}`
    );
    return true;
  } catch (e) {
    logError('openProjectFile', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error('Open Failed', message);
    return false;
  }
}
