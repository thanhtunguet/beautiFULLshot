import { describe, it, expect } from 'vitest';
import { GRADIENT_PRESETS, SOLID_COLORS, type GradientPreset, type SolidColor } from '../gradients';

describe('Gradients Data', () => {
  describe('GRADIENT_PRESETS', () => {
    it('should have at least 24 gradient presets', () => {
      expect(GRADIENT_PRESETS.length).toBeGreaterThanOrEqual(24);
    });

    it('should have exactly 24 gradient presets', () => {
      expect(GRADIENT_PRESETS.length).toBe(24);
    });

    it('should have unique IDs for all gradients', () => {
      const ids = GRADIENT_PRESETS.map(g => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(GRADIENT_PRESETS.length);
    });

    it('should have unique names for all gradients', () => {
      const names = GRADIENT_PRESETS.map(g => g.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(GRADIENT_PRESETS.length);
    });

    it('should contain expected gradient categories', () => {
      const ids = GRADIENT_PRESETS.map(g => g.id);

      // Blues
      expect(ids).toContain('ocean');
      expect(ids).toContain('royal');
      expect(ids).toContain('azure');

      // Purples
      expect(ids).toContain('velvet');
      expect(ids).toContain('midnight');
      expect(ids).toContain('cosmic');

      // Warm
      expect(ids).toContain('sunset');
      expect(ids).toContain('sunrise');
      expect(ids).toContain('peach');

      // Greens
      expect(ids).toContain('forest');
      expect(ids).toContain('mint');
      expect(ids).toContain('emerald');

      // Neutrals
      expect(ids).toContain('slate');
      expect(ids).toContain('charcoal');
      expect(ids).toContain('silver');

      // Vibrant
      expect(ids).toContain('rainbow');
      expect(ids).toContain('neon');
      expect(ids).toContain('electric');

      // Soft
      expect(ids).toContain('blush');
      expect(ids).toContain('lavender');
      expect(ids).toContain('cream');

      // Dark
      expect(ids).toContain('obsidian');
      expect(ids).toContain('void');
      expect(ids).toContain('carbon');
    });
  });

  describe('GradientPreset Structure', () => {
    it('should have all required properties', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        expect(gradient).toHaveProperty('id');
        expect(gradient).toHaveProperty('name');
        expect(gradient).toHaveProperty('colors');
        expect(gradient).toHaveProperty('direction');
      });
    });

    it('should have valid ID format (lowercase, no spaces)', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        expect(gradient.id).toMatch(/^[a-z0-9]+$/);
      });
    });

    it('should have non-empty names', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        expect(gradient.name.length).toBeGreaterThan(0);
      });
    });

    it('should have at least 2 colors per gradient', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        expect(gradient.colors.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should have valid color hex values', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      GRADIENT_PRESETS.forEach(gradient => {
        gradient.colors.forEach(color => {
          expect(color).toMatch(hexColorRegex);
        });
      });
    });

    it('should have valid direction values', () => {
      const validDirections = ['linear', 'radial'];
      GRADIENT_PRESETS.forEach(gradient => {
        expect(validDirections).toContain(gradient.direction);
      });
    });

    it('should have angle for linear gradients', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        if (gradient.direction === 'linear') {
          expect(gradient.angle).toBeDefined();
          expect(typeof gradient.angle).toBe('number');
          expect(gradient.angle).toBeGreaterThanOrEqual(0);
          expect(gradient.angle).toBeLessThanOrEqual(360);
        }
      });
    });
  });

  describe('Gradient Presets by Category', () => {
    it('should have Blues category', () => {
      const blues = ['ocean', 'royal', 'azure'];
      blues.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Purples category', () => {
      const purples = ['velvet', 'midnight', 'cosmic'];
      purples.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Warm category', () => {
      const warms = ['sunset', 'sunrise', 'peach'];
      warms.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Greens category', () => {
      const greens = ['forest', 'mint', 'emerald'];
      greens.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Neutrals category', () => {
      const neutrals = ['slate', 'charcoal', 'silver'];
      neutrals.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Vibrant category', () => {
      const vibrants = ['rainbow', 'neon', 'electric'];
      vibrants.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Soft category', () => {
      const softs = ['blush', 'lavender', 'cream'];
      softs.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });

    it('should have Dark category', () => {
      const darks = ['obsidian', 'void', 'carbon'];
      darks.forEach(id => {
        const gradient = GRADIENT_PRESETS.find(g => g.id === id);
        expect(gradient).toBeDefined();
      });
    });
  });

  describe('Specific Gradient Validation', () => {
    it('Ocean gradient should be correct', () => {
      const ocean = GRADIENT_PRESETS.find(g => g.id === 'ocean');
      expect(ocean).toEqual({
        id: 'ocean',
        name: 'Ocean',
        colors: ['#667eea', '#764ba2'],
        direction: 'linear',
        angle: 135,
      });
    });

    it('Rainbow gradient should have 3 colors', () => {
      const rainbow = GRADIENT_PRESETS.find(g => g.id === 'rainbow');
      expect(rainbow?.colors.length).toBe(3);
    });

    it('Void gradient should have 3 colors', () => {
      const void_grad = GRADIENT_PRESETS.find(g => g.id === 'void');
      expect(void_grad?.colors.length).toBe(3);
    });
  });

  describe('SOLID_COLORS', () => {
    it('should exist and be an array', () => {
      expect(Array.isArray(SOLID_COLORS)).toBe(true);
    });

    it('should have multiple color options', () => {
      expect(SOLID_COLORS.length).toBeGreaterThan(0);
    });

    it('should have unique IDs', () => {
      const ids = SOLID_COLORS.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(SOLID_COLORS.length);
    });

    it('should have valid color structure', () => {
      SOLID_COLORS.forEach(color => {
        expect(color).toHaveProperty('id');
        expect(color).toHaveProperty('name');
        expect(color).toHaveProperty('color');
      });
    });

    it('should have valid hex color values', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      SOLID_COLORS.forEach(color => {
        expect(color.color).toMatch(hexColorRegex);
      });
    });

    it('should include basic colors', () => {
      const ids = SOLID_COLORS.map(c => c.id);
      expect(ids).toContain('white');
      expect(ids).toContain('black');
      expect(ids).toContain('gray');
    });
  });

  describe('Interface Compliance', () => {
    it('GRADIENT_PRESETS should match GradientPreset interface', () => {
      GRADIENT_PRESETS.forEach(gradient => {
        const preset: GradientPreset = gradient;
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.colors).toBeDefined();
        expect(preset.direction).toBeDefined();
      });
    });

    it('SOLID_COLORS should match SolidColor interface', () => {
      SOLID_COLORS.forEach(color => {
        const solid: SolidColor = color;
        expect(solid.id).toBeDefined();
        expect(solid.name).toBeDefined();
        expect(solid.color).toBeDefined();
      });
    });
  });
});
