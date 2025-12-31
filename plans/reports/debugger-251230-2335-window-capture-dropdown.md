# Debug Report: Window Capture Dropdown Not Visible

**Date**: 2025-12-30  
**Issue**: Green "Capture Window" button dropdown not showing when clicked  
**Status**: ROOT CAUSE IDENTIFIED

## Summary

Dropdown renders but is **clipped/hidden** by parent toolbar's `overflow-x-auto` CSS property. The dropdown uses absolute positioning (`position: absolute`) which extends outside the toolbar's boundaries, but `overflow-x-auto` creates a clipping context that hides content beyond the container in both X and Y axes.

## Root Cause

**File**: `src/components/toolbar/toolbar.tsx`

### Problem Chain
1. Toolbar container (line 96):
   ```tsx
   <div className="... overflow-x-auto">
   ```
   - `overflow-x-auto` enables horizontal scrolling
   - **Side effect**: Also clips content in Y-axis

2. Dropdown parent (line 126):
   ```tsx
   <div ref={dropdownRef} className="relative">
   ```
   - Creates positioning context

3. Dropdown (line 142-146):
   ```tsx
   <div className="absolute top-full mt-2 left-0 ... z-10">
   ```
   - Positions below parent using `top-full`
   - **Gets clipped** by toolbar's overflow property
   - `z-10` is irrelevant - stacking context doesn't help with clipping

### Why It Fails
- `overflow-x-auto` on toolbar creates **overflow clipping context**
- Absolute positioned dropdown extends **outside toolbar bounds**
- Browser clips dropdown even though `z-index` is set
- User sees button, clicks it, nothing appears (dropdown is rendered but invisible)

## Evidence

**Component Structure**:
```
<div className="overflow-x-auto">  ← Toolbar (clips children)
  <div className="relative">        ← Dropdown container
    <button />                       ← Green button (visible)
    <div className="absolute top-full z-10">  ← Dropdown (CLIPPED)
      {windows.map(...)}
    </div>
  </div>
</div>
```

**Recent Changes** (git diff HEAD~1):
- Added loading/empty/error states (lines 147-161)
- States work correctly
- UI rendering logic is sound
- **CSS clipping is the blocker**

## Technical Details

### Rust Backend (`src-tauri/src/screenshot.rs`)
- `get_windows()` command (lines 93-114) - **WORKING**
- Returns `Vec<WindowInfo>` with window details
- Filters out empty titles (line 100-102)

### Frontend API (`src/utils/screenshot-api.ts`)
- `getWindows()` (lines 62-64) - **WORKING**
- Invokes Tauri command via IPC
- Returns `Promise<WindowInfo[]>`

### Hook (`src/hooks/use-screenshot.ts`)
- `getWindows` callback (lines 104-106) - **WORKING**
- Wraps API call

### Toolbar Component (`src/components/toolbar/toolbar.tsx`)
- State management (lines 40-44) - **WORKING**
- Window fetching effect (lines 52-64) - **WORKING**
- Loading/error/empty states (lines 147-161) - **WORKING**
- **Rendering occurs but is invisible**

## Solutions

### Option 1: Use `overflow-x-auto overflow-y-visible` (Recommended)
```tsx
// Line 96
<div className="... overflow-x-auto overflow-y-visible">
```
**Pros**: Simple, allows dropdown to extend below toolbar  
**Cons**: May not work in all browsers (overflow-y can be auto-computed)

### Option 2: Remove dropdown from overflow context (Portal)
Create dropdown outside toolbar using React Portal:
```tsx
{showWindows && ReactDOM.createPortal(
  <div className="fixed ...">...</div>,
  document.body
)}
```
**Pros**: Guaranteed to work, clean separation  
**Cons**: More complex, need to calculate position manually

### Option 3: Change toolbar overflow behavior
Replace `overflow-x-auto` with custom scrolling logic or remove it if not needed.

**Pros**: Fixes root issue  
**Cons**: May break horizontal scroll if toolbar content is wide

### Option 4: Position dropdown inside toolbar with `overflow-y-visible`
Use `max-height` on dropdown and scroll within it:
```tsx
<div className="absolute left-0 w-64 max-h-60 overflow-y-auto ...">
```
**Pros**: Simple fix  
**Cons**: Dropdown may be cut off if toolbar is short

## Recommended Fix

**Approach**: Option 2 (Portal) - Most robust solution

1. Change dropdown positioning from `absolute` to `fixed`
2. Calculate position relative to button using `ref.current.getBoundingClientRect()`
3. Portal dropdown to `document.body` to escape overflow context

**Alternative**: If toolbar doesn't need horizontal scroll, remove `overflow-x-auto` entirely.

## Unresolved Questions

1. Does toolbar actually need `overflow-x-auto`? Check on small screens.
2. Should dropdown position be recalculated on window resize?
3. Any accessibility concerns with portal approach (ARIA, focus management)?
