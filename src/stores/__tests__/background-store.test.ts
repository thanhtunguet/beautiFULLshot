import { describe, it, expect, beforeEach } from 'vitest';
import { useBackgroundStore } from '../background-store';
import { GRADIENT_PRESETS } from '../../data/gradients';

describe('Background Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useBackgroundStore.setState({
      type: 'gradient',
      gradient: GRADIENT_PRESETS[0],
      solidColor: '#ffffff',
      padding: 40,
    });
  });

  describe('Initial State', () => {
    it('should have default gradient background', () => {
      const state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
      expect(state.gradient).toEqual(GRADIENT_PRESETS[0]);
    });

    it('should have default padding of 40', () => {
      const state = useBackgroundStore.getState();
      expect(state.padding).toBe(40);
    });

    it('should have default solid color as white', () => {
      const state = useBackgroundStore.getState();
      expect(state.solidColor).toBe('#ffffff');
    });
  });

  describe('setGradient', () => {
    it('should set gradient and type to gradient', () => {
      const gradient = GRADIENT_PRESETS[1]; // Royal gradient
      useBackgroundStore.getState().setGradient(gradient);

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
      expect(state.gradient).toEqual(gradient);
    });

    it('should replace previous gradient', () => {
      const gradient1 = GRADIENT_PRESETS[0];
      const gradient2 = GRADIENT_PRESETS[5];

      useBackgroundStore.getState().setGradient(gradient1);
      expect(useBackgroundStore.getState().gradient).toEqual(gradient1);

      useBackgroundStore.getState().setGradient(gradient2);
      expect(useBackgroundStore.getState().gradient).toEqual(gradient2);
    });

    it('should preserve gradient properties', () => {
      const gradient = GRADIENT_PRESETS[3]; // Velvet
      useBackgroundStore.getState().setGradient(gradient);

      const state = useBackgroundStore.getState();
      expect(state.gradient?.id).toBe(gradient.id);
      expect(state.gradient?.name).toBe(gradient.name);
      expect(state.gradient?.colors).toEqual(gradient.colors);
      expect(state.gradient?.direction).toBe(gradient.direction);
    });
  });

  describe('setSolidColor', () => {
    it('should set solid color and type to solid', () => {
      useBackgroundStore.getState().setSolidColor('#000000');

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('solid');
      expect(state.solidColor).toBe('#000000');
    });

    it('should accept hex color codes', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#ABCDEF'];

      colors.forEach(color => {
        useBackgroundStore.getState().setSolidColor(color);
        expect(useBackgroundStore.getState().solidColor).toBe(color);
      });
    });

    it('should replace previous solid color', () => {
      useBackgroundStore.getState().setSolidColor('#FF0000');
      expect(useBackgroundStore.getState().solidColor).toBe('#FF0000');

      useBackgroundStore.getState().setSolidColor('#0000FF');
      expect(useBackgroundStore.getState().solidColor).toBe('#0000FF');
    });
  });

  describe('setTransparent', () => {
    it('should set type to transparent', () => {
      useBackgroundStore.getState().setTransparent();

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('transparent');
    });

    it('should work after setting gradient', () => {
      useBackgroundStore.getState().setGradient(GRADIENT_PRESETS[2]);
      expect(useBackgroundStore.getState().type).toBe('gradient');

      useBackgroundStore.getState().setTransparent();
      expect(useBackgroundStore.getState().type).toBe('transparent');
    });

    it('should work after setting solid color', () => {
      useBackgroundStore.getState().setSolidColor('#FF0000');
      expect(useBackgroundStore.getState().type).toBe('solid');

      useBackgroundStore.getState().setTransparent();
      expect(useBackgroundStore.getState().type).toBe('transparent');
    });
  });

  describe('setPadding', () => {
    it('should set padding value', () => {
      useBackgroundStore.getState().setPadding(60);
      expect(useBackgroundStore.getState().padding).toBe(60);
    });

    it('should clamp padding to minimum 0', () => {
      useBackgroundStore.getState().setPadding(-10);
      expect(useBackgroundStore.getState().padding).toBe(0);
    });

    it('should clamp padding to maximum 200', () => {
      useBackgroundStore.getState().setPadding(300);
      expect(useBackgroundStore.getState().padding).toBe(200);
    });

    it('should accept values within valid range', () => {
      const validValues = [0, 10, 40, 100, 150, 200];

      validValues.forEach(value => {
        useBackgroundStore.getState().setPadding(value);
        expect(useBackgroundStore.getState().padding).toBe(value);
      });
    });

    it('should handle edge cases', () => {
      useBackgroundStore.getState().setPadding(0);
      expect(useBackgroundStore.getState().padding).toBe(0);

      useBackgroundStore.getState().setPadding(200);
      expect(useBackgroundStore.getState().padding).toBe(200);
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      useBackgroundStore.getState().setGradient(GRADIENT_PRESETS[5]);
      useBackgroundStore.getState().setPadding(100);

      useBackgroundStore.getState().reset();

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
      expect(state.gradient).toEqual(GRADIENT_PRESETS[0]);
      expect(state.solidColor).toBe('#ffffff');
      expect(state.padding).toBe(40);
    });

    it('should reset from transparent state', () => {
      useBackgroundStore.getState().setTransparent();
      useBackgroundStore.getState().setPadding(150);

      useBackgroundStore.getState().reset();

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
      expect(state.padding).toBe(40);
    });

    it('should reset from solid color state', () => {
      useBackgroundStore.getState().setSolidColor('#FF0000');
      useBackgroundStore.getState().setPadding(80);

      useBackgroundStore.getState().reset();

      const state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
      expect(state.solidColor).toBe('#ffffff');
      expect(state.padding).toBe(40);
    });
  });

  describe('Type switching', () => {
    it('should switch between all three types correctly', () => {
      let state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');

      useBackgroundStore.getState().setSolidColor('#FF0000');
      state = useBackgroundStore.getState();
      expect(state.type).toBe('solid');

      useBackgroundStore.getState().setTransparent();
      state = useBackgroundStore.getState();
      expect(state.type).toBe('transparent');

      useBackgroundStore.getState().setGradient(GRADIENT_PRESETS[3]);
      state = useBackgroundStore.getState();
      expect(state.type).toBe('gradient');
    });

    it('should maintain padding across type switches', () => {
      useBackgroundStore.getState().setPadding(75);

      useBackgroundStore.getState().setSolidColor('#FF0000');
      expect(useBackgroundStore.getState().padding).toBe(75);

      useBackgroundStore.getState().setTransparent();
      expect(useBackgroundStore.getState().padding).toBe(75);

      useBackgroundStore.getState().setGradient(GRADIENT_PRESETS[2]);
      expect(useBackgroundStore.getState().padding).toBe(75);
    });
  });
});
