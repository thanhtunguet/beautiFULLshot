// RectShape - Rectangle annotation component

import { Rect } from 'react-konva';
import type Konva from 'konva';
import type { RectAnnotation } from '../../../types/annotations';
import { useAnnotationStore } from '../../../stores/annotation-store';
import { useTransformHandler } from '../../../hooks/use-transform-handler';

interface Props {
  annotation: RectAnnotation;
}

export function RectShape({ annotation }: Props) {
  const { updateAnnotation, setSelected } = useAnnotationStore();
  const handleTransformEnd = useTransformHandler(annotation.id, 'rect');

  // Custom hit function for transparent fills - ensures clicks inside shape register
  const hitFunc = (context: Konva.Context, shape: Konva.Shape) => {
    context.beginPath();
    context.rect(0, 0, annotation.width, annotation.height);
    context.closePath();
    context.fillStrokeShape(shape);
  };

  return (
    <Rect
      id={annotation.id}
      x={annotation.x}
      y={annotation.y}
      width={annotation.width}
      height={annotation.height}
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
