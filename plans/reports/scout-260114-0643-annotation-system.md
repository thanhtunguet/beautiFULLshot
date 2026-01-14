# BeautyShot Annotation System - Implementation Analysis

**Report Date:** 2026-01-14  
**Scope:** Complete annotation system architecture, capabilities, and select/edit/delete functionality  
**Status:** Phase 04 ✓ (Fully Implemented)

---

## Quick Summary

The annotation system is **fully implemented** with 8 annotation types, complete selection/editing/deletion, undo/redo support, and keyboard shortcuts. All shapes support transform (resize/rotate), drag, and deletion. The system uses Zustand state management with Konva rendering.

---

## Architecture Overview

### State Management
- **Primary Store:** `src/stores/annotation-store.ts` (220 LOC)
  - Manages annotations array, selection state, tool selection
  - Tool settings: stroke/fill colors, stroke width, font size/family
  - Number counter for numbered annotations
  - Undo/redo coordination with history store

- **History Store:** `src/stores/history-store.ts` (98 LOC)
  - Past/future stacks for undo/redo (max 50 snapshots)
  - Tracks both annotation and image state changes
  - Supports cross-store state restoration

### Rendering Layer
- **Canvas Rendering:** react-konva + Konva.js
- **Main Component:** `src/components/canvas/annotation-layer.tsx` (122 LOC)
  - Renders all annotations with type-based router
  - Attaches Transformer to selected annotation
  - Provides offset support for padding/aspect ratio extensions

### Event Handling
- **Drawing Hook:** `src/hooks/use-drawing.ts` (408 LOC)
  - Mouse down/move/up event handlers
  - Tool-specific creation logic
  - Preview shape rendering during draw
  - Text input positioning and submission
  - Handles coordinate transformation (stage → canvas → content)

---

## Supported Annotation Types

### 1. Rectangle
- **File:** `src/components/canvas/annotations/rect-shape.tsx`
- **Properties:** x, y, width, height, fill, stroke, strokeWidth, rotation
- **Interactions:** Draggable, transformable (resize/rotate), clickable selection
- **Transform Handler:** Custom resize with width/height scaling

### 2. Ellipse
- **File:** `src/components/canvas/annotations/ellipse-shape.tsx`
- **Properties:** x, y, radiusX, radiusY, fill, stroke, strokeWidth, rotation
- **Interactions:** Draggable, transformable, selectable
- **Transform Handler:** Radius scaling on resize

### 3. Line
- **File:** `src/components/canvas/annotations/arrow-shape.tsx`
- **Properties:** x, y, points (2 endpoints), stroke, strokeWidth, rotation
- **Interactions:** Draggable, selectable (no transform)
- **Note:** Uses Konva Line component

### 4. Arrow
- **File:** `src/components/canvas/annotations/arrow-shape.tsx`
- **Properties:** x, y, points, stroke, strokeWidth, pointerLength, pointerWidth, rotation
- **Interactions:** Draggable, selectable (no transform)
- **Note:** Uses Konva Arrow component with configurable pointer

### 5. Freehand
- **File:** `src/components/canvas/annotations/freehand-shape.tsx`
- **Properties:** x, y, points (multi-point path), stroke, strokeWidth, rotation
- **Interactions:** Draggable, selectable, tension/cap styling applied
- **Styling:** Rounded lineCap, rounded lineJoin, 0.5 tension for smooth curves

### 6. Text
- **File:** `src/components/canvas/annotations/text-shape.tsx`
- **Properties:** x, y, text, fontSize, fontFamily, fill, rotation
- **Interactions:** Draggable, transformable (resize changes fontSize), selectable
- **Input Overlay:** `src/components/canvas/text-input-overlay.tsx` (98 LOC)
- **Flow:** Click to activate text input → HTML overlay appears → Enter/blur submits → Tool switches to select

### 7. Numbered Annotation
- **File:** `src/components/canvas/annotations/number-shape.tsx`
- **Properties:** x, y, number, radius, fill, textColor, fontSize, rotation
- **Composition:** Group containing Circle (background) + Text (number)
- **Creation:** Click-to-place, auto-increments counter (1, 2, 3...)
- **Reset:** `resetNumberCounter()` resets to 1 (useful on new image)

### 8. Spotlight
- **File:** `src/components/canvas/annotations/spotlight-shape.tsx`
- **Properties:** x, y, width, height, shape ('rectangle' | 'ellipse'), rotation
- **Rendering:** 
  - SVG Shape with sceneFunc for even-odd fill rule
  - Creates dimmed overlay (rgba 0,0,0,0.5)
  - Cutout reveals spotlight area
  - Invisible Rect handle for interaction
- **Interactions:** Draggable, transformable, selectable
- **Styling:** White dashed border, 50% opacity dimmed area

---

## Selection & Editing Capabilities

### Selection
- **Entry Points:**
  - Click/tap on any annotation shape
  - Tool-specific: Select tool (V key)
  - Click empty canvas deselects in select mode
  
- **Visual Feedback:**
  - Selected annotation has Transformer attached
  - Transformer shows 8 corner/edge handles
  - Transformer enables rotation (rotateEnabled: true)
  - Minimum size constraints enforced (10px min)

- **State:**
  - `selectedId` tracks current selection in annotation-store
  - Single selection only (no multi-select)
  - Selection cleared on tool switch
  - Selection cleared on undo/redo

### Dragging
- **All annotations support dragging** (draggable: true)
- **Drag Handler:** onDragEnd updates x, y coordinates
- **Coordinate Space:** Proper offset handling for padding/aspect ratio
- **Persistence:** Drag updates saved to store immediately

### Transformation (Resize/Rotate)
- **Hook:** `src/hooks/use-transform-handler.ts` (98 LOC)
- **Shape-Specific Logic:**
  - **Rect/Spotlight:** width, height scaling
  - **Ellipse:** radiusX, radiusY scaling
  - **Text:** fontSize scaling on Y-axis
  - **Lines:** No transform support (not transformable)
  - **Freehand:** No transform support (not transformable)
  - **Numbers:** No transform support (not transformable)

- **Transform Constraints:**
  - Min size enforcement: 5px for shapes, 8px for text, 20px for spotlight
  - Scale reset after applying (node.scaleX(1), node.scaleY(1))
  - All updates trigger saveToHistory() for undo support

### Editing Text
- **Activation:** Click text annotation → TextInputOverlay appears
- **Input Features:**
  - Responsive width (measures text span)
  - Scaled font size during edit
  - Color matches annotation fill
  - Focus auto-applied
  - Max 500 char limit (in constants)

- **Submission:**
  - Enter key: submits text, switches to select tool
  - Blur: submits if non-empty, cancels if empty
  - Escape: cancels without saving
  - Tool automatically switches to 'select' after submission

---

## Deletion Capabilities

### Three Deletion Methods

1. **Delete Key / Backspace**
   - Only works if annotation is selected
   - `useKeyboardShortcuts` hook detects key press
   - Calls `deleteSelected()` in annotation-store
   - Saves to history before deletion

2. **Programmatic Deletion**
   - `deleteAnnotation(id)` in annotation-store
   - Removes from annotations array
   - Clears selection if deleted annotation was selected
   - Triggers saveToHistory for undo

3. **Select → Delete Flow**
   - User selects annotation (click or tool)
   - Press Delete/Backspace
   - Annotation removed, selection cleared

### Deletion Implementation
```typescript
// From annotation-store.ts
deleteAnnotation: (id) => {
  get().saveToHistory();  // Save before deletion
  set((state) => ({
    annotations: state.annotations.filter((a) => a.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  }));
}
```

---

## Undo/Redo System

### History Mechanism
- **Snapshot Timing:** Before every mutation (add, update, delete)
- **Stack Depth:** 50 snapshots max (configurable)
- **Content:** Annotations array + optional image data

### Keyboard Shortcuts
- `Cmd/Ctrl+Z` - Undo
- `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` - Redo
- Both shortcuts checked in useKeyboardShortcuts

### State Restoration
- **Undo:** Retrieves previous snapshot from past[], updates selectedId to null
- **Redo:** Retrieves next snapshot from future[], updates selectedId to null
- **Image Restore:** If snapshot contains image data, restores via callback
- **Clearing:** `clearAnnotations()` also clears history and resets number counter

---

## Tool System

### Tool Selection
- **Current Tool:** Tracked in annotation-store as `currentTool`
- **Tool Types:** 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'number' | 'spotlight'

### Tool Switching
- Keyboard shortcuts (V/R/E/L/A/T/F/S for respective tools)
- Programmatic: `setTool()` in annotation-store
- Side effect: Clears selectedId when switching tools
- Prevents mixing modes (can't drag while in rectangle tool)

### Tool-Specific Drawing
- **Draw Tools:** rectangle, ellipse, line, arrow, freehand, spotlight
  - Require mouse down → mouse move → mouse up sequence
  - ShowPreview shape while drawing
  - Create annotation on mouse up if meets min size (5px)

- **Click-Place Tools:** text, number
  - Single click places → shows input (text) or creates directly (number)
  - Number tool auto-increments counter

---

## Drawing Preview

### Preview Component
- **File:** `src/components/canvas/drawing-preview.tsx` (116 LOC)
- **Rendering:** Shows shape outline while dragging
- **Styling:** 60% opacity, dashed stroke, non-interactive
- **Supported:** rectangle, ellipse, line, arrow, spotlight
- **Not shown:** text, number, freehand (text has input overlay instead, number places immediately)

### Preview Coordinate Handling
- Reflects actual tool being used
- Accounts for offset from startPos to currentPos
- Ellipse: center-based rendering (x + width/2, y + height/2)
- Rectangle: corner-based rendering (x, y)

---

## Type System

### Annotation Type Definitions
**File:** `src/types/annotations.ts`

```typescript
type AnnotationType = 
  | 'rectangle' | 'ellipse' | 'line' | 'arrow' 
  | 'freehand' | 'text' | 'number' | 'spotlight'

type ToolType = AnnotationType | 'select'

// BaseAnnotation provides common props
interface BaseAnnotation {
  id: string (nanoid)
  type: AnnotationType
  x: number
  y: number
  rotation: number
  draggable: boolean
}

// Type-specific interfaces extend BaseAnnotation
```

### Constants
**File:** `src/constants/annotations.ts`
- Number defaults: radius 15, fontSize 14, textColor #ffffff
- Arrow defaults: pointerLength 10, pointerWidth 10
- Spotlight: opacity 0.5, dimmed color rgba(0,0,0,0.5)
- Transformer: min size 10px, min shape 5px, min spotlight 20px
- Text: max length 500 chars
- Shape: min draw size 5px

---

## Hooks Reference

### useDrawing
- **Purpose:** Core drawing event handling
- **Returns:** Handlers (handleMouseDown, handleMouseMove, handleMouseUp, handleStageClick), preview state, text input position
- **Usage:** Called by CanvasEditor for stage event binding
- **Key Logic:** Coordinate transformation, tool-specific creation, preview management

### useTransformHandler
- **Purpose:** Shared resize/rotate logic
- **Signature:** `useTransformHandler(annotationId, shapeType, context?)`
- **Returns:** onTransformEnd handler for shapes
- **Handles:** Width/height, radius, fontSize scaling with constraints

### useKeyboardShortcuts
- **Purpose:** Global keyboard event handling
- **Shortcuts Covered:**
  - Undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Y)
  - Delete (Delete/Backspace)
  - Tool selection (V/R/E/L/A/T/F/S)
  - Cancel (Escape)
  - Custom hotkeys from settings

---

## Data Flow Diagrams

### Creating an Annotation
```
Mouse down in draw mode
  → handleMouseDown
  → Start preview, set drawing state
  
Mouse move
  → handleMouseMove
  → Update preview shape
  
Mouse up
  → handleMouseUp
  → Validate min size
  → Create annotation via addAnnotation()
  → annotation-store adds to array + saves history
  → Renderer updates with new annotation
```

### Selecting & Editing
```
Click on annotation
  → RectShape.onClick → setSelected(id)
  → annotation-store updates selectedId
  → AnnotationLayer.useEffect re-attaches Transformer
  
User drags
  → onDragEnd → updateAnnotation(x, y)
  → Store updates, history saved
  
User resizes
  → Transformer.onTransformEnd → handleTransformEnd
  → Shape-specific scaling applied → updateAnnotation
```

### Text Annotation Editing
```
Click text annotation
  → handleMouseDown (tool !== 'text')
  → Pass through to existing text
  
Click text again with text tool active
  → handleMouseDown (tool === 'text')
  → Set textInputPos state
  → TextInputOverlay renders
  
User types → onChange updates text state
User presses Enter
  → submitText() creates TextAnnotation
  → addAnnotation() saves to store
  → setTool('select') switches tool
```

### Deletion
```
User selects annotation
  → selectedId set in store
  
User presses Delete/Backspace
  → useKeyboardShortcuts detects
  → deleteSelected() called
  → Annotation removed from array
  → selectedId cleared
  → History saved
  → Renderer updates
```

---

## Missing Capabilities

### Not Currently Implemented
1. **Multi-select** - Only single annotation selectable at once
2. **Copy/Paste** - No annotation duplication
3. **Group/Ungroup** - Annotations are independent
4. **Z-order Control** - Rendering order fixed (draw order in array)
5. **Layer Visibility Toggle** - All annotations always visible
6. **Edit by Double-Click** (except text) - Text requires active text tool
7. **Drag to Create Preview** - Some tools show preview, but not all consistently
8. **Touch Support** - onTap handlers present but no multi-touch

### Partial Implementations
1. **Transform Constraints:** Min size enforced but no aspect ratio lock option
2. **Text Editing:** Only possible with text tool active (no dbl-click edit mode)
3. **Arrow Customization:** Pointer dims fixed in constants (not per-instance settings)

---

## Integration Points

### Canvas Editor Integration
- **File:** `src/components/canvas/canvas-editor.tsx`
- Binding: useDrawing() → stage.on(mousedown/move/up)
- Drawing preview rendered in preview layer
- Text input overlay positioned relative to stage scale

### Toolbar Integration
- **File:** `src/components/toolbar/toolbar.tsx`
- Tool buttons trigger setTool() via useAnnotationStore
- Current tool state displayed as active button

### Export Integration
- **File:** `src/stores/export-store.ts`
- Annotations rendered before export
- All annotation layers flattened into output image

### History Integration
- **File:** `src/stores/history-store.ts`
- Called by annotation-store before mutations
- Cross-store callbacks for image restoration

---

## Performance Characteristics

### Rendering
- **Konva Optimization:** batchDraw() used for transformer updates
- **Layer Structure:** Single annotation layer with sub-components
- **Transformer Attachment:** Detached from non-selected shapes

### Memory
- **History Snapshots:** Deep copy of annotations array per snapshot (50 max)
- **ID Generation:** nanoid for unique IDs
- **Event Listeners:** Properly cleaned up on component unmount

### Scaling
- **Tested with:** Up to 50+ annotations (history depth limit)
- **Coordinate Transform:** Compensates for padding + aspect ratio extension
- **Minimum Sizes:** Prevent UI freeze from tiny shapes

---

## Code Quality Standards

### Naming
- Components: PascalCase (RectShape, AnnotationLayer)
- Stores: useAnnotationStore pattern
- Hooks: useDrawing, useTransformHandler, useKeyboardShortcuts
- Constants: UPPER_SNAKE_CASE

### Organization
- Types: `src/types/annotations.ts`
- Stores: `src/stores/annotation-store.ts`, history-store.ts
- Components: `src/components/canvas/annotations/*`, annotation-layer.tsx
- Hooks: `src/hooks/use-drawing.ts`, use-transform-handler.ts
- Constants: `src/constants/annotations.ts`

### Patterns
- Zustand for centralized state
- React hooks for event handling
- Konva event delegation (onClick, onDragEnd, onTransformEnd)
- History pattern with past/future stacks
- Type-based rendering router in AnnotationLayer

---

## File Manifest

### Core Files
| File | LOC | Purpose |
|------|-----|---------|
| `src/stores/annotation-store.ts` | 220 | Central state management |
| `src/stores/history-store.ts` | 98 | Undo/redo functionality |
| `src/components/canvas/annotation-layer.tsx` | 122 | Annotation rendering & transformer |
| `src/hooks/use-drawing.ts` | 408 | Event handling & creation |
| `src/hooks/use-transform-handler.ts` | 98 | Resize/rotate logic |
| `src/hooks/use-keyboard-shortcuts.ts` | 160 | Keyboard command binding |
| `src/types/annotations.ts` | 90 | Type definitions |
| `src/constants/annotations.ts` | 36 | Default values & constraints |

### Shape Components (8 files, ~70-90 LOC each)
- `rect-shape.tsx` - Rectangle component
- `ellipse-shape.tsx` - Ellipse component
- `arrow-shape.tsx` - Line and arrow component
- `freehand-shape.tsx` - Freehand drawing
- `text-shape.tsx` - Text annotation
- `number-shape.tsx` - Numbered annotation
- `spotlight-shape.tsx` - Spotlight/dimming effect

### UI Components
- `src/components/canvas/drawing-preview.tsx` (116 LOC) - Preview shapes during draw
- `src/components/canvas/text-input-overlay.tsx` (98 LOC) - Text input UI

---

## Summary Matrix

| Capability | Rectangle | Ellipse | Line | Arrow | Freehand | Text | Number | Spotlight |
|------------|-----------|---------|------|-------|----------|------|--------|-----------|
| **Create** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Select** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Drag** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Resize** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓* | ✗ | ✓ |
| **Rotate** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| **Edit** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **Delete** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Undo/Redo** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Text resize changes font size instead of bounding box

---

**Generated:** 2026-01-14  
**Codebase Version:** v1.0.0  
**Frontend Files Analyzed:** 12 core + 8 shape components + supporting utilities  
**Total Annotation System LOC:** ~1,300 (stores, components, hooks, types, constants)
