import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildProjectMetadata,
  restoreProjectFromData,
  confirmDiscardIfDirty,
  saveProject,
  loadImageAsNewCanvas,
  guardedProjectTransition,
} from '../project-io';
import { useToastStore } from '../../stores/toast-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useBackgroundStore } from '../../stores/background-store';
import { useExportStore } from '../../stores/export-store';
import { useCropStore } from '../../stores/crop-store';
import { useProjectStore } from '../../stores/project-store';
import { useUnsavedChangesStore } from '../../stores/unsaved-changes-store';
import { GRADIENT_PRESETS } from '../../data/gradients';
import { WALLPAPER_PRESETS } from '../../data/wallpapers';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('../file-api', () => ({
  writeProject: vi.fn(async (path: string) => path),
  clearActiveProject: vi.fn(async () => {}),
  getProjectDir: vi.fn(async () => '/tmp/beautiFULLshot'),
  normalizePath: (p: string) => p,
}));

const SCREENSHOT_BYTES = new Uint8Array([1, 2, 3, 4]);

function resetAllStores() {
  useCanvasStore.setState({
    imageUrl: null,
    imageBytes: SCREENSHOT_BYTES,
    originalWidth: 100,
    originalHeight: 100,
  });
  useAnnotationStore.setState({ annotations: [], numberCounter: 1, selectedId: null });
  useBackgroundStore.setState({
    type: 'gradient',
    gradient: GRADIENT_PRESETS[0],
    solidColor: '#ffffff',
    wallpaper: null,
    customImageUrl: null,
    customImageBytes: null,
    selectedImageId: null,
    autoColor: null,
    blurAmount: 0,
    shadowBlur: 50,
    cornerRadius: 12,
    paddingPercent: 5,
    borderWidth: 0,
    borderColor: '#000000',
    borderOpacity: 100,
  });
  useExportStore.setState({
    format: 'png',
    quality: 0.9,
    pixelRatio: 1,
    outputAspectRatio: 'auto',
  });
  useCropStore.setState({ isCropping: false, cropRect: null, aspectRatio: null });
  useProjectStore.setState({
    filePath: null,
    isDirty: false,
    isOpen: false,
    revision: 0,
  });
  useToastStore.getState().clearToasts();
}

describe('project-io round trip', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('round-trips a gradient background', () => {
    useBackgroundStore.getState().setGradient(GRADIENT_PRESETS[2]);
    const metadata = buildProjectMetadata(false);

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    const bg = useBackgroundStore.getState();
    expect(bg.type).toBe('gradient');
    expect(bg.gradient?.id).toBe(GRADIENT_PRESETS[2].id);
  });

  it('round-trips a solid background', () => {
    useBackgroundStore.getState().setSolidColor('#123456');
    const metadata = buildProjectMetadata(false);

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useBackgroundStore.getState().type).toBe('solid');
    expect(useBackgroundStore.getState().solidColor).toBe('#123456');
  });

  it('round-trips a transparent background', () => {
    useBackgroundStore.getState().setTransparent();
    const metadata = buildProjectMetadata(false);

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useBackgroundStore.getState().type).toBe('transparent');
  });

  it('round-trips a wallpaper background', () => {
    useBackgroundStore.getState().setWallpaper(WALLPAPER_PRESETS[0]);
    const metadata = buildProjectMetadata(false);

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useBackgroundStore.getState().type).toBe('wallpaper');
    expect(useBackgroundStore.getState().wallpaper?.id).toBe(WALLPAPER_PRESETS[0].id);
  });

  it('round-trips an "auto" background including autoColor', () => {
    useBackgroundStore.getState().setAuto();
    useBackgroundStore.getState().setAutoColor('#abcdef');
    const metadata = buildProjectMetadata(false);

    expect(metadata.background.autoColor).toBe('#abcdef');

    // Simulate a fresh session where autoColor hasn't been recomputed yet
    useBackgroundStore.setState({ autoColor: null });
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useBackgroundStore.getState().type).toBe('auto');
    expect(useBackgroundStore.getState().autoColor).toBe('#abcdef');
  });

  it('round-trips a custom image background including its bytes', () => {
    const imageBytes = new Uint8Array([9, 9, 9, 9]);
    useBackgroundStore.setState({ type: 'image', customImageBytes: imageBytes });
    const metadata = buildProjectMetadata(true);

    expect(metadata.background.type).toBe('image');
    expect(metadata.background.hasCustomImage).toBe(true);

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, imageBytes);

    const bg = useBackgroundStore.getState();
    expect(bg.type).toBe('image');
    expect(bg.customImageBytes).toEqual(imageBytes);
    expect(bg.customImageUrl).toBeTruthy();
  });

  it('round-trips the committed crop aspect ratio', () => {
    useCropStore.getState().setAspectRatio(16 / 9);
    const metadata = buildProjectMetadata(false);

    expect(metadata.crop?.aspectRatio).toBeCloseTo(16 / 9);

    useCropStore.getState().setAspectRatio(null);
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useCropStore.getState().aspectRatio).toBeCloseTo(16 / 9);
  });

  it('round-trips an active crop selection', () => {
    // Regression: only aspectRatio was persisted, so reopening a project
    // saved mid-crop showed the uncropped image with the selection gone.
    const rect = { x: 12, y: 34, width: 200, height: 150 };
    useCropStore.getState().startCrop(4 / 3);
    useCropStore.getState().setCropRect(rect);

    const metadata = buildProjectMetadata(false);
    expect(metadata.crop?.isCropping).toBe(true);
    expect(metadata.crop?.cropRect).toEqual(rect);

    useCropStore.getState().clearCrop();
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    const crop = useCropStore.getState();
    expect(crop.isCropping).toBe(true);
    expect(crop.cropRect).toEqual(rect);
    expect(crop.aspectRatio).toBeCloseTo(4 / 3);
  });

  it('restores no active selection from a file saved without one', () => {
    useCropStore.getState().setAspectRatio(1);
    const metadata = buildProjectMetadata(false);

    useCropStore.getState().startCrop();
    useCropStore.getState().setCropRect({ x: 1, y: 1, width: 9, height: 9 });
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useCropStore.getState().isCropping).toBe(false);
    expect(useCropStore.getState().cropRect).toBeNull();
  });

  it('treats a v1 file with no crop block as having no selection', () => {
    const metadata = buildProjectMetadata(false);
    delete (metadata as { crop?: unknown }).crop;

    useCropStore.getState().startCrop();
    useCropStore.getState().setCropRect({ x: 1, y: 1, width: 9, height: 9 });
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);

    expect(useCropStore.getState().isCropping).toBe(false);
    expect(useCropStore.getState().cropRect).toBeNull();
  });

  it('round-trips the number-annotation counter', () => {
    useAnnotationStore.setState({
      annotations: [
        { id: 'n1', type: 'number', number: 1, x: 0, y: 0, rotation: 0, draggable: true, radius: 10, fill: '#fff', textColor: '#000', fontSize: 12 },
        { id: 'n2', type: 'number', number: 2, x: 0, y: 0, rotation: 0, draggable: true, radius: 10, fill: '#fff', textColor: '#000', fontSize: 12 },
      ],
      numberCounter: 3,
    });
    const metadata = buildProjectMetadata(false);
    expect(metadata.numberCounter).toBe(3);

    // clearAnnotations() (called internally by restoreProjectFromData) would
    // otherwise reset the counter to 1 — verify it's restored to 3, not 1.
    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);
    expect(useAnnotationStore.getState().numberCounter).toBe(3);
  });

  it('falls back to computing the counter from annotations for v1 files missing numberCounter', () => {
    const metadata = buildProjectMetadata(false);
    metadata.numberCounter = undefined;
    metadata.annotations = [
      { id: 'n1', type: 'number', number: 1, x: 0, y: 0, rotation: 0, draggable: true, radius: 10, fill: '#fff', textColor: '#000', fontSize: 12 },
      { id: 'n2', type: 'number', number: 5, x: 0, y: 0, rotation: 0, draggable: true, radius: 10, fill: '#fff', textColor: '#000', fontSize: 12 },
    ];

    restoreProjectFromData(metadata, SCREENSHOT_BYTES, null);
    expect(useAnnotationStore.getState().numberCounter).toBe(6);
  });
});

describe('confirmDiscardIfDirty', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('resolves true immediately when the project is not dirty', async () => {
    useProjectStore.setState({ isDirty: false });
    await expect(confirmDiscardIfDirty()).resolves.toBe(true);
  });

  it('resolves false when the user cancels', async () => {
    useProjectStore.setState({ isOpen: true, isDirty: true, filePath: '/p.bshot' });

    const pending = confirmDiscardIfDirty();
    useUnsavedChangesStore.getState().resolve('cancel');

    await expect(pending).resolves.toBe(false);
  });

  it('resolves true when the user discards without saving', async () => {
    useProjectStore.setState({ isOpen: true, isDirty: true, filePath: '/p.bshot' });

    const pending = confirmDiscardIfDirty();
    useUnsavedChangesStore.getState().resolve('discard');

    await expect(pending).resolves.toBe(true);
  });

  it('saves and resolves true when the user chooses save', async () => {
    useProjectStore.setState({ isOpen: true, isDirty: true, filePath: '/p.bshot' });

    const pending = confirmDiscardIfDirty();
    useUnsavedChangesStore.getState().resolve('save');

    await expect(pending).resolves.toBe(true);
  });
});

describe('saveProject', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('fails gracefully when there is no image to save', async () => {
    useCanvasStore.setState({ imageBytes: null });
    await expect(saveProject()).resolves.toBe(false);
  });

  it('saves to the existing file path without prompting Save As', async () => {
    useProjectStore.setState({ filePath: '/existing/project.bshot', isOpen: true, isDirty: true });
    const result = await saveProject();
    expect(result).toBe(true);
    expect(useProjectStore.getState().filePath).toBe('/existing/project.bshot');
  });

  it('marks the project clean when nothing changed during the write', async () => {
    useProjectStore.setState({ filePath: '/existing/project.bshot', isOpen: true, isDirty: true });

    await saveProject();

    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('stays dirty when the document is edited mid-save', async () => {
    // Regression: the write snapshots the document, awaits, then used to
    // clear isDirty unconditionally — so an edit made during the await was
    // absent from disk but displayed as saved.
    useProjectStore.setState({ filePath: '/existing/project.bshot', isOpen: true, isDirty: true });

    const { writeProject } = await import('../file-api');
    vi.mocked(writeProject).mockImplementationOnce(async (path: string) => {
      // Simulate the user editing while the write is in flight.
      useExportStore.getState().setQuality(0.42);
      return path;
    });

    const result = await saveProject();

    expect(result).toBe(true);
    expect(useProjectStore.getState().isDirty).toBe(true);
    // The path still updates — the file does exist, it's just behind.
    expect(useProjectStore.getState().filePath).toBe('/existing/project.bshot');
  });
});

describe('loadImageAsNewCanvas', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('leaves an untitled but open document', async () => {
    await loadImageAsNewCanvas(new Uint8Array([9, 9]), 50, 40);

    const state = useProjectStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.filePath).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  it('detaches from the previously open project', async () => {
    // Otherwise the next Save would overwrite that project with this image.
    useProjectStore.getState().openProject('/old/project.bshot');

    await loadImageAsNewCanvas(new Uint8Array([9, 9]), 50, 40);

    expect(useProjectStore.getState().filePath).toBeNull();
  });

  it('protects subsequent edits to the new canvas', async () => {
    await loadImageAsNewCanvas(new Uint8Array([9, 9]), 50, 40);

    useExportStore.getState().setQuality(0.33);
    expect(useProjectStore.getState().isDirty).toBe(true);

    // A further transition must now prompt rather than silently discard.
    let ran = false;
    const pending = guardedProjectTransition(async () => {
      ran = true;
    });
    useUnsavedChangesStore.getState().resolve('cancel');

    await expect(pending).resolves.toBe('cancelled');
    expect(ran).toBe(false);
  });
});

describe('guardedProjectTransition error handling', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('reports a failing action instead of swallowing it', async () => {
    // Regression: open/drop failures (bad version, malformed archive, I/O
    // errors) rejected into the void and the user saw nothing happen.
    const result = await guardedProjectTransition(async () => {
      throw new Error('Project file is missing project.json');
    });

    expect(result).toBe('failed');
    const errorToast = useToastStore
      .getState()
      .toasts.find((t) => t.type === 'error');
    expect(errorToast?.message).toBe('Project file is missing project.json');
  });

  it('releases the lock after a failure so the next attempt can run', async () => {
    await guardedProjectTransition(async () => {
      throw new Error('boom');
    });

    await expect(guardedProjectTransition(async () => {})).resolves.toBe(
      'completed'
    );
  });

  it('reports being busy instead of silently doing nothing', async () => {
    // Regression: a drop or open arriving while a modal held the lock
    // returned false with no toast, which looked exactly like a dead click.
    let ran = false;
    const first = guardedProjectTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const second = await guardedProjectTransition(async () => {
      ran = true;
    });

    expect(second).toBe('busy');
    expect(ran).toBe(false);
    const errorToast = useToastStore
      .getState()
      .toasts.find((t) => t.type === 'error');
    expect(errorToast?.title).toBe('Busy');

    await first;
  });

  it('stays quiet when the user cancels', async () => {
    // Cancel is the guard working as intended, not a failure — no toast.
    useProjectStore.setState({ isDirty: true, isOpen: true });

    const pending = guardedProjectTransition(async () => {});
    useUnsavedChangesStore.getState().resolve('cancel');

    await expect(pending).resolves.toBe('cancelled');
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
