// Gradient presets library for background beautification
// 24+ gradient presets inspired by Winshot

export interface GradientPreset {
  id: string;
  name: string;
  colors: string[];
  direction: 'linear' | 'radial';
  angle?: number; // for linear gradients
}

export interface SolidColor {
  id: string;
  name: string;
  color: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  // Blues
  { id: 'ocean', name: 'Ocean', colors: ['#667eea', '#764ba2'], direction: 'linear', angle: 135 },
  { id: 'royal', name: 'Royal', colors: ['#141E30', '#243B55'], direction: 'linear', angle: 180 },
  { id: 'azure', name: 'Azure', colors: ['#0099F7', '#F11712'], direction: 'linear', angle: 135 },

  // Purples
  { id: 'velvet', name: 'Velvet', colors: ['#DA22FF', '#9733EE'], direction: 'linear', angle: 135 },
  { id: 'midnight', name: 'Midnight', colors: ['#232526', '#414345'], direction: 'linear', angle: 180 },
  { id: 'cosmic', name: 'Cosmic', colors: ['#ff00cc', '#333399'], direction: 'linear', angle: 135 },

  // Warm
  { id: 'sunset', name: 'Sunset', colors: ['#f12711', '#f5af19'], direction: 'linear', angle: 135 },
  { id: 'sunrise', name: 'Sunrise', colors: ['#FF512F', '#F09819'], direction: 'linear', angle: 90 },
  { id: 'peach', name: 'Peach', colors: ['#ed4264', '#ffedbc'], direction: 'linear', angle: 135 },

  // Greens
  { id: 'forest', name: 'Forest', colors: ['#134E5E', '#71B280'], direction: 'linear', angle: 135 },
  { id: 'mint', name: 'Mint', colors: ['#00b09b', '#96c93d'], direction: 'linear', angle: 135 },
  { id: 'emerald', name: 'Emerald', colors: ['#348F50', '#56B4D3'], direction: 'linear', angle: 135 },

  // Neutrals
  { id: 'slate', name: 'Slate', colors: ['#2C3E50', '#4CA1AF'], direction: 'linear', angle: 135 },
  { id: 'charcoal', name: 'Charcoal', colors: ['#373B44', '#4286f4'], direction: 'linear', angle: 135 },
  { id: 'silver', name: 'Silver', colors: ['#bdc3c7', '#2c3e50'], direction: 'linear', angle: 180 },

  // Vibrant
  { id: 'rainbow', name: 'Rainbow', colors: ['#f12711', '#f5af19', '#56B4D3'], direction: 'linear', angle: 90 },
  { id: 'neon', name: 'Neon', colors: ['#12c2e9', '#c471ed', '#f64f59'], direction: 'linear', angle: 90 },
  { id: 'electric', name: 'Electric', colors: ['#4776E6', '#8E54E9'], direction: 'linear', angle: 135 },

  // Soft
  { id: 'blush', name: 'Blush', colors: ['#ffecd2', '#fcb69f'], direction: 'linear', angle: 135 },
  { id: 'lavender', name: 'Lavender', colors: ['#e0c3fc', '#8ec5fc'], direction: 'linear', angle: 135 },
  { id: 'cream', name: 'Cream', colors: ['#fdfbfb', '#ebedee'], direction: 'linear', angle: 180 },

  // Dark
  { id: 'obsidian', name: 'Obsidian', colors: ['#000000', '#434343'], direction: 'linear', angle: 180 },
  { id: 'void', name: 'Void', colors: ['#0f0c29', '#302b63', '#24243e'], direction: 'linear', angle: 135 },
  { id: 'carbon', name: 'Carbon', colors: ['#1c1c1c', '#383838'], direction: 'linear', angle: 180 },
];

export const SOLID_COLORS: SolidColor[] = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'black', name: 'Black', color: '#000000' },
  { id: 'gray', name: 'Gray', color: '#6b7280' },
  { id: 'red', name: 'Red', color: '#ef4444' },
  { id: 'blue', name: 'Blue', color: '#3b82f6' },
  { id: 'green', name: 'Green', color: '#22c55e' },
];
