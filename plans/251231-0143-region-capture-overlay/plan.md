---
title: "Fullscreen Dimmed Overlay Region Capture"
description: "Add interactive fullscreen overlay for selecting screen regions with crosshair cursor and visual feedback"
status: pending
priority: P1
effort: 6h
branch: main
tags: [feature, screenshot, overlay, tauri-window]
created: 2025-12-31
---

# Fullscreen Dimmed Overlay Region Capture

## Overview

Implement interactive region selection using a fullscreen transparent overlay window. User clicks region capture button, main app hides, overlay appears with crosshair cursor for drag-selection, then captures selected region.

## Architecture Decision

**Approach: Separate Overlay Window (React + Tauri)**

Why not pure-Rust overlay:
- Tauri already has React webview infrastructure
- Consistent styling with existing app
- Easier to maintain (single codebase)
- Crosshair cursor + visual feedback simpler in CSS/Canvas

Why not native OS selection (like macOS screencapture -i):
- Not cross-platform
- Less control over UX
- Inconsistent with app design

## Technical Flow

```
1. User clicks Region Capture button
2. Main window hides
3. Capture fullscreen screenshot (base64) → store temporarily
4. Create overlay window (fullscreen, transparent, always-on-top)
5. Display screenshot as background with dim overlay
6. User draws selection rectangle
7. ESC → close overlay, show main window
8. Mouse release → get coordinates, close overlay
9. Crop captured image using coordinates
10. Show main window with cropped screenshot
```

## Implementation Phases

---

### Phase 1: Overlay Window Infrastructure (2h)

**Goal:** Create and manage overlay window from Rust backend

#### 1.1 Rust: Overlay Window Commands

File: `src-tauri/src/overlay.rs` (new)

```rust
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, LogicalPosition, LogicalSize};

/// Create fullscreen transparent overlay window
#[tauri::command]
pub async fn create_overlay_window(app: AppHandle) -> Result<(), String> {
    // Get primary monitor dimensions
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = monitors.iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or(monitors.first())
        .ok_or("No monitor found")?;

    let size = primary.size();
    let position = primary.position();

    // Create overlay window
    WebviewWindowBuilder::new(
        &app,
        "region-overlay",
        WebviewUrl::App("overlay.html".into())
    )
    .title("Region Selection")
    .inner_size(size.width as f64, size.height as f64)
    .position(position.x as f64, position.y as f64)
    .fullscreen(false)  // Manual fullscreen via size
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close overlay window
#[tauri::command]
pub async fn close_overlay_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-overlay") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get primary monitor info for overlay sizing
#[tauri::command]
pub fn get_primary_monitor_info(app: AppHandle) -> Result<MonitorBounds, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = monitors.iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or(monitors.first())
        .ok_or("No monitor found")?;

    let size = primary.size();
    let position = primary.position();
    let scale = primary.scale_factor();

    Ok(MonitorBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        scale_factor: scale,
    })
}

#[derive(serde::Serialize)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}
```

#### 1.2 Register Commands

File: `src-tauri/src/lib.rs`

```rust
mod overlay;

// Add to invoke_handler:
overlay::create_overlay_window,
overlay::close_overlay_window,
overlay::get_primary_monitor_info,
```

#### 1.3 Overlay HTML Entry Point

File: `overlay.html` (new, at project root)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Region Selection</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/overlay-main.tsx"></script>
</body>
</html>
```

#### 1.4 Vite Config Update

File: `vite.config.ts`

```typescript
// Add to rollupOptions.input:
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      overlay: 'overlay.html',
    },
    // ... existing output config
  },
},
```

#### 1.5 Tauri Config Update

File: `src-tauri/tauri.conf.json`

Update `app.security.csp` to allow overlay:
```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost blob:; connect-src ipc: http://ipc.localhost"
}
```

---

### Phase 2: Overlay React Component (2h)

**Goal:** Build region selection UI with crosshair cursor and selection rectangle

#### 2.1 Overlay Entry Point

File: `src/overlay-main.tsx` (new)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RegionOverlay } from './components/region-overlay';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RegionOverlay />
  </React.StrictMode>
);
```

#### 2.2 Region Overlay Component

File: `src/components/region-overlay.tsx` (new)

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function RegionOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load screenshot passed from main window
  useEffect(() => {
    const loadScreenshot = async () => {
      // Screenshot data is passed via window.__SCREENSHOT_DATA__
      const data = (window as any).__SCREENSHOT_DATA__;
      if (data) {
        setScreenshotUrl(data);
      }
    };
    loadScreenshot();
  }, []);

  // Handle ESC to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cancelSelection = useCallback(async () => {
    await emit('region-selection-cancelled');
    const win = getCurrentWindow();
    await win.close();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsSelecting(true);
    setSelection({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selection) return;
    setSelection(prev => prev ? {
      ...prev,
      endX: e.clientX,
      endY: e.clientY,
    } : null);
  }, [isSelecting, selection]);

  const handleMouseUp = useCallback(async () => {
    if (!isSelecting || !selection) return;
    setIsSelecting(false);

    // Calculate normalized rectangle (handle drag in any direction)
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    // Minimum selection size
    if (width < 10 || height < 10) {
      cancelSelection();
      return;
    }

    // Emit selection coordinates to main window
    await emit('region-selected', { x, y, width, height });

    const win = getCurrentWindow();
    await win.close();
  }, [isSelecting, selection, cancelSelection]);

  // Calculate selection box style
  const getSelectionStyle = (): React.CSSProperties => {
    if (!selection) return { display: 'none' };

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    return {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      border: '2px dashed #fff',
      backgroundColor: 'transparent',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
      pointerEvents: 'none',
    };
  };

  return (
    <div
      ref={containerRef}
      className="region-overlay-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'crosshair',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        userSelect: 'none',
      }}
    >
      {/* Screenshot background (optional - for reference) */}
      {screenshotUrl && (
        <img
          src={screenshotUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Selection rectangle */}
      <div style={getSelectionStyle()} />

      {/* Instructions */}
      {!isSelecting && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: 14,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          Drag to select region · ESC to cancel
        </div>
      )}

      {/* Selection dimensions tooltip */}
      {isSelecting && selection && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(selection.startX, selection.endX),
            top: Math.min(selection.startY, selection.endY) - 28,
            color: '#fff',
            fontSize: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          {Math.abs(selection.endX - selection.startX)} × {Math.abs(selection.endY - selection.startY)}
        </div>
      )}
    </div>
  );
}
```

---

### Phase 3: Integration with Main App (1.5h)

**Goal:** Wire up toolbar button to trigger overlay flow and handle results

#### 3.1 Screenshot API Extension

File: `src/utils/screenshot-api.ts`

Add new functions:

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';

interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale_factor: number;
}

/**
 * Get primary monitor bounds for overlay positioning
 */
export async function getPrimaryMonitorInfo(): Promise<MonitorBounds> {
  return await invoke<MonitorBounds>("get_primary_monitor_info");
}

/**
 * Start region capture flow with overlay
 * Returns selected region coordinates or null if cancelled
 */
export async function startRegionCapture(): Promise<CaptureRegion | null> {
  const appWindow = getCurrentWindow();

  // Hide main window
  await appWindow.hide();
  await delay(HIDE_DELAY_MS);

  return new Promise(async (resolve) => {
    // Listen for selection result
    const unlistenSelected = await listen<CaptureRegion>('region-selected', (event) => {
      cleanup();
      resolve(event.payload);
    });

    const unlistenCancelled = await listen('region-selection-cancelled', () => {
      cleanup();
      resolve(null);
    });

    const cleanup = async () => {
      unlistenSelected();
      unlistenCancelled();
      // Show main window
      await appWindow.show();
      await appWindow.setFocus();
    };

    // Create overlay window
    try {
      await invoke('create_overlay_window');
    } catch (e) {
      cleanup();
      throw e;
    }
  });
}

/**
 * Capture region with interactive overlay selection
 */
export async function captureRegionInteractive(): Promise<Uint8Array | null> {
  // Get region from overlay
  const region = await startRegionCapture();
  if (!region) return null;

  // Capture the selected region
  const base64 = await invoke<string>("capture_region", {
    x: Math.round(region.x),
    y: Math.round(region.y),
    width: Math.round(region.width),
    height: Math.round(region.height),
  });

  return base64ToBytes(base64);
}
```

#### 3.2 useScreenshot Hook Update

File: `src/hooks/use-screenshot.ts`

Add new method:

```typescript
import * as api from "../utils/screenshot-api";

// Add to UseScreenshotReturn interface:
captureRegionInteractive: () => Promise<Uint8Array | null>;

// Add to hook implementation:
const captureRegionInteractive = useCallback(async (): Promise<Uint8Array | null> => {
  setLoading(true);
  setError(null);
  try {
    const bytes = await api.captureRegionInteractive();
    return bytes;
  } catch (e) {
    setError(String(e));
    return null;
  } finally {
    setLoading(false);
  }
}, []);

// Add to return:
captureRegionInteractive,
```

#### 3.3 Toolbar Integration

File: `src/components/toolbar/toolbar.tsx`

Update region capture button handler:

```tsx
// Import
const { captureFullscreen, captureWindow, captureRegionInteractive, getWindows, loading, error, waylandWarning } = useScreenshot();

// Add handler
const handleCaptureRegion = useCallback(async () => {
  const bytes = await captureRegionInteractive();
  if (bytes) {
    try {
      triggerFeedback();
      const { width, height } = await getImageDimensions(bytes);
      setImageFromBytes(bytes, width, height);
      setTimeout(() => fitToView(), 50);
    } catch (e) {
      logError('Toolbar:captureRegion', e);
    }
  }
}, [captureRegionInteractive, setImageFromBytes, fitToView, triggerFeedback]);

// Update button onClick:
<button
  onClick={handleCaptureRegion}
  disabled={loading}
  // ... rest unchanged
>
```

---

### Phase 4: DPI Scaling & Polish (0.5h)

**Goal:** Handle high-DPI displays correctly and add visual polish

#### 4.1 DPI-Aware Coordinate Conversion

File: `src/components/region-overlay.tsx`

Add scale factor handling:

```typescript
const [scaleFactor, setScaleFactor] = useState(1);

useEffect(() => {
  const getScaleFactor = async () => {
    const win = getCurrentWindow();
    const factor = await win.scaleFactor();
    setScaleFactor(factor);
  };
  getScaleFactor();
}, []);

// In handleMouseUp, convert logical to physical pixels:
const physicalX = Math.round(x * scaleFactor);
const physicalY = Math.round(y * scaleFactor);
const physicalWidth = Math.round(width * scaleFactor);
const physicalHeight = Math.round(height * scaleFactor);

await emit('region-selected', {
  x: physicalX,
  y: physicalY,
  width: physicalWidth,
  height: physicalHeight
});
```

#### 4.2 Visual Enhancements

- Crosshair cursor on selection start
- Animated selection border (subtle pulse)
- Corner resize handles (visual only for v1)
- Smooth fade-in on overlay appear

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/overlay.rs` | Create | Rust commands for overlay window |
| `src-tauri/src/lib.rs` | Modify | Register overlay module |
| `overlay.html` | Create | HTML entry for overlay window |
| `vite.config.ts` | Modify | Multi-page build config |
| `src-tauri/tauri.conf.json` | Modify | CSP for blob URLs |
| `src/overlay-main.tsx` | Create | React entry for overlay |
| `src/components/region-overlay.tsx` | Create | Overlay selection component |
| `src/utils/screenshot-api.ts` | Modify | Add interactive capture API |
| `src/hooks/use-screenshot.ts` | Modify | Add captureRegionInteractive |
| `src/components/toolbar/toolbar.tsx` | Modify | Wire up region button |

## Testing Checklist

- [ ] Overlay appears on region button click
- [ ] Main window hides before overlay shows
- [ ] Crosshair cursor active in overlay
- [ ] Selection rectangle draws correctly (all 4 directions)
- [ ] ESC cancels and returns to main app
- [ ] Mouse release captures region
- [ ] Captured image loads in canvas
- [ ] Works on 1x and 2x DPI displays
- [ ] No flickering or visual artifacts

## Known Limitations (v1)

1. **Primary monitor only** - Multi-monitor support deferred
2. **No resize handles** - Selection is one-shot, no adjustment
3. **macOS transparency** - May require `macos-private-api` feature (App Store incompatible)

## Dependencies

No new npm/cargo dependencies required. Uses existing:
- `@tauri-apps/api` (window, event, invoke)
- Tauri v2 WebviewWindowBuilder

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Transparent window broken on Windows | Test early; fallback to opaque dim |
| DPI coords off by factor | Use scaleFactor conversion |
| Overlay stuck on crash | Add timeout auto-close |
| Memory leak from screenshot blob | Use URL.revokeObjectURL |

## Unresolved Questions

1. Should overlay show actual screenshot or just dimmed screen?
   - Current plan: Dimmed overlay only (simpler, less memory)
   - Alternative: Show frozen screenshot (more accurate preview)

2. macOS App Store compatibility with `macos-private-api`?
   - If targeting App Store, may need alternative approach (native screencapture)

3. Multi-monitor support timeline?
   - Suggest Phase 2 feature after core flow validated
