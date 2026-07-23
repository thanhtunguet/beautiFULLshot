import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../project-store';
import { useBackgroundStore } from '../background-store';
import { useExportStore } from '../export-store';
import { useCropStore } from '../crop-store';
import { WALLPAPER_PRESETS } from '../../data/wallpapers';

beforeEach(() => {
  useProjectStore.setState({
    filePath: null,
    isDirty: false,
    isOpen: false,
  });
  useBackgroundStore.setState({
    wallpaper: null,
    customImageUrl: null,
    customImageBytes: null,
    selectedImageId: null,
    autoColor: null,
  });
  useExportStore.setState({
    format: 'png',
    quality: 0.9,
    pixelRatio: 1,
    outputAspectRatio: 'auto',
  });
  useCropStore.setState({ isCropping: false, cropRect: null, aspectRatio: null });
});

describe('project-store', () => {
  describe('initial state', () => {
    it('should start with no file path, not dirty, not open', () => {
      const state = useProjectStore.getState();
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(false);
    });
  });

  describe('markDirty / markClean', () => {
    it('should toggle dirty state when project is open', () => {
      // Need to set isOpen first for markDirty to take effect
      useProjectStore.setState({ isOpen: true });

      useProjectStore.getState().markDirty();
      expect(useProjectStore.getState().isDirty).toBe(true);

      useProjectStore.getState().markClean();
      expect(useProjectStore.getState().isDirty).toBe(false);
    });

    it('should not mark dirty when project is not open', () => {
      useProjectStore.getState().markDirty();
      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe('openProject', () => {
    it('should set filePath, mark clean, and set isOpen', () => {
      useProjectStore.getState().openProject('/path/to/project.bshot');
      const state = useProjectStore.getState();
      expect(state.filePath).toBe('/path/to/project.bshot');
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(true);
    });
  });

  describe('setFilePath', () => {
    it('should update filePath, mark clean, and set isOpen', () => {
      useProjectStore.getState().setFilePath('/new/path.bshot');
      const state = useProjectStore.getState();
      expect(state.filePath).toBe('/new/path.bshot');
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(true);
    });
  });

  describe('closeProject', () => {
    it('should reset to initial state', () => {
      useProjectStore.getState().openProject('/some/project.bshot');
      useProjectStore.setState({ isDirty: true });
      useProjectStore.getState().closeProject();
      const state = useProjectStore.getState();
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(false);
    });
  });

  describe('dirty tracking — background store', () => {
    beforeEach(() => {
      useProjectStore.getState().openProject('/some/project.bshot');
    });

    it('marks dirty when the wallpaper changes', () => {
      useBackgroundStore.getState().setWallpaper(WALLPAPER_PRESETS[0]);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when a custom image is set', () => {
      useBackgroundStore.getState().setCustomImage('blob:fake-url');
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when autoColor changes', () => {
      useBackgroundStore.getState().setAutoColor('#abcdef');
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });

  describe('dirty tracking — export store', () => {
    beforeEach(() => {
      useProjectStore.getState().openProject('/some/project.bshot');
    });

    it('marks dirty when export format changes', () => {
      useExportStore.getState().setFormat('jpeg');
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when export quality changes', () => {
      useExportStore.getState().setQuality(0.5);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when pixel ratio changes', () => {
      useExportStore.getState().setPixelRatio(2);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when the output aspect ratio changes', () => {
      useExportStore.getState().setOutputAspectRatio('16:9');
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });

  describe('dirty tracking — crop store', () => {
    beforeEach(() => {
      useProjectStore.getState().openProject('/some/project.bshot');
    });

    it('marks dirty when the committed crop aspect ratio changes', () => {
      useCropStore.getState().setAspectRatio(1);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });
});
