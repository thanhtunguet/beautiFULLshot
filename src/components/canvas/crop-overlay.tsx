// CropOverlay - Non-destructive crop selection with aspect ratio support

import { useRef, useEffect } from 'react';
import { Rect, Transformer, Group, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCropStore } from '../../stores/crop-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useBackgroundStore } from '../../stores/background-store';

// Minimum crop size
const MIN_CROP_SIZE = 50;

export function CropOverlay() {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const { isCropping, cropRect, aspectRatio, setCropRect } = useCropStore();
  const { originalWidth, originalHeight } = useCanvasStore();
  const { padding } = useBackgroundStore();

  // Attach transformer to crop rect
  useEffect(() => {
    if (isCropping && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }

    return () => {
      if (trRef.current) {
        trRef.current.nodes([]);
      }
    };
  }, [isCropping]);

  if (!isCropping || originalWidth === 0) return null;

  // Default crop rect: 80% of image centered
  const defaultRect = cropRect || {
    x: originalWidth * 0.1,
    y: originalHeight * 0.1,
    width: originalWidth * 0.8,
    height: originalHeight * 0.8,
  };

  return (
    <Layer>
      {/* Offset by padding to align with image */}
      <Group x={padding} y={padding}>
        {/* Dimmed overlay outside crop area */}
        <Rect
          x={0}
          y={0}
          width={originalWidth}
          height={originalHeight}
          fill="rgba(0,0,0,0.5)"
          listening={false}
        />

        {/* Crop selection rectangle */}
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
            // Enforce minimum size
            if (newBox.width < MIN_CROP_SIZE || newBox.height < MIN_CROP_SIZE) {
              return oldBox;
            }
            return newBox;
          }}
        />
      </Group>
    </Layer>
  );
}
