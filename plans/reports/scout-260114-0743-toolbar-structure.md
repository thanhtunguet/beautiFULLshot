# Scout Report: Toolbar & Sidebar Structure Analysis

**Date**: 2026-01-14  
**Objective**: Identify main toolbar component, Background/Crop/Export structure, and existing tab patterns

---

## Key Files Found

### Main Components

#### Toolbar Component
- **Path**: `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/toolbar.tsx`
- **Purpose**: Main toolbar with capture buttons, undo/redo, annotation tools, and settings
- **Structure**:
  - Capture buttons group (fullscreen, region, window)
  - Clear button (conditional on image loaded)
  - Dividers (visual separators)
  - UndoRedoButtons component
  - ToolButtons component (annotation tools)
  - ToolSettings component (color/stroke width)
  - Settings button (opens SettingsModal)

#### Toolbar Sub-components
1. **ToolButtons**: `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/tool-buttons.tsx`
   - 9 tools: select, rectangle, ellipse, line, arrow, text, number, freehand, spotlight
   - Simple button array with state management via useAnnotationStore
   - No tab pattern used

2. **ToolSettings**: `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/tool-settings.tsx`
   - Color picker (8 preset colors)
   - Stroke width selector (3, 6, 9, 12, 15px)
   - Simple horizontal layout with no tabs

3. **UndoRedoButtons**: `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/undo-redo-buttons.tsx`
   - Standard undo/redo controls

### Sidebar Structure
- **Path**: `/Users/dcppsw/Projects/beautyshot/src/components/sidebar/sidebar.tsx`
- **Layout**: 3 main sections stacked vertically
  1. BackgroundPanel
  2. CropPanel
  3. ExportPanel

---

## Current Tab Implementation Pattern

### BackgroundPanel Uses Tab Pattern
- **File**: `/Users/dcppsw/Projects/beautyshot/src/components/sidebar/background-panel.tsx`
- **Tab Structure**:
  ```typescript
  type TabType = 'wallpaper' | 'gradient' | 'color' | 'image';
  ```
- **Implementation Details**:
  - Uses `useState<TabType>` for active tab state
  - Tab buttons in gray background container (lines 186-201)
  - Conditional rendering based on activeTab state
  - 4 main tabs:
    - **Wallpaper**: Grid of wallpaper presets with category filter
    - **Gradient**: 6-column grid of gradient presets
    - **Color**: Auto color, solid colors, and custom color picker
    - **Image**: Upload area with drag-and-drop, and image library

- **Tab Button Styling Pattern**:
  ```jsx
  <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
    {tabs.map((tab) => (
      <button
        className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
          activeTab === tab.id
            ? 'bg-gray-700 text-white dark:bg-gray-600'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
        }`}
      >
  ```

### CropPanel Simple Control
- **File**: `/Users/dcppsw/Projects/beautyshot/src/components/sidebar/crop-panel.tsx`
- **No tab pattern** - simple state toggle:
  - Before crop: "Start Crop" button
  - During crop: Aspect ratio presets, Apply/Cancel buttons
- **Aspect ratio buttons**: Grid of preset buttons (no tabs, just buttons)

### ExportPanel Simple Control
- **File**: `/Users/dcppsw/Projects/beautyshot/src/components/sidebar/export-panel.tsx`
- **No tab pattern** - simple control panels for:
  - Format selection (PNG/JPEG)
  - Quality slider (JPEG only)
  - Resolution selector (1x, 2x, 3x)
  - Output aspect ratio grid
  - Action buttons (Quick Save, Save As, Copy)

---

## Existing Store Architecture

### Background Store
- **Path**: `/Users/dcppsw/Projects/beautyshot/src/stores/background-store.ts`
- Manages:
  - Type: 'wallpaper' | 'gradient' | 'solid' | 'transparent' | 'auto' | 'image'
  - Wallpaper, gradient, color selections
  - Blur, shadow, corner radius, padding
  - Custom image and library management

### Crop Store
- **Path**: `/Users/dcppsw/Projects/beautyshot/src/stores/crop-store.ts`
- Manages:
  - Crop state (isCropping, cropRect, aspectRatio)
  - Start/apply/cancel crop operations

### Export Store
- **Path**: `/Users/dcppsw/Projects/beautyshot/src/stores/export-store.ts`
- Manages:
  - Format (png/jpeg)
  - Quality, resolution, output aspect ratio

---

## Design Pattern Summary

### Tab Pattern (Used in BackgroundPanel)
- **Trigger**: `setActiveTab(tab)`
- **State**: `activeTab: TabType`
- **Rendering**: Conditional `{activeTab === 'X' && <content />}`
- **Button Style**: Full-width flex container with gray background
- **Visual Feedback**: Active tab = darker background + white text

### Button Grid Pattern (Used across all panels)
- Simple button arrays without tabs
- Grid layout with Tailwind classes (grid-cols-2, grid-cols-4, grid-cols-6)
- Active state = blue ring/background

---

## Unresolved Questions

1. Should new toolbar sections follow the existing ToolButtons/ToolSettings pattern or adopt a tab-based design like BackgroundPanel?
2. Are there performance considerations with the nested category filter in BackgroundPanel's wallpaper tab?
3. What's the preferred button width for toolbar sections - should they maintain consistent sizing?

