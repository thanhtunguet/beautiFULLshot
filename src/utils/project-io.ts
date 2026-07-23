// project-io.ts — Shared project I/O functions used by the File menu hook,
// drag-drop handler, capture/paste handlers, and the guarded-transition gate.

import { save } from '@tauri-apps/plugin-dialog';
import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useBackgroundStore } from '../stores/background-store';
import { useExportStore } from '../stores/export-store';
import { useCropStore } from '../stores/crop-store';
import { useHistoryStore } from '../stores/history-store';
import { useProjectStore } from '../stores/project-store';
import { useUnsavedChangesStore } from '../stores/unsaved-changes-store';
import { toast } from '../stores/toast-store';
import { writeProject, clearActiveProject, getProjectDir, normalizePath } from './file-api';
import { getImageFromDB } from './image-db';
import { logError } from './logger';
import { GRADIENT_PRESETS } from '../data/gradients';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import type { ProjectMetadata, ProjectSaveData } from '../types/project';
import { CURRENT_PROJECT_VERSION } from '../types/project';

// ─── Guarded transition lock ────────────────────────────────────────
// Every entry point that can replace the current project/canvas state
// (Open, Close, Capture, Paste, Drop, the window/monitor pickers, and the
// Delete confirmation flow) shares this lock so only one such transition —
// and only one confirmation prompt — is ever in flight at a time. This is
// what prevents e.g. opening a second project while the delete-confirmation
// modal for the first one is still on screen.
let transitionLocked = false;

export function isProjectTransitionLocked(): boolean {
  return transitionLocked;
}

export function tryAcquireTransitionLock(): boolean {
  if (transitionLocked) return false;
  transitionLocked = true;
  return true;
}

export function releaseTransitionLock(): void {
  transitionLocked = false;
}

/**
 * If the current project has unsaved changes, prompt Save / Discard /
 * Cancel and wait for the user's choice. Resolves `true` when it's safe to
 * proceed (already clean, saved successfully, or explicitly discarded) and
 * `false` when the caller should abort (Cancel, or Save failed/was itself
 * cancelled via Save As).
 */
export async function confirmDiscardIfDirty(): Promise<boolean> {
  const state = useProjectStore.getState();
  if (!state.isDirty) return true;

  const choice = await useUnsavedChangesStore.getState().request();
  if (choice === 'cancel') return false;
  if (choice === 'discard') return true;
  return await saveProject();
}

/**
 * Run `action` as a guarded transition: acquires the shared lock, prompts
 * to save/discard if the current project is dirty, then runs `action`.
 * Returns `false` without running `action` if another transition is
 * already in flight or the user cancels the prompt.
 */
export async function guardedProjectTransition(
  action: () => Promise<void>
): Promise<boolean> {
  if (!tryAcquireTransitionLock()) return false;
  try {
    const proceed = await confirmDiscardIfDirty();
    if (!proceed) return false;
    await action();
    return true;
  } finally {
    releaseTransitionLock();
  }
}

// ─── Save ────────────────────────────────────────────────────────────

let isSaving = false;

/**
 * Save the current project. Prompts a Save As dialog if it has never been
 * saved before. Shared by the File > Save menu/hotkey and the unsaved
 * changes "Save" choice, so there is exactly one save code path.
 */
export async function saveProject(): Promise<boolean> {
  if (isSaving) return false;
  isSaving = true;
  try {
    const state = useProjectStore.getState();
    const canvas = useCanvasStore.getState();

    if (!canvas.imageBytes) {
      toast.error('Save Failed', 'No image to save. Take a screenshot first.');
      return false;
    }

    let savePath = state.filePath;

    if (!savePath) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const defaultName = `screenshot_${now.getFullYear()}${pad(
        now.getMonth() + 1
      )}${pad(now.getDate())}_${pad(now.getHours())}${pad(
        now.getMinutes()
      )}${pad(now.getSeconds())}.bshot`;
      const projectDir = await getProjectDir();
      savePath = await save({
        defaultPath: `${projectDir}/${defaultName}`,
        filters: [
          { name: 'beautiFULLshot Project', extensions: ['bshot'] },
        ],
      });
      if (!savePath) return false;
    }

    const data = await buildProjectSaveData();
    const savedPath = await writeProject(savePath, data);
    const displayPath = normalizePath(savedPath);
    useProjectStore.getState().setFilePath(displayPath);

    toast.success(
      'Saved',
      `Project saved to ${displayPath.split(/[\\/]/).pop()}`,
      displayPath
    );
    return true;
  } catch (e) {
    logError('saveProject', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error('Save Failed', message);
    return false;
  } finally {
    isSaving = false;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Resolve the bytes for a custom-image background, if any. `customImageBytes`
 * covers a freshly-uploaded image; a library-selected image only carries
 * `selectedImageId` (see background-store.ts's `selectFromLibrary`), so its
 * bytes are re-fetched from IndexedDB here.
 */
async function resolveBackgroundImageBytes(): Promise<Uint8Array | null> {
  const bg = useBackgroundStore.getState();
  if (bg.type !== 'image') return null;
  if (bg.customImageBytes) return bg.customImageBytes;
  if (bg.selectedImageId) {
    const stored = await getImageFromDB(bg.selectedImageId);
    if (stored) return dataUrlToBytes(stored.dataUrl);
  }
  return null;
}

/**
 * Build the current project metadata from all stores (for saving).
 */
export function buildProjectMetadata(hasCustomImage: boolean): ProjectMetadata {
  const canvas = useCanvasStore.getState();
  const bg = useBackgroundStore.getState();
  const annotations = useAnnotationStore.getState().annotations;
  const numberCounter = useAnnotationStore.getState().numberCounter;
  const exportSettings = useExportStore.getState();
  const crop = useCropStore.getState();

  return {
    version: CURRENT_PROJECT_VERSION,
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
      autoColor: bg.autoColor,
      hasCustomImage,
    },
    annotations: annotations as ProjectMetadata['annotations'],
    exportSettings: {
      format: exportSettings.format,
      quality: exportSettings.quality,
      pixelRatio: exportSettings.pixelRatio,
      outputAspectRatio: exportSettings.outputAspectRatio,
    },
    crop: { aspectRatio: crop.aspectRatio },
    numberCounter,
  };
}

/**
 * Build the full payload for `writeProject`, including a custom background
 * image's bytes if one is set (fetching from IndexedDB when needed).
 */
export async function buildProjectSaveData(): Promise<ProjectSaveData> {
  const canvas = useCanvasStore.getState();
  const backgroundImageBytes = await resolveBackgroundImageBytes();
  const metadata = buildProjectMetadata(backgroundImageBytes !== null);

  return {
    metadata,
    screenshotBytes: Array.from(canvas.imageBytes ?? new Uint8Array()),
    backgroundImageBytes: backgroundImageBytes
      ? Array.from(backgroundImageBytes)
      : null,
  };
}

function toUint8Array(bytes: number[] | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function computeNumberCounterFallback(annotations: ProjectMetadata['annotations']): number {
  const maxNumber = annotations.reduce((max, a) => {
    return a.type === 'number' && a.number > max ? a.number : max;
  }, 0);
  return maxNumber + 1;
}

/**
 * Restore all stores from loaded project data.
 * Used by both File > Open and drag-drop.
 */
export function restoreProjectFromData(
  metadata: ProjectMetadata,
  screenshotBytes: Uint8Array,
  backgroundImageBytes?: Uint8Array | null
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
  // Revoke/clear any previously-set custom background image so it doesn't
  // leak a blob URL or linger if the incoming project uses a different type.
  backgroundStore.clearCustomImage();

  // Load screenshot
  canvasStore.setImageFromBytes(
    screenshotBytes,
    metadata.canvas.originalWidth,
    metadata.canvas.originalHeight
  );

  // Restore annotations + numbering state
  useAnnotationStore.setState({
    annotations: metadata.annotations,
    numberCounter: metadata.numberCounter ?? computeNumberCounterFallback(metadata.annotations),
  });

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
    case 'image':
      if (backgroundImageBytes) {
        const blob = new Blob([backgroundImageBytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        // Set directly rather than via setCustomImage() to avoid
        // re-inserting the image into the persisted library on every reopen.
        useBackgroundStore.setState({
          type: 'image',
          customImageUrl: url,
          customImageBytes: backgroundImageBytes,
        });
      }
      break;
    case 'auto':
      bgActions.setAuto();
      break;
  }
  if (bg.autoColor) bgActions.setAutoColor(bg.autoColor);
  bgActions.setBlurAmount(bg.blurAmount);
  bgActions.setShadowBlur(bg.shadowBlur);
  bgActions.setCornerRadius(bg.cornerRadius);
  bgActions.setPaddingPercent(bg.paddingPercent);
  bgActions.setBorderWidth(bg.borderWidth);
  bgActions.setBorderColor(bg.borderColor);
  bgActions.setBorderOpacity(bg.borderOpacity);

  // Restore crop
  if (metadata.crop) {
    cropStore.setAspectRatio(metadata.crop.aspectRatio);
  }

  // Restore export settings
  exportStore.setFormat(metadata.exportSettings.format);
  exportStore.setQuality(metadata.exportSettings.quality);
  exportStore.setPixelRatio(metadata.exportSettings.pixelRatio);
  exportStore.setOutputAspectRatio(metadata.exportSettings.outputAspectRatio);

  // Fit to view after restore
  setTimeout(() => canvasStore.fitToView(), 100);
}

/**
 * Clear canvas/annotation/history/crop state and detach from whatever
 * project is currently open (both the frontend store and the Rust-tracked
 * active project path). Shared by Close and by every flow that replaces the
 * canvas with unrelated content (capture/paste/drop/Open > Image) — those
 * must stop treating the canvas as "the currently open .bshot project" once
 * the pictured content changes, otherwise a subsequent Save would silently
 * overwrite the old project file with unrelated content.
 */
export async function closeProjectAndClearCanvas(): Promise<void> {
  useCanvasStore.getState().clearCanvas();
  useAnnotationStore.getState().clearAnnotations();
  useHistoryStore.getState().clear();
  useCropStore.getState().clearCrop();
  useProjectStore.getState().closeProject();
  try {
    await clearActiveProject();
  } catch {
    // Non-fatal — backend just won't have an active project tracked.
  }
}

/**
 * Detach from any currently-open project and load `bytes` as a brand-new,
 * unsaved canvas image.
 */
export async function loadImageAsNewCanvas(
  bytes: Uint8Array,
  width: number,
  height: number
): Promise<void> {
  await closeProjectAndClearCanvas();
  useCanvasStore.getState().setImageFromBytes(bytes, width, height);
  setTimeout(() => useCanvasStore.getState().fitToView(), 100);
}

/** Get image pixel dimensions from raw bytes. */
export function getImageDimensionsFromBytes(
  bytes: Uint8Array
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Open an image (from a path already read by the caller — the native Open
 * dialog or a validated drag-drop) as a new screenshot.
 * Returns true on success.
 */
export async function openImageFromBytes(
  path: string,
  bytes: Uint8Array
): Promise<boolean> {
  try {
    const { width, height } = await getImageDimensionsFromBytes(bytes);
    await loadImageAsNewCanvas(bytes, width, height);

    const displayPath = normalizePath(path);
    toast.success(
      'Opened',
      `Image loaded from ${displayPath.split(/[\\/]/).pop()}`
    );
    return true;
  } catch (e) {
    logError('openImageFromBytes', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error('Open Failed', message);
    return false;
  }
}

/**
 * Open a .bshot project from already-read metadata/bytes (the native Open
 * dialog or a validated drag-drop both parse the archive on the Rust side
 * and hand the result here).
 * Returns true on success.
 */
export async function openProjectFromData(
  path: string,
  metadata: ProjectMetadata,
  screenshotBytes: number[] | Uint8Array,
  backgroundImageBytes?: number[] | Uint8Array | null
): Promise<boolean> {
  try {
    const bytes = toUint8Array(screenshotBytes);
    const bgBytes = backgroundImageBytes ? toUint8Array(backgroundImageBytes) : null;

    restoreProjectFromData(metadata, bytes, bgBytes);
    useProjectStore.getState().openProject(path);

    const displayPath = normalizePath(path);
    toast.success(
      'Opened',
      `Project loaded from ${displayPath.split(/[\\/]/).pop()}`
    );
    return true;
  } catch (e) {
    logError('openProjectFromData', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error('Open Failed', message);
    return false;
  }
}
