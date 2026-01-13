# BeautyShot Tauri Backend Analysis Report

**Date:** 2026-01-13 | **Codebase:** src-tauri/src/ (~688 LOC, 9 Rust files)  
**Scope:** Complete backend architecture, IPC commands, permissions, and feature implementation

---

## 1. Architecture Overview

### Module Structure
```
beautyshot_lib (lib.rs)
├── mod file_ops       [File operations - 71 LOC]
├── mod overlay        [Overlay window - 126 LOC]
├── mod permissions    [Permission checks - 32 LOC]
├── mod screenshot     [Screenshot capture - 148 LOC]
├── mod shortcuts      [Global shortcuts - 155 LOC]
└── mod tray          [System tray - 69 LOC]
```

### Entry Points
- **main.rs** (6 LOC): Thin wrapper calling `beautyfullshot_lib::run()`
  - Windows-specific: Suppresses console window in release builds
- **lib.rs** (48 LOC): Application initialization via `Tauri::Builder`
  - Plugins: opener, global-shortcut, notification, dialog
  - Setup hooks: Tray creation, overlay window initialization
  - Declares 14 IPC command handlers

### Plugin System
**Tauri 2.0 plugins enabled:**
- `tauri_plugin_opener` - Open external links/files
- `tauri_plugin_global_shortcut` - System-wide keyboard shortcuts
- `tauri_plugin_notification` - Native notifications
- `tauri_plugin_dialog` - Native file dialogs

---

## 2. Tauri Commands (IPC Handlers)

### Screenshot Module (4 commands)
```rust
capture_fullscreen()           // Returns: base64-encoded PNG of primary monitor
capture_region(x, y, w, h)    // Returns: cropped region from primary monitor
capture_window(window_id)      // Returns: specific window image
get_monitors()                 // Returns: Vec<MonitorInfo> - display metadata
get_windows()                  // Returns: Vec<WindowInfo> - capturable windows
```

### Overlay Module (4 commands)
```rust
create_overlay_window()         // Alias: show_overlay_window() - show region selector
close_overlay_window()          // Alias: hide_overlay_window() - hide selector
get_screenshot_data()           // Returns: stored base64 screenshot
clear_screenshot_data()         // Clears stored screenshot from memory
```

### File Operations (3 commands)
```rust
save_file(path, data)          // Saves binary data with 50MB limit & path validation
get_pictures_dir()             // Returns: ~/Pictures/BeautyShot
get_desktop_dir()              // Returns: ~/Desktop
```

### Shortcuts (1 command)
```rust
update_shortcuts(capture, region, window)  // Registers/updates 3 global shortcuts
```

### Permissions (2 commands)
```rust
check_screen_permission()      // Returns: bool (macOS Screen Recording permission check)
check_wayland()                // Returns: Option<String> (Wayland warning for Linux)
```

**Total:** 14 IPC commands exposed to frontend

---

## 3. Event System

### Events Emitted (Backend → Frontend)
- **overlay-activate** - Triggers overlay UI refresh when shown
- **hotkey-capture** - Global shortcut: full screen capture
- **hotkey-capture-region** - Global shortcut: region selection
- **hotkey-capture-window** - Global shortcut: window capture
- **tray-capture** - System tray menu: capture option

### Windows as Event Targets
- `main` - Primary app window (receives events)
- `region-overlay` - Overlay window for region selection (receives overlay-activate event)

---

## 4. Native Features Implementation

### Screenshot Capture (screenshot.rs)
- **Library:** `xcap 0.8` (cross-platform screen capture)
- **Image encoding:** `image 0.25` (PNG encoder)
- **Optimization strategy:**
  - Pre-allocated buffer (estimated width × height × 4 + 1024)
  - Fast PNG compression (no per-row filtering)
  - Base64 encoding with STANDARD alphabet
- **Data structures:**
  ```rust
  MonitorInfo { id, name, width, height, x, y, is_primary }
  WindowInfo { id, app_name, title, x, y, width, height }
  ```
- **Region validation:** Prevents out-of-bounds crops with saturation arithmetic
- **Performance:** Base64 output suitable for data URLs in frontend

### Overlay Management (overlay.rs)
- **Pattern:** Create-once, show/hide pattern (not destroy/recreate)
- **Storage:** Static `Mutex<Option<String>>` for screenshot data
- **Window config:**
  - Fullscreen mode (guaranteed coverage)
  - Transparent, always-on-top, no decorations
  - Skip taskbar, not focused on creation
  - Created hidden, shown on demand
- **Frontend:** Receives screenshot via `get_screenshot_data()` after `show_overlay_window()`

### File Operations (file_ops.rs)
- **Limits:** 50MB maximum file size (DoS prevention)
- **Security measures:**
  1. Path canonicalization (resolves symlinks)
  2. Parent directory validation
  3. Directory traversal prevention (`..` check)
  4. File size enforcement
- **Convenience functions:** Standard dirs integration (Pictures, Desktop)
- **Error handling:** Comprehensive error messages for permissions/path issues

### Clipboard Operations (clipboard.rs)
- **Library:** `arboard` (cross-platform clipboard)
- **Input:** Base64-encoded PNG (no data URL prefix)
- **Process:**
  1. Base64 decode to bytes
  2. Load image to extract dimensions and RGBA
  3. Create ImageData struct with width/height
  4. Copy to system clipboard
- **Output:** Direct system clipboard access (no intermediate file)

### System Tray (tray.rs)
- **Icon:** Uses default window icon from app config
- **Menu items:**
  ```
  Capture Screen    → tray-capture event
  ───────────────
  Show Window       → Restore main window
  Quit BeautyShot   → Exit app
  ```
- **Interactions:**
  - Left-click on tray: show/focus main window
  - Menu items: execute respective actions
  - Tooltip: "BeautyShot"

### Global Shortcuts (shortcuts.rs)
- **Parser:** Custom hotkey string parser
  - Format: "Modifier+Modifier+Key" (e.g., "CommandOrControl+Shift+C")
  - Modifiers: CommandOrControl, Command, Shift, Alt (normalized)
  - Keys: A-Z, 0-9, F1-F12, Space, Enter, arrows, etc. (95+ keys)
- **Registration:** Per-command with unique event names
- **Error handling:** Collects failed registrations, returns error list
- **Platform notes:** "CommandOrControl" maps to Cmd on macOS, Ctrl on Windows/Linux

---

## 5. Permissions & Security

### Capability Definitions (default.json)
**Windows:** main, region-overlay

**Permissions:**
- Core: defaults (IPC, events)
- Window: show, hide, focus, close, fullscreen, scale-factor
- Event: emit, listen, emit-to
- Plugins: opener, global-shortcut, notification, dialog

### Platform-Specific Permission Checks

#### macOS
- **Screen Recording permission** (privacy): `check_screen_permission()`
  - Uses `xcap::Monitor::all()` as test
  - Returns false if permission denied
  - **User action required:** Manually grant in System Preferences > Security & Privacy

#### Linux
- **Wayland detection**: `check_wayland()`
  - Checks `WAYLAND_DISPLAY` env var
  - Returns warning message (limited screenshot support on Wayland)
  - Recommends X11 or XWayland for best results

#### Windows
- No special permission checks (screenshotting unrestricted)

### Security Measures
1. **File operations:** Path canonicalization, traversal prevention, size limits
2. **Clipboard:** Validates base64 input, loads image safely
3. **Global shortcuts:** Input validation on hotkey strings
4. **Window operations:** Whitelist of windows (main, region-overlay only)
5. **CSP (Content Security Policy):**
   ```
   default-src 'self'
   script-src 'self'
   style-src 'self' 'unsafe-inline'
   img-src 'self' data: blob: asset: https://asset.localhost
   connect-src ipc: http://ipc.localhost http://tauri.localhost data: blob:
   ```

---

## 6. Window Management

### Main Window
- **Config:** 1200×800 px, min 800×600
- **Properties:** Resizable, decorated, centered
- **Role:** Primary UI for app settings, screenshot preview, annotation

### Overlay Window (region-overlay)
- **Config:** Fullscreen, fullscreen mode enforced
- **Properties:** Transparent, always-on-top, skip taskbar, no focus
- **Lifecycle:** Created at startup (hidden), shown/hidden on demand
- **Data flow:**
  1. Frontend triggers region selection
  2. Backend captures screenshot → stores in static Mutex
  3. Overlay window shows, fetches screenshot via `get_screenshot_data()`
  4. User selects region (frontend handles)
  5. Overlay hides (backend clears data with `clear_screenshot_data()`)

---

## 7. Dependencies & Versions

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.x | Tauri framework core |
| xcap | 0.8 | Cross-platform screenshot capture |
| image | 0.25 | Image encoding (PNG) |
| base64 | 0.22 | Base64 encoding/decoding |
| arboard | (inferred) | Clipboard operations |
| dirs | 5.0 | Standard directories (Pictures, Desktop) |
| serde | 1.x | JSON serialization |
| serde_json | 1.x | JSON handling |
| tauri-plugin-opener | 2.x | Open external links |
| tauri-plugin-global-shortcut | 2.x | System keyboard shortcuts |
| tauri-plugin-notification | 2.x | Native notifications |
| tauri-plugin-dialog | 2.x | File dialogs |

**Build dependencies:**
- tauri-build 2.x - Tauri build scripts

---

## 8. Configuration (tauri.conf.json)

### App Metadata
- **Product:** BeautyFullShot v1.0.0
- **Identifier:** com.beautyfullshot.app
- **Category:** GraphicsAndDesign

### Development
- **Dev server:** http://localhost:1420 (Vite)
- **Frontend dist:** ../dist (built SPA)

### Bundle Targets
- **Active:** true (all platforms)
- **Icons:** 32×32, 128×128, 128×128@2x, .icns (macOS), .ico (Windows)

### Platform-Specific Build Config

**macOS:**
- Minimum: 11.0 (Big Sur)
- Entitlements file: entitlements.plist (for Screen Recording permission prompt)
- No signing identity configured (unsigned builds)

**Windows:**
- NSIS installer with language selector
- WebView bootstrapper download mode (automatic webview installation)

**Linux:**
- AppImage with bundled media framework
- Debian package: requires libwebkit2gtk-4.1-0, libgtk-3-0
- RPM package: epoch 0

---

## 9. Technical Considerations

### Performance Optimizations
- **Screenshot encoding:** Fast PNG compression (no filtering)
- **Buffer pre-allocation:** Prevents reallocation during encoding
- **Base64 direct output:** Suitable for web delivery without intermediate files
- **Overlay pattern:** Create-once (startup), reuse (show/hide) - avoids window creation overhead

### Error Handling Strategy
- **IPC commands:** Result<T, String> - all errors converted to strings for frontend
- **Shortcuts:** Collects partial failures - continues registering remaining shortcuts
- **File operations:** Detailed error messages (path, permission, size limits)
- **Permissions:** Non-blocking checks (warnings, not failures)

### Platform Compatibility Notes
- **xcap:** Handles platform-specific implementations (Windows/macOS/Linux screenshot APIs)
- **Global shortcuts:** Plugin handles platform key mapping (CMD vs CTRL)
- **Clipboard:** arboard abstracts OS-specific clipboard APIs
- **Wayland warning:** Screenshot functionality limited on Wayland (X11 recommended)

### Thread Safety
- **Overlay screenshot data:** Protected by `Mutex<Option<String>>`
- **Global shortcuts:** Handled by tauri plugin (thread-safe)
- **File I/O:** Standard Rust FS (inherently safe)

### Known Limitations
1. **Wayland support:** Limited (Wayland protocol doesn't expose full screen capture)
2. **macOS permissions:** Requires manual user action (System Preferences)
3. **Multi-monitor:** `capture_region` only works on primary monitor (hardcoded)
4. **Window capture:** Filters out windows with empty titles
5. **Clipboard:** PNG-only (no text, metadata, or other formats)

---

## 10. Code Quality Observations

### Strengths
- Clear module separation (single-responsibility)
- Comprehensive error handling (descriptive messages)
- Security-conscious (path validation, size limits, permission checks)
- Well-commented (functionality documented)
- Efficient resource use (buffer pre-allocation, compression tuning)

### Areas for Enhancement
- **Logging:** No structured logging (uses eprintln! for single startup error)
- **Multi-monitor:** `capture_region` hardcoded to primary monitor
- **Shortcut parsing:** Could use regex for cleaner hotkey parsing
- **Clipboard:** Only PNG format supported
- **Testing:** No unit or integration tests visible

---

## File Reference Map

| File | LOC | Module | Purpose |
|------|-----|--------|---------|
| main.rs | 6 | - | Entry point, Windows subsystem config |
| lib.rs | 48 | - | Tauri initialization, plugin setup, IPC handler declaration |
| screenshot.rs | 148 | screenshot | Fullscreen/region/window capture, monitor enumeration |
| overlay.rs | 126 | overlay | Overlay window creation, region selection UI |
| shortcuts.rs | 155 | shortcuts | Global keyboard shortcut registration & parsing |
| file_ops.rs | 71 | file_ops | File save with security, standard directory lookups |
| clipboard.rs | 39 | clipboard | PNG image → system clipboard |
| tray.rs | 69 | tray | System tray icon & menu |
| permissions.rs | 32 | permissions | macOS & Wayland permission/compatibility checks |
| **Total** | **~694** | | |

---

## Unresolved Questions

1. **Clipboard support:** Why PNG-only? Are other image formats blocked by design?
2. **Multi-monitor regions:** Should `capture_region` work across all monitors or just primary?
3. **Logging:** Is there a logging sink for production error tracking?
4. **arboard version:** Not explicitly listed in Cargo.toml (transitive dependency?)

