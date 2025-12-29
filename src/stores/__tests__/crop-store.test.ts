import { describe, it, expect, beforeEach } from 'vitest';
import { useCropStore, type CropRect } from '../crop-store';

describe('Crop Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCropStore.setState({
      isCropping: false,
      cropRect: null,
      aspectRatio: null,
    });
  });

  describe('Initial State', () => {
    it('should have cropping disabled by default', () => {
      const state = useCropStore.getState();
      expect(state.isCropping).toBe(false);
    });

    it('should have no crop rect initially', () => {
      const state = useCropStore.getState();
      expect(state.cropRect).toBeNull();
    });

    it('should have no aspect ratio initially', () => {
      const state = useCropStore.getState();
      expect(state.aspectRatio).toBeNull();
    });
  });

  describe('startCrop', () => {
    it('should enable cropping', () => {
      useCropStore.getState().startCrop();
      expect(useCropStore.getState().isCropping).toBe(true);
    });

    it('should clear previous crop rect when starting new crop', () => {
      useCropStore.setState({
        cropRect: { x: 10, y: 10, width: 100, height: 100 },
      });
      expect(useCropStore.getState().cropRect).not.toBeNull();

      useCropStore.getState().startCrop();
      expect(useCropStore.getState().cropRect).toBeNull();
    });

    it('should set aspect ratio when provided', () => {
      useCropStore.getState().startCrop(1); // 1:1 square
      expect(useCropStore.getState().aspectRatio).toBe(1);
    });

    it('should set aspect ratio to null for freeform', () => {
      useCropStore.getState().startCrop(16 / 9);
      useCropStore.getState().startCrop(null); // Freeform
      expect(useCropStore.getState().aspectRatio).toBeNull();
    });

    it('should handle default parameter (no ratio)', () => {
      useCropStore.getState().startCrop();
      expect(useCropStore.getState().aspectRatio).toBeNull();
    });

    it('should accept common aspect ratios', () => {
      const ratios = [1, 4 / 3, 3 / 2, 16 / 9, 21 / 9, 9 / 16, 3 / 4];

      ratios.forEach(ratio => {
        useCropStore.getState().startCrop(ratio);
        expect(useCropStore.getState().aspectRatio).toBe(ratio);
      });
    });
  });

  describe('setCropRect', () => {
    it('should set crop rectangle', () => {
      const rect: CropRect = { x: 10, y: 20, width: 100, height: 150 };
      useCropStore.getState().setCropRect(rect);

      const state = useCropStore.getState();
      expect(state.cropRect).toEqual(rect);
    });

    it('should update crop rect preserving all values', () => {
      const rect: CropRect = { x: 50, y: 75, width: 200, height: 300 };
      useCropStore.getState().setCropRect(rect);

      const cropRect = useCropStore.getState().cropRect;
      expect(cropRect?.x).toBe(50);
      expect(cropRect?.y).toBe(75);
      expect(cropRect?.width).toBe(200);
      expect(cropRect?.height).toBe(300);
    });

    it('should replace previous crop rect', () => {
      const rect1: CropRect = { x: 10, y: 10, width: 100, height: 100 };
      const rect2: CropRect = { x: 50, y: 50, width: 200, height: 200 };

      useCropStore.getState().setCropRect(rect1);
      expect(useCropStore.getState().cropRect).toEqual(rect1);

      useCropStore.getState().setCropRect(rect2);
      expect(useCropStore.getState().cropRect).toEqual(rect2);
    });

    it('should accept zero values', () => {
      const rect: CropRect = { x: 0, y: 0, width: 100, height: 100 };
      useCropStore.getState().setCropRect(rect);

      const cropRect = useCropStore.getState().cropRect;
      expect(cropRect?.x).toBe(0);
      expect(cropRect?.y).toBe(0);
    });

    it('should accept decimal values', () => {
      const rect: CropRect = { x: 10.5, y: 20.3, width: 100.7, height: 150.2 };
      useCropStore.getState().setCropRect(rect);

      const cropRect = useCropStore.getState().cropRect;
      expect(cropRect?.x).toBe(10.5);
      expect(cropRect?.y).toBe(20.3);
      expect(cropRect?.width).toBe(100.7);
      expect(cropRect?.height).toBe(150.2);
    });
  });

  describe('applyCrop', () => {
    it('should disable cropping when applied', () => {
      useCropStore.getState().startCrop();
      expect(useCropStore.getState().isCropping).toBe(true);

      useCropStore.getState().applyCrop();
      expect(useCropStore.getState().isCropping).toBe(false);
    });

    it('should preserve crop rect when applied', () => {
      const rect: CropRect = { x: 10, y: 10, width: 100, height: 100 };
      useCropStore.getState().startCrop();
      useCropStore.getState().setCropRect(rect);

      useCropStore.getState().applyCrop();

      expect(useCropStore.getState().cropRect).toEqual(rect);
    });

    it('should preserve aspect ratio when applied', () => {
      useCropStore.getState().startCrop(16 / 9);
      useCropStore.getState().applyCrop();

      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);
    });
  });

  describe('cancelCrop', () => {
    it('should disable cropping', () => {
      useCropStore.getState().startCrop();
      useCropStore.getState().cancelCrop();

      expect(useCropStore.getState().isCropping).toBe(false);
    });

    it('should clear crop rect', () => {
      useCropStore.getState().startCrop();
      useCropStore.getState().setCropRect({ x: 10, y: 10, width: 100, height: 100 });

      useCropStore.getState().cancelCrop();

      expect(useCropStore.getState().cropRect).toBeNull();
    });

    it('should preserve aspect ratio', () => {
      useCropStore.getState().startCrop(1);
      useCropStore.getState().setCropRect({ x: 10, y: 10, width: 100, height: 100 });

      useCropStore.getState().cancelCrop();

      expect(useCropStore.getState().aspectRatio).toBe(1);
    });

    it('should cancel without affecting previously set ratio', () => {
      useCropStore.getState().setAspectRatio(16 / 9);
      useCropStore.getState().startCrop(1);
      useCropStore.getState().cancelCrop();

      expect(useCropStore.getState().aspectRatio).toBe(1);
    });
  });

  describe('setAspectRatio', () => {
    it('should set aspect ratio', () => {
      useCropStore.getState().setAspectRatio(16 / 9);
      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);
    });

    it('should set aspect ratio to null for freeform', () => {
      useCropStore.getState().setAspectRatio(1);
      useCropStore.getState().setAspectRatio(null);

      expect(useCropStore.getState().aspectRatio).toBeNull();
    });

    it('should replace previous aspect ratio', () => {
      useCropStore.getState().setAspectRatio(4 / 3);
      expect(useCropStore.getState().aspectRatio).toBe(4 / 3);

      useCropStore.getState().setAspectRatio(16 / 9);
      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);
    });

    it('should not affect cropping state', () => {
      useCropStore.getState().startCrop();
      useCropStore.getState().setAspectRatio(1);

      expect(useCropStore.getState().isCropping).toBe(true);
    });

    it('should not affect crop rect', () => {
      const rect: CropRect = { x: 10, y: 10, width: 100, height: 100 };
      useCropStore.getState().setCropRect(rect);

      useCropStore.getState().setAspectRatio(16 / 9);

      expect(useCropStore.getState().cropRect).toEqual(rect);
    });

    it('should accept common aspect ratios', () => {
      const ratios = [1, 4 / 3, 3 / 2, 16 / 9, 21 / 9, 9 / 16, 3 / 4];

      ratios.forEach(ratio => {
        useCropStore.getState().setAspectRatio(ratio);
        expect(useCropStore.getState().aspectRatio).toBe(ratio);
      });
    });
  });

  describe('Crop Workflow', () => {
    it('should handle complete crop workflow', () => {
      // Start crop with aspect ratio
      useCropStore.getState().startCrop(16 / 9);
      expect(useCropStore.getState().isCropping).toBe(true);
      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);

      // Set crop rect
      const rect: CropRect = { x: 10, y: 20, width: 800, height: 450 };
      useCropStore.getState().setCropRect(rect);
      expect(useCropStore.getState().cropRect).toEqual(rect);

      // Apply crop
      useCropStore.getState().applyCrop();
      expect(useCropStore.getState().isCropping).toBe(false);
      expect(useCropStore.getState().cropRect).toEqual(rect); // Preserved
    });

    it('should handle cancel workflow', () => {
      // Start crop
      useCropStore.getState().startCrop(1);
      useCropStore.getState().setCropRect({ x: 5, y: 5, width: 100, height: 100 });

      // Cancel crop
      useCropStore.getState().cancelCrop();

      expect(useCropStore.getState().isCropping).toBe(false);
      expect(useCropStore.getState().cropRect).toBeNull();
      expect(useCropStore.getState().aspectRatio).toBe(1); // Preserved
    });

    it('should support changing aspect ratio mid-crop', () => {
      useCropStore.getState().startCrop(1);
      expect(useCropStore.getState().aspectRatio).toBe(1);

      useCropStore.getState().setAspectRatio(16 / 9);
      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);

      useCropStore.getState().setAspectRatio(null);
      expect(useCropStore.getState().aspectRatio).toBeNull();
    });

    it('should allow starting new crop after applying', () => {
      // First crop
      useCropStore.getState().startCrop(1);
      useCropStore.getState().setCropRect({ x: 0, y: 0, width: 100, height: 100 });
      useCropStore.getState().applyCrop();

      // Second crop
      useCropStore.getState().startCrop(16 / 9);
      expect(useCropStore.getState().isCropping).toBe(true);
      expect(useCropStore.getState().cropRect).toBeNull(); // Cleared
      expect(useCropStore.getState().aspectRatio).toBe(16 / 9);
    });
  });
});
