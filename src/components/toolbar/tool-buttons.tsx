// ToolButtons - Annotation tool selection buttons

import { useAnnotationStore } from '../../stores/annotation-store';
import type { ToolType } from '../../types/annotations';

interface Tool {
  type: ToolType;
  icon: React.ReactNode;
  label: string;
}

// SVG Icons for consistent styling
const SelectIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4l7.07 17 2.51-7.39L21 11.07 4 4z" />
  </svg>
);

const RectangleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="1" />
  </svg>
);

const EllipseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="9" ry="9" />
  </svg>
);

const LineIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="19" x2="19" y2="5" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="14 7 19 12 14 17" />
  </svg>
);

const TextIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 5v3h5.5v12h3V8H19V5H5z" />
  </svg>
);

const NumberIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none">1</text>
  </svg>
);

const FreehandIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
  </svg>
);

const SpotlightIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" stroke="none" />
  </svg>
);

const TOOLS: Tool[] = [
  { type: 'select', icon: <SelectIcon />, label: 'Select' },
  { type: 'rectangle', icon: <RectangleIcon />, label: 'Rectangle' },
  { type: 'ellipse', icon: <EllipseIcon />, label: 'Ellipse' },
  { type: 'line', icon: <LineIcon />, label: 'Line' },
  { type: 'arrow', icon: <ArrowIcon />, label: 'Arrow' },
  { type: 'text', icon: <TextIcon />, label: 'Text' },
  { type: 'number', icon: <NumberIcon />, label: 'Number' },
  { type: 'freehand', icon: <FreehandIcon />, label: 'Freehand' },
  { type: 'spotlight', icon: <SpotlightIcon />, label: 'Spotlight' },
];

export function ToolButtons() {
  const { currentTool, setTool } = useAnnotationStore();

  return (
    <div className="flex gap-1">
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          onClick={() => setTool(tool.type)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl text-base font-medium transition-all ${
            currentTool === tool.type
              ? 'glass-btn glass-btn-active text-orange-500'
              : 'glass-btn text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
          }`}
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={currentTool === tool.type}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
