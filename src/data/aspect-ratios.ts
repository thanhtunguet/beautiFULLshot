// Aspect ratio presets for cropping

export interface AspectRatio {
  id: string;
  name: string;
  ratio: number | null; // null = freeform
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: 'free', name: 'Free', ratio: null },
  { id: '1:1', name: '1:1 Square', ratio: 1 },
  { id: '4:3', name: '4:3', ratio: 4 / 3 },
  { id: '3:2', name: '3:2', ratio: 3 / 2 },
  { id: '16:9', name: '16:9 Widescreen', ratio: 16 / 9 },
  { id: '21:9', name: '21:9 Ultrawide', ratio: 21 / 9 },
  { id: '9:16', name: '9:16 Portrait', ratio: 9 / 16 },
  { id: '3:4', name: '3:4 Portrait', ratio: 3 / 4 },
];
