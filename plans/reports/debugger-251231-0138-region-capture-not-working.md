# Debug Report: Region Capture Button Not Working

**Date**: 2025-12-31
**Issue**: Purple "Capture Region" button shows alert instead of region selection UI
**Status**: ROOT CAUSE IDENTIFIED - FEATURE NOT IMPLEMENTED

## Executive Summary

Region capture button is **intentionally placeholder** - displays alert message directing users to use Crop tool instead. No region selection UI exists. Backend Rust command `capture_region` exists and works, but frontend lacks:
1. Interactive region selection overlay
2. Click handler to show selection UI
3. Crosshair cursor during selection
4. Region coordinates capture mechanism

**Business Impact**: Users cannot capture screen regions directly - must capture fullscreen then crop manually.

## Root Cause

**File**: `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/toolbar.tsx` (lines 119-130)

### Current Implementation

```tsx
{/* Region capture button */}
<button
  onClick={() => alert('Region capture: Use Crop tool after taking a fullscreen capture')}
  disabled={loading}
  aria-label="Capture screen region"
  title="Capture Region"
  className="w-10 h-10 flex items-center justify-center bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
>
  {/* Corner brackets icon */}
</button>
```

**Problem**: Click handler shows alert (line 121) - no actual functionality implemented.

### Why Nothing Happens (from user perspective)

1. User clicks purple region button
2. Alert dialog appears with message: "Region capture: Use Crop tool after taking a fullscreen capture"
3. User dismisses alert
4. **No crosshair cursor**
5. **No region selection overlay**
6. **No capture occurs**

User expects:
- App window hides
- Crosshair cursor appears
- User drags to select region
- Screenshot captured
- App shows with region screenshot

## Technical Analysis

### Backend (Rust) - FULLY IMPLEMENTED ✓

**File**: `/Users/dcppsw/Projects/beautyshot/src-tauri/src/screenshot.rs` (lines 63-90)

```rust
#[tauri::command]
pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or("No primary monitor")?;

    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    // Validate region bounds (lines 74-84)
    // Crop to region (line 87)
    let cropped = image::imageops::crop_imm(&image, start_x, start_y, crop_width, crop_height).to_image();

    image_to_base64_png(&cropped)
}
```

**Status**: Works correctly, registered in `lib.rs` (line 43), ready to use.

### API Layer - IMPLEMENTED ✓

**File**: `/Users/dcppsw/Projects/beautyshot/src/utils/screenshot-api.ts` (lines 38-46)

```typescript
export async function captureRegion(region: CaptureRegion): Promise<Uint8Array> {
  const base64 = await invoke<string>("capture_region", {
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  });
  return base64ToBytes(base64);
}
```

Also has helper wrapper with window hiding (lines 146-148):
```typescript
export async function captureRegionHidden(region: CaptureRegion): Promise<Uint8Array> {
  return captureWithHiddenWindow(() => captureRegion(region));
}
```

**Status**: API ready, needs region coordinates from user input.

### React Hook - IMPLEMENTED ✓

**File**: `/Users/dcppsw/Projects/beautyshot/src/hooks/use-screenshot.ts` (lines 69-85)

```typescript
const captureRegion = useCallback(
  async (region: CaptureRegion): Promise<Uint8Array | null> => {
    setLoading(true);
    setError(null);
    try {
      // Use hidden capture to exclude app window from screenshot
      const bytes = await api.captureRegionHidden(region);
      return bytes;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  },
  []
);
```

**Status**: Hook ready, returns in `UseScreenshotReturn` interface (line 22).

### Frontend UI - NOT IMPLEMENTED ✗

**Missing Components**:

1. **Region Selection Overlay**
   - Fullscreen transparent overlay
   - Mouse event handlers (mousedown, mousemove, mouseup)
   - Visual selection rectangle
   - Crosshair cursor
   - Escape key to cancel

2. **Selection State Management**
   - Track selection start/end coordinates
   - Calculate region bounds
   - Validate minimum region size
   - Store region for capture

3. **Integration with Toolbar**
   - Replace alert with region selection trigger
   - Show overlay when button clicked
   - Hide app window before showing overlay
   - Capture region on selection complete
   - Pass bytes to canvas store

## Evidence Chain

### Working Features (Comparison)

**Fullscreen Capture** (lines 71-84):
```tsx
const handleCaptureFullscreen = useCallback(async () => {
  triggerFeedback(); // Sound + flash
  const bytes = await captureFullscreen();
  if (bytes) {
    const { width, height } = await getImageDimensions(bytes);
    setImageFromBytes(bytes, width, height);
    setTimeout(() => fitToView(), 50);
  }
}, [captureFullscreen, setImageFromBytes, fitToView, triggerFeedback]);
```

**Window Capture** (lines 86-100):
- Similar pattern to fullscreen
- Dropdown shows window list (FIXED in previous investigation - now uses `fixed` positioning)
- User selects window from dropdown
- Window captured and displayed

**Region Capture**:
- ❌ No handler implementation
- ❌ No UI for region selection
- ❌ Just shows alert
- ✅ Backend works
- ✅ API works
- ✅ Hook works

## Current Workaround

Alert message suggests: "Use Crop tool after taking a fullscreen capture"

**Flow**:
1. User clicks blue fullscreen button
2. Fullscreen captured
3. User uses annotation crop tool to select region
4. User exports cropped image

**Limitations**:
- Extra steps required
- Less intuitive than direct region capture
- Cannot pre-select region before capture
- Fullscreen capture may include sensitive info temporarily

## Missing Implementation Details

### Required Files/Components

1. **Region Selection Overlay Component** (NEW)
   - Path: `src/components/region-selector.tsx`
   - Fullscreen overlay with selection rectangle
   - Mouse drag handlers
   - Coordinate tracking

2. **Region Selection Hook** (NEW)
   - Path: `src/hooks/use-region-selector.ts`
   - State management for selection
   - Coordinate calculation
   - Region validation

3. **Toolbar Integration** (MODIFY)
   - Path: `src/components/toolbar/toolbar.tsx`
   - Replace alert with overlay trigger
   - Handle region selection complete
   - Process captured bytes

### Implementation Flow (Recommended)

```
User clicks purple button
  ↓
Hide app window
  ↓
Show fullscreen overlay with crosshair cursor
  ↓
User drags to select region
  ↓
Capture coordinates (x, y, width, height)
  ↓
Hide overlay
  ↓
Call captureRegionHidden(region)
  ↓
Get PNG bytes
  ↓
Show app window
  ↓
Display screenshot in canvas
```

### Technical Challenges

1. **Fullscreen Overlay Display**
   - Must be truly fullscreen (cover entire screen, not just app window)
   - May require separate Tauri window or OS-level overlay
   - Tauri window in fullscreen mode with transparent background?

2. **App Window Hiding**
   - Must hide before showing overlay
   - Cannot use React overlay within app window (would be limited to app bounds)
   - Need Tauri API to create overlay window

3. **Coordinate System**
   - Overlay window coordinates vs screen coordinates
   - DPI scaling considerations
   - Multi-monitor support

4. **User Experience**
   - Visual feedback during selection
   - Minimum selection size enforcement
   - Cancel action (ESC key)
   - Instructions/hints display

## Recommended Fix Approach

### Option 1: Tauri Overlay Window (Recommended for native feel)

1. Create new Tauri window in Rust backend
2. Set window properties:
   - Fullscreen: true
   - Transparent: true
   - Always on top: true
   - Decorations: false
3. Load React component with selection UI
4. Capture mouse events in Rust
5. Return coordinates to main window
6. Close overlay window
7. Call capture_region with coordinates

**Complexity**: High
**Quality**: Best (native performance, true fullscreen)

### Option 2: Electron-style Overlay (Easier implementation)

1. Create fullscreen Tauri window (not transparent)
2. Render selection UI in React
3. Capture region screenshot on selection
4. Return to main window with image

**Complexity**: Medium
**Quality**: Good (works well, slight visual transition)

### Option 3: Use Existing Crop Tool (Current workaround)

Keep alert message, improve crop tool discoverability.

**Complexity**: None
**Quality**: Acceptable (workaround exists)

## Related Files

- `/Users/dcppsw/Projects/beautyshot/src/components/toolbar/toolbar.tsx` - Button implementation (line 119-130)
- `/Users/dcppsw/Projects/beautyshot/src/utils/screenshot-api.ts` - API ready (line 38-46, 146-148)
- `/Users/dcppsw/Projects/beautyshot/src/hooks/use-screenshot.ts` - Hook ready (line 69-85)
- `/Users/dcppsw/Projects/beautyshot/src-tauri/src/screenshot.rs` - Backend ready (line 63-90)
- `/Users/dcppsw/Projects/beautyshot/src-tauri/src/lib.rs` - Command registered (line 43)
- `/Users/dcppsw/Projects/beautyshot/src/types/screenshot.ts` - CaptureRegion interface (line 23-28)

## Git Status

Modified files (not related to this issue):
- Various component/store updates
- New clipboard.rs module
- Capture feedback hooks
- Background panel changes

No WIP region selector implementation found.

## Unresolved Questions

1. Should region selector be implemented as separate Tauri window or in-app overlay?
2. Multi-monitor support - which monitor to show selection overlay?
3. Should selection show live preview of region being selected?
4. Minimum region size validation (e.g., 10x10 pixels)?
5. Should coordinates be saved for "repeat last region" feature?
6. Integration with capture feedback (sound/flash) - before or after selection?
7. Accessibility - keyboard-only region selection support?
8. Mobile/touch support needed (app is Tauri desktop app)?
