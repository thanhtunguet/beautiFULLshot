import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../project-store';

beforeEach(() => {
  useProjectStore.setState({
    filePath: null,
    isDirty: false,
    isOpen: false,
  });
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
});
