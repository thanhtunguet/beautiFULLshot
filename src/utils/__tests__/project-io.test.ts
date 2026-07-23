import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildProjectMetadata,
  restoreProjectFromData,
  confirmDiscardIfDirty,
  saveProject,
} from '../project-io';
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
  useProjectStore.setState({ filePath: null, isDirty: false, isOpen: false });
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
});
