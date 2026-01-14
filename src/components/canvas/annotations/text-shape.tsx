// TextShape - Text annotation component with double-click editing

import { Text } from 'react-konva';
import type { TextAnnotation } from '../../../types/annotations';
import { useAnnotationStore } from '../../../stores/annotation-store';
import { useTransformHandler } from '../../../hooks/use-transform-handler';

interface Props {
  annotation: TextAnnotation;
}

export function TextShape({ annotation }: Props) {
  const { updateAnnotation, setSelected, setEditingTextId, editingTextId } = useAnnotationStore();
  const handleTransformEnd = useTransformHandler(annotation.id, 'text', {
    fontSize: annotation.fontSize,
  });

  // Hide text when editing (overlay will show input)
  if (editingTextId === annotation.id) {
    return null;
  }

  return (
    <Text
      id={annotation.id}
      x={annotation.x}
      y={annotation.y}
      text={annotation.text}
      fontSize={annotation.fontSize}
      fontFamily={annotation.fontFamily}
      fill={annotation.fill}
      rotation={annotation.rotation}
      draggable={annotation.draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        setSelected(annotation.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        setSelected(annotation.id);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        setEditingTextId(annotation.id);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        setEditingTextId(annotation.id);
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
