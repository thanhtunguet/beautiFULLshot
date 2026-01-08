// TextInputOverlay - In-canvas text input for text annotations

import { useRef, useEffect, useState } from 'react';
import { useAnnotationStore } from '../../stores/annotation-store';

interface Props {
  position: { x: number; y: number; screenX: number; screenY: number };
  scale: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function TextInputOverlay({
  position,
  scale,
  onSubmit,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState('');
  const [inputWidth, setInputWidth] = useState(20);
  const [isReady, setIsReady] = useState(false);
  const { fontSize, strokeColor } = useAnnotationStore();

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      setIsReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (measureRef.current) {
      const width = measureRef.current.offsetWidth;
      setInputWidth(Math.max(8, width + 2));
    }
  }, [text, fontSize, scale]);

  const screenX = position.screenX - 10;
  const screenY = position.screenY - 4;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(text);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const scaledFontSize = fontSize * scale;

  return (
    <div
      className="absolute z-50"
      style={{
        left: screenX,
        top: screenY,
      }}
    >
      <span
        ref={measureRef}
        className="absolute invisible whitespace-pre"
        style={{
          fontSize: `${scaledFontSize}px`,
          fontFamily: 'inherit',
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
        onBlur={() => {
          if (!isReady) return;
          if (text.trim()) {
            onSubmit(text);
          } else {
            onCancel();
          }
        }}
        className="px-2 py-0.5 border-2 border-blue-500 rounded outline-none bg-white dark:bg-gray-800 dark:text-white box-content"
        style={{
          fontSize: `${scaledFontSize}px`,
          color: strokeColor,
          width: `${inputWidth}px`,
        }}
      />
    </div>
  );
}
