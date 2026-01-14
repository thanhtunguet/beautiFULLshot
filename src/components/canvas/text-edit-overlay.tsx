// TextEditOverlay - Edit existing text annotations via double-click

import { useRef, useEffect, useState } from 'react';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useBackgroundStore } from '../../stores/background-store';
import { useExportStore } from '../../stores/export-store';
import { calculateAspectRatioExtend } from '../../utils/export-utils';
import type { TextAnnotation } from '../../types/annotations';

export function TextEditOverlay() {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState(50);
  const [isReady, setIsReady] = useState(false);

  const { editingTextId, annotations, updateTextContent, setEditingTextId } = useAnnotationStore();
  const { scale, position, originalWidth, originalHeight } = useCanvasStore();
  const { getPaddingPx } = useBackgroundStore();
  const { outputAspectRatio } = useExportStore();

  const annotation = annotations.find(
    (a) => a.id === editingTextId && a.type === 'text'
  ) as TextAnnotation | undefined;

  const [text, setText] = useState('');

  // Initialize text when annotation changes
  useEffect(() => {
    if (annotation) {
      setText(annotation.text);
      setIsReady(false);
    }
  }, [annotation?.id]);

  // Focus input on mount
  useEffect(() => {
    if (annotation) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [annotation?.id]);

  // Update input width based on text content
  useEffect(() => {
    if (measureRef.current && annotation) {
      const width = measureRef.current.offsetWidth;
      setInputWidth(Math.max(50, width + 10));
    }
  }, [text, annotation?.fontSize, scale]);

  if (!annotation || !editingTextId) {
    return null;
  }

  const padding = getPaddingPx(originalWidth, originalHeight);

  // Calculate aspect ratio offset
  const baseWidth = originalWidth + padding * 2;
  const baseHeight = originalHeight + padding * 2;
  const aspectExtension = calculateAspectRatioExtend(baseWidth, baseHeight, outputAspectRatio);
  const contentOffsetX = aspectExtension?.offsetX || 0;
  const contentOffsetY = aspectExtension?.offsetY || 0;

  // Calculate screen position from canvas coordinates
  const canvasX = annotation.x + padding + contentOffsetX;
  const canvasY = annotation.y + padding + contentOffsetY;
  const screenX = canvasX * scale + position.x;
  const screenY = canvasY * scale + position.y;

  const scaledFontSize = annotation.fontSize * scale;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateTextContent(editingTextId, text);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTextId(null);
    }
  };

  const handleBlur = () => {
    if (!isReady) return;
    updateTextContent(editingTextId, text);
  };

  return (
    <div
      className="absolute z-50 pointer-events-auto"
      style={{
        left: screenX - 4,
        top: screenY - 2,
      }}
    >
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className="absolute invisible whitespace-pre"
        style={{
          fontSize: `${scaledFontSize}px`,
          fontFamily: annotation.fontFamily,
        }}
      >
        {text || ' '}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="px-1 py-0.5 border-2 border-blue-500 rounded outline-none bg-white dark:bg-gray-800"
        style={{
          fontSize: `${scaledFontSize}px`,
          fontFamily: annotation.fontFamily,
          color: annotation.fill,
          width: `${inputWidth}px`,
        }}
      />
    </div>
  );
}
