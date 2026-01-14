// EllipseShape - Ellipse annotation component

import { Ellipse } from 'react-konva';
import type Konva from 'konva';
import type { EllipseAnnotation } from '../../../types/annotations';
import { useAnnotationStore } from '../../../stores/annotation-store';
import { useTransformHandler } from '../../../hooks/use-transform-handler';

interface Props {
  annotation: EllipseAnnotation;
}

export function EllipseShape({ annotation }: Props) {
  const { updateAnnotation, setSelected } = useAnnotationStore();
  const handleTransformEnd = useTransformHandler(annotation.id, 'ellipse', {
    radiusX: annotation.radiusX,
    radiusY: annotation.radiusY,
  });

  // Custom hit function for transparent fills - ensures clicks inside shape register
  const hitFunc = (context: Konva.Context, shape: Konva.Shape) => {
    context.beginPath();
    context.ellipse(0, 0, annotation.radiusX, annotation.radiusY, 0, 0, Math.PI * 2);
    context.closePath();
    context.fillStrokeShape(shape);
  };

  return (
    <Ellipse
      id={annotation.id}
      x={annotation.x}
      y={annotation.y}
      radiusX={annotation.radiusX}
      radiusY={annotation.radiusY}
      fill={annotation.fill}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth}
      rotation={annotation.rotation}
      draggable={annotation.draggable}
      hitFunc={annotation.fill === 'transparent' ? hitFunc : undefined}
      onClick={(e) => {
        e.cancelBubble = true;
        setSelected(annotation.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        setSelected(annotation.id);
      }}
      onDragEnd={(e) => {
        updateAnnotation(annotation.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
}
