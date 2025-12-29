// BackgroundLayer - Renders gradient/solid/transparent background behind image

import { Rect, Shape } from 'react-konva';
import { useBackgroundStore } from '../../stores/background-store';
import { useCanvasStore } from '../../stores/canvas-store';

// Checkerboard pattern size for transparency
const CHECKER_SIZE = 10;

export function BackgroundLayer() {
  const { type, gradient, solidColor, padding } = useBackgroundStore();
  const { originalWidth, originalHeight } = useCanvasStore();

  const totalWidth = originalWidth + padding * 2;
  const totalHeight = originalHeight + padding * 2;

  // Don't render if no image loaded
  if (originalWidth === 0 || originalHeight === 0) {
    return null;
  }

  // Transparent: checkerboard pattern
  if (type === 'transparent') {
    return (
      <Shape
        sceneFunc={(ctx) => {
          for (let x = 0; x < totalWidth; x += CHECKER_SIZE) {
            for (let y = 0; y < totalHeight; y += CHECKER_SIZE) {
              const isEven =
                (Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE)) %
                  2 ===
                0;
              ctx.fillStyle = isEven ? '#cccccc' : '#ffffff';
              ctx.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE);
            }
          }
        }}
        listening={false}
      />
    );
  }

  // Solid color background
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
      sceneFunc={(ctx) => {
        let grd: CanvasGradient;

        if (gradient.direction === 'radial') {
          grd = ctx.createRadialGradient(
            totalWidth / 2,
            totalHeight / 2,
            0,
            totalWidth / 2,
            totalHeight / 2,
            Math.max(totalWidth, totalHeight) / 2
          );
        } else {
          // Linear gradient based on angle
          const angleRad = ((gradient.angle || 0) * Math.PI) / 180;
          const x1 = totalWidth / 2 - Math.cos(angleRad) * (totalWidth / 2);
          const y1 = totalHeight / 2 - Math.sin(angleRad) * (totalHeight / 2);
          const x2 = totalWidth / 2 + Math.cos(angleRad) * (totalWidth / 2);
          const y2 = totalHeight / 2 + Math.sin(angleRad) * (totalHeight / 2);
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
