// Background store - Zustand state for background beautification

import { create } from 'zustand';
import { GRADIENT_PRESETS, type GradientPreset } from '../data/gradients';

// Constants
const MIN_PADDING = 0;
const MAX_PADDING = 200;
const DEFAULT_PADDING = 40;

export type BackgroundType = 'gradient' | 'solid' | 'transparent';

interface BackgroundState {
  type: BackgroundType;
  gradient: GradientPreset | null;
  solidColor: string;
  padding: number; // px around image

  setGradient: (gradient: GradientPreset) => void;
  setSolidColor: (color: string) => void;
  setTransparent: () => void;
  setPadding: (padding: number) => void;
  reset: () => void;
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  type: 'gradient',
  gradient: GRADIENT_PRESETS[0], // Default to first gradient
  solidColor: '#ffffff',
  padding: DEFAULT_PADDING,

  setGradient: (gradient) => set({ type: 'gradient', gradient }),

  setSolidColor: (color) => set({ type: 'solid', solidColor: color }),

  setTransparent: () => set({ type: 'transparent' }),

  setPadding: (padding) =>
    set({ padding: Math.max(MIN_PADDING, Math.min(MAX_PADDING, padding)) }),

  reset: () =>
    set({
      type: 'gradient',
      gradient: GRADIENT_PRESETS[0],
      solidColor: '#ffffff',
      padding: DEFAULT_PADDING,
    }),
}));
