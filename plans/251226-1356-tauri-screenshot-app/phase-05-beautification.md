# Phase 05: Beautification Features

**Status**: ✓ complete | **Effort**: 4h | **Priority**: P2 | **Review**: A- (92/100)

## Objective

Implement gradient background library (24+ presets like Winshot), non-destructive cropping with aspect ratio presets, and real-time preview.

---

## Tasks

### 5.1 Gradient Presets Library

**src/data/gradients.ts:**
```typescript
export interface GradientPreset {
  id: string;
  name: string;
  colors: string[];
  direction: 'linear' | 'radial';
  angle?: number; // for linear gradients
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

export const SOLID_COLORS = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'black', name: 'Black', color: '#000000' },
  { id: 'gray', name: 'Gray', color: '#6b7280' },
  { id: 'red', name: 'Red', color: '#ef4444' },
  { id: 'blue', name: 'Blue', color: '#3b82f6' },
  { id: 'green', name: 'Green', color: '#22c55e' },
  { id: 'transparent', name: 'Transparent', color: 'transparent' },
];
```

### 5.2 Background Store

**src/stores/background-store.ts:**
```typescript
import { create } from 'zustand';
import type { GradientPreset } from '../data/gradients';

interface BackgroundState {
  type: 'gradient' | 'solid' | 'transparent';
  gradient: GradientPreset | null;
  solidColor: string;
  padding: number; // px around image

  setGradient: (gradient: GradientPreset) => void;
  setSolidColor: (color: string) => void;
  setTransparent: () => void;
  setPadding: (padding: number) => void;
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  type: 'gradient',
  gradient: null,
  solidColor: '#ffffff',
  padding: 40,

  setGradient: (gradient) => set({ type: 'gradient', gradient }),
  setSolidColor: (color) => set({ type: 'solid', solidColor: color }),
  setTransparent: () => set({ type: 'transparent' }),
  setPadding: (padding) => set({ padding: Math.max(0, Math.min(200, padding)) }),
}));
```

### 5.3 Gradient Background Component

**src/components/canvas/background-layer.tsx:**
```typescript
import { Rect, Shape } from 'react-konva';
import { useBackgroundStore } from '../../stores/background-store';
import { useCanvasStore } from '../../stores/canvas-store';

export function BackgroundLayer() {
  const { type, gradient, solidColor, padding } = useBackgroundStore();
  const { originalWidth, originalHeight } = useCanvasStore();

  const totalWidth = originalWidth + padding * 2;
  const totalHeight = originalHeight + padding * 2;

  if (type === 'transparent') {
    // Checkerboard pattern for transparency
    return (
      <Shape
        sceneFunc={(ctx, shape) => {
          const size = 10;
          for (let x = 0; x < totalWidth; x += size) {
            for (let y = 0; y < totalHeight; y += size) {
              ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0
                ? '#ccc'
                : '#fff';
              ctx.fillRect(x, y, size, size);
            }
          }
        }}
        listening={false}
      />
    );
  }

  if (type === 'solid') {
    return (
      <Rect
        x={0}
        y={0}
        width={totalWidth}
        height={totalHeight}
        fill={solidColor}
        listening={false}
      />
    );
  }

  // Gradient background
  if (!gradient) {
    return (
      <Rect
        x={0}
        y={0}
        width={totalWidth}
        height={totalHeight}
        fill="#ffffff"
        listening={false}
      />
    );
  }

  return (
    <Shape
      sceneFunc={(ctx, shape) => {
        let grd: CanvasGradient;

        if (gradient.direction === 'radial') {
          grd = ctx.createRadialGradient(
            totalWidth / 2, totalHeight / 2, 0,
            totalWidth / 2, totalHeight / 2, Math.max(totalWidth, totalHeight) / 2
          );
        } else {
          // Linear gradient based on angle
          const angle = (gradient.angle || 0) * Math.PI / 180;
          const x1 = totalWidth / 2 - Math.cos(angle) * totalWidth / 2;
          const y1 = totalHeight / 2 - Math.sin(angle) * totalHeight / 2;
          const x2 = totalWidth / 2 + Math.cos(angle) * totalWidth / 2;
          const y2 = totalHeight / 2 + Math.sin(angle) * totalHeight / 2;
          grd = ctx.createLinearGradient(x1, y1, x2, y2);
        }

        gradient.colors.forEach((color, i) => {
          grd.addColorStop(i / (gradient.colors.length - 1), color);
        });

        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      }}
      listening={false}
    />
  );
}
```

### 5.4 Aspect Ratio Cropping

**src/data/aspect-ratios.ts:**
```typescript
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
```

**src/stores/crop-store.ts:**
```typescript
import { create } from 'zustand';

interface CropState {
  isCropping: boolean;
  cropRect: { x: number; y: number; width: number; height: number } | null;
  aspectRatio: number | null;

  startCrop: (ratio?: number | null) => void;
  setCropRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  applyCrop: () => void;
  cancelCrop: () => void;
  setAspectRatio: (ratio: number | null) => void;
}

export const useCropStore = create<CropState>((set, get) => ({
  isCropping: false,
  cropRect: null,
  aspectRatio: null,

  startCrop: (ratio = null) => set({
    isCropping: true,
    aspectRatio: ratio,
    cropRect: null
  }),

  setCropRect: (rect) => set({ cropRect: rect }),

  applyCrop: () => {
    // Crop will be applied during export (non-destructive)
    set({ isCropping: false });
  },

  cancelCrop: () => set({
    isCropping: false,
    cropRect: null
  }),

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
}));
```

### 5.5 Crop Overlay Component

**src/components/canvas/crop-overlay.tsx:**
```typescript
import { Rect, Transformer, Group } from 'react-konva';
import { useRef, useEffect } from 'react';
import Konva from 'konva';
import { useCropStore } from '../../stores/crop-store';
import { useCanvasStore } from '../../stores/canvas-store';

export function CropOverlay() {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const { isCropping, cropRect, aspectRatio, setCropRect } = useCropStore();
  const { originalWidth, originalHeight } = useCanvasStore();

  useEffect(() => {
    if (isCropping && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isCropping]);

  if (!isCropping) return null;

  const defaultRect = cropRect || {
    x: originalWidth * 0.1,
    y: originalHeight * 0.1,
    width: originalWidth * 0.8,
    height: originalHeight * 0.8,
  };

  return (
    <Group>
      {/* Dimmed areas outside crop */}
      <Rect
        x={0}
        y={0}
        width={originalWidth}
        height={originalHeight}
        fill="rgba(0,0,0,0.5)"
        listening={false}
      />

      {/* Clear crop area */}
      <Rect
        ref={rectRef}
        x={defaultRect.x}
        y={defaultRect.y}
        width={defaultRect.width}
        height={defaultRect.height}
        fill="transparent"
        stroke="white"
        strokeWidth={2}
        dash={[10, 5]}
        draggable
        onDragEnd={(e) => {
          setCropRect({
            x: e.target.x(),
            y: e.target.y(),
            width: e.target.width(),
            height: e.target.height(),
          });
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          setCropRect({
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />

      <Transformer
        ref={trRef}
        keepRatio={aspectRatio !== null}
        boundBoxFunc={(oldBox, newBox) => {
          // Enforce aspect ratio if set
          if (aspectRatio !== null) {
            const targetRatio = aspectRatio;
            if (newBox.width / newBox.height > targetRatio) {
              newBox.height = newBox.width / targetRatio;
            } else {
              newBox.width = newBox.height * targetRatio;
            }
          }
          // Minimum size
          if (newBox.width < 50 || newBox.height < 50) {
            return oldBox;
          }
          return newBox;
        }}
      />
    </Group>
  );
}
```

### 5.6 Background & Crop Panel UI

**src/components/sidebar/background-panel.tsx:**
```typescript
import { GRADIENT_PRESETS, SOLID_COLORS } from '../../data/gradients';
import { useBackgroundStore } from '../../stores/background-store';

export function BackgroundPanel() {
  const { type, gradient, padding, setGradient, setSolidColor, setTransparent, setPadding } = useBackgroundStore();

  return (
    <div className="p-4 border-b">
      <h3 className="font-medium mb-3">Background</h3>

      {/* Gradient presets */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {GRADIENT_PRESETS.slice(0, 12).map(preset => (
          <button
            key={preset.id}
            onClick={() => setGradient(preset)}
            className={`w-8 h-8 rounded ${
              gradient?.id === preset.id ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              background: `linear-gradient(${preset.angle || 135}deg, ${preset.colors.join(', ')})`,
            }}
            title={preset.name}
          />
        ))}
      </div>

      {/* Solid colors */}
      <div className="flex gap-2 mb-4">
        {SOLID_COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => setSolidColor(c.color)}
            className={`w-6 h-6 rounded border ${
              type === 'solid' && c.color === useBackgroundStore.getState().solidColor
                ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{ background: c.color === 'transparent' ? 'repeating-linear-gradient(45deg, #ccc, #ccc 5px, #fff 5px, #fff 10px)' : c.color }}
            title={c.name}
          />
        ))}
        <button
          onClick={setTransparent}
          className={`w-6 h-6 rounded border ${type === 'transparent' ? 'ring-2 ring-blue-500' : ''}`}
          style={{ background: 'repeating-linear-gradient(45deg, #ccc, #ccc 5px, #fff 5px, #fff 10px)' }}
          title="Transparent"
        />
      </div>

      {/* Padding slider */}
      <div>
        <label className="text-sm text-gray-600">Padding: {padding}px</label>
        <input
          type="range"
          min="0"
          max="200"
          value={padding}
          onChange={(e) => setPadding(Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
```

**src/components/sidebar/crop-panel.tsx:**
```typescript
import { ASPECT_RATIOS } from '../../data/aspect-ratios';
import { useCropStore } from '../../stores/crop-store';

export function CropPanel() {
  const { isCropping, aspectRatio, startCrop, applyCrop, cancelCrop, setAspectRatio } = useCropStore();

  return (
    <div className="p-4 border-b">
      <h3 className="font-medium mb-3">Crop</h3>

      {!isCropping ? (
        <button
          onClick={() => startCrop()}
          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Start Crop
        </button>
      ) : (
        <>
          {/* Aspect ratio buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.id}
                onClick={() => setAspectRatio(ar.ratio)}
                className={`px-2 py-1 text-sm rounded ${
                  aspectRatio === ar.ratio
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {ar.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={applyCrop}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Apply
            </button>
            <button
              onClick={cancelCrop}
              className="flex-1 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/data/gradients.ts` | Create |
| `src/data/aspect-ratios.ts` | Create |
| `src/stores/background-store.ts` | Create |
| `src/stores/crop-store.ts` | Create |
| `src/components/canvas/background-layer.tsx` | Create |
| `src/components/canvas/crop-overlay.tsx` | Create |
| `src/components/sidebar/background-panel.tsx` | Create |
| `src/components/sidebar/crop-panel.tsx` | Create |

---

## Success Criteria

- [x] 24+ gradient presets available
- [x] Solid color backgrounds work
- [x] Transparent background (checkerboard) works
- [x] Padding slider adjusts space around image
- [x] Crop mode with aspect ratio lock
- [x] Freeform crop available
- [x] Non-destructive (original preserved until export)
- [x] Real-time preview of all changes

## Code Review Summary

**Grade:** A- (92/100)
**Review Report:** [plans/reports/code-reviewer-251229-1140-phase05-beautification.md](../reports/code-reviewer-251229-1140-phase05-beautification.md)

**Highlights:**
- Zero security vulnerabilities
- Zero critical issues
- TypeScript strict mode compliance
- Proper React/Zustand patterns
- Non-destructive architecture

**Optional Improvements:**
- Memoize BackgroundLayer for performance
- Optimize checkerboard rendering with pattern fill
- Add JSDoc to exported components
- Export padding constants for reuse

---

## Next Phase

[Phase 06: Export System](./phase-06-export-system.md)
