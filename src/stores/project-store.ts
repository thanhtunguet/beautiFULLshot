// Project store — Zustand state for project file management
// Tracks file path, dirty state, and open/close lifecycle

import { create } from 'zustand';
import { useCanvasStore } from './canvas-store';
import { useAnnotationStore } from './annotation-store';
import { useBackgroundStore } from './background-store';
import { useExportStore } from './export-store';
import { useCropStore } from './crop-store';

export interface ProjectState {
  /** Path on disk, or null for a document that has never been saved. */
  filePath: string | null;
  isDirty: boolean;
  /** Whether a document exists to edit at all (an empty editor has none). */
  isOpen: boolean;
  /**
   * Monotonic counter bumped on every tracked content change. `saveProject`
   * snapshots this before an async write and only clears `isDirty` if it is
   * unchanged afterwards, so edits made mid-save aren't misreported as
   * persisted.
   */
  revision: number;

  markDirty: () => void;
  markClean: () => void;
  /** Begin an untitled document (capture/paste/drop): open, no path yet. */
  startUntitledProject: () => void;
  openProject: (path: string) => void;
  closeProject: () => void;
  setFilePath: (path: string) => void;
}

let subscriptionsActive = false;

/**
 * Mark the current document dirty and advance its revision.
 *
 * This is gated on `isOpen` alone, never on `filePath`. An untitled document
 * (a fresh capture/paste/drop) is open with a null path, and its edits must
 * count as unsaved work — otherwise a later transition would discard them
 * without ever prompting.
 */
function bumpRevision() {
  const state = useProjectStore.getState();
  if (!state.isOpen) return;
  useProjectStore.setState({
    isDirty: true,
    revision: state.revision + 1,
  });
}

function setupDirtyTracking() {
  if (subscriptionsActive) return;
  subscriptionsActive = true;

  const markDirty = bumpRevision;

  // Watch canvas store for image changes
  useCanvasStore.subscribe((state, prevState) => {
    if (
      state.imageUrl !== prevState.imageUrl ||
      state.originalWidth !== prevState.originalWidth ||
      state.originalHeight !== prevState.originalHeight
    ) {
      markDirty();
    }
  });

  // Watch annotation store for annotation changes
  useAnnotationStore.subscribe((state, prevState) => {
    if (state.annotations !== prevState.annotations) {
      markDirty();
    }
  });

  // Watch background store for setting changes
  let prevBgType = useBackgroundStore.getState().type;
  let prevBlur = useBackgroundStore.getState().blurAmount;
  let prevShadow = useBackgroundStore.getState().shadowBlur;
  let prevRadius = useBackgroundStore.getState().cornerRadius;
  let prevPadding = useBackgroundStore.getState().paddingPercent;
  let prevBorderWidth = useBackgroundStore.getState().borderWidth;
  let prevBorderColor = useBackgroundStore.getState().borderColor;
  let prevBorderOpacity = useBackgroundStore.getState().borderOpacity;
  let prevGradientId = useBackgroundStore.getState().gradient?.id ?? null;
  let prevSolidColor = useBackgroundStore.getState().solidColor;
  let prevWallpaperId = useBackgroundStore.getState().wallpaper?.id ?? null;
  let prevCustomImageUrl = useBackgroundStore.getState().customImageUrl;
  let prevSelectedImageId = useBackgroundStore.getState().selectedImageId;
  let prevAutoColor = useBackgroundStore.getState().autoColor;

  useBackgroundStore.subscribe((state) => {
    if (
      state.type !== prevBgType ||
      state.blurAmount !== prevBlur ||
      state.shadowBlur !== prevShadow ||
      state.cornerRadius !== prevRadius ||
      state.paddingPercent !== prevPadding ||
      state.borderWidth !== prevBorderWidth ||
      state.borderColor !== prevBorderColor ||
      state.borderOpacity !== prevBorderOpacity ||
      state.gradient?.id !== prevGradientId ||
      state.solidColor !== prevSolidColor ||
      state.wallpaper?.id !== prevWallpaperId ||
      state.customImageUrl !== prevCustomImageUrl ||
      state.selectedImageId !== prevSelectedImageId ||
      state.autoColor !== prevAutoColor
    ) {
      prevBgType = state.type;
      prevBlur = state.blurAmount;
      prevShadow = state.shadowBlur;
      prevRadius = state.cornerRadius;
      prevPadding = state.paddingPercent;
      prevBorderWidth = state.borderWidth;
      prevBorderColor = state.borderColor;
      prevBorderOpacity = state.borderOpacity;
      prevGradientId = state.gradient?.id ?? null;
      prevSolidColor = state.solidColor;
      prevWallpaperId = state.wallpaper?.id ?? null;
      prevCustomImageUrl = state.customImageUrl;
      prevSelectedImageId = state.selectedImageId;
      prevAutoColor = state.autoColor;
      markDirty();
    }
  });

  // Watch the crop store. All three fields are persisted in the project
  // file's `crop` block — including an in-progress selection — so moving or
  // resizing a crop rect is a real content change, not just transient UI.
  let prevAspectRatio = useCropStore.getState().aspectRatio;
  let prevIsCropping = useCropStore.getState().isCropping;
  let prevCropRect = useCropStore.getState().cropRect;
  useCropStore.subscribe((state) => {
    if (
      state.aspectRatio !== prevAspectRatio ||
      state.isCropping !== prevIsCropping ||
      state.cropRect !== prevCropRect
    ) {
      prevAspectRatio = state.aspectRatio;
      prevIsCropping = state.isCropping;
      prevCropRect = state.cropRect;
      markDirty();
    }
  });

  // Watch export settings — these are part of the persisted project file
  // (ProjectMetadata.exportSettings) but were not tracked before, so
  // changing them didn't mark the project dirty.
  let prevFormat = useExportStore.getState().format;
  let prevQuality = useExportStore.getState().quality;
  let prevPixelRatio = useExportStore.getState().pixelRatio;
  let prevOutputAspectRatio = useExportStore.getState().outputAspectRatio;

  useExportStore.subscribe((state) => {
    if (
      state.format !== prevFormat ||
      state.quality !== prevQuality ||
      state.pixelRatio !== prevPixelRatio ||
      state.outputAspectRatio !== prevOutputAspectRatio
    ) {
      prevFormat = state.format;
      prevQuality = state.quality;
      prevPixelRatio = state.pixelRatio;
      prevOutputAspectRatio = state.outputAspectRatio;
      markDirty();
    }
  });
}

export const useProjectStore = create<ProjectState>(() => {
  setupDirtyTracking();

  return {
    filePath: null,
    isDirty: false,
    isOpen: false,
    revision: 0,

    markDirty: bumpRevision,

    markClean: () => useProjectStore.setState({ isDirty: false }),

    // A brand-new capture/paste/drop is an unsaved document, not "no
    // document". It starts clean (nothing has been edited yet) but open, so
    // any subsequent edit marks it dirty and gets a discard prompt.
    startUntitledProject: () =>
      useProjectStore.setState({
        filePath: null,
        isDirty: false,
        isOpen: true,
      }),

    openProject: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),

    closeProject: () =>
      useProjectStore.setState({
        filePath: null,
        isDirty: false,
        isOpen: false,
      }),

    setFilePath: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),
  };
});
