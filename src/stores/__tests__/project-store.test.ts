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
    revision: 0,
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

    it('marks dirty when a crop selection is started', () => {
      useCropStore.getState().startCrop();
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it('marks dirty when the crop rect is moved or resized', () => {
      useCropStore.getState().startCrop();
      useProjectStore.getState().markClean();

      useCropStore.getState().setCropRect({ x: 5, y: 5, width: 50, height: 40 });
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });

  describe('untitled documents', () => {
    it('starts open with no path and clean', () => {
      useProjectStore.getState().startUntitledProject();

      const state = useProjectStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
    });

    it('becomes dirty when edited, so its work is protected', () => {
      // Regression: dirty tracking used to require a filePath, so edits to a
      // fresh capture/paste/drop never registered and a later transition
      // discarded them with no prompt.
      useProjectStore.getState().startUntitledProject();

      useExportStore.getState().setQuality(0.5);

      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(useProjectStore.getState().filePath).toBeNull();
    });

    it('ignores edits once closed', () => {
      useProjectStore.getState().startUntitledProject();
      useProjectStore.getState().closeProject();

      useExportStore.getState().setQuality(0.4);

      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe('revision counter', () => {
    it('advances on every tracked change', () => {
      useProjectStore.getState().openProject('/some/project.bshot');
      const start = useProjectStore.getState().revision;

      useExportStore.getState().setQuality(0.5);
      useExportStore.getState().setPixelRatio(3);

      expect(useProjectStore.getState().revision).toBe(start + 2);
    });

    it('advances even while already dirty', () => {
      // The counter has to keep moving after the first edit — otherwise a
      // save can't tell "edited during the write" from "unchanged".
      useProjectStore.getState().openProject('/some/project.bshot');
      useExportStore.getState().setQuality(0.5);

      const afterFirst = useProjectStore.getState().revision;
      expect(useProjectStore.getState().isDirty).toBe(true);

      useExportStore.getState().setPixelRatio(3);
      expect(useProjectStore.getState().revision).toBe(afterFirst + 1);
    });

    it('does not advance when no document is open', () => {
      const start = useProjectStore.getState().revision;
      useExportStore.getState().setQuality(0.5);
      expect(useProjectStore.getState().revision).toBe(start);
    });
  });
});
