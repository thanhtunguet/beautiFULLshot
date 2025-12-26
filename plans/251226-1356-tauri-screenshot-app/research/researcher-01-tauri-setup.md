# Research Report: Tauri v2 Project Setup & Screenshot Capture

**Research Date**: 2025-12-26 | **Language**: Vietnamese/English | **Max Length**: ~150 lines

## Executive Summary

Tauri v2 cho phép xây dựng ứng dụng desktop cross-platform với React + TypeScript + Rust. Xcap crate cung cấp API capture screenshot đơn giản. Tauri plugins (global-shortcut, system-tray, notification) tích hợp dễ dàng. IPC communication hỗ trợ binary data qua `tauri::ipc::Response`. Platform-specific concerns: macOS yêu cầu Privacy permissions, Linux Wayland cần support riêng.

## Methodology

**Sources**: 5 research queries (Tauri docs, xcap docs, Web searches)
**Date Range**: Latest Tauri v2 (2024-2025) documentation
**Key Terms**: Tauri v2, create-tauri-app, xcap, screenshot, IPC, plugins, permissions

---

## 1. Tauri v2 Project Setup

### Create & Structure
```bash
npm create tauri-app@latest
# Select: React + TypeScript
```

**Project Layout**:
```
my-app/
├── src/              # React + TypeScript frontend
├── src-tauri/        # Rust backend + config
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

### Requirements
- **Rust**: 1.70.0+ (verify: `rustc --version`)
- **Node.js**: LTS
- `tauri-build`, `serde`, `serde_json` dependencies

### Key Config (tauri.conf.json)
```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173"
  },
  "capabilities": {
    "main": {
      "commands": ["capture_screenshot"],
      "permissions": ["path:default", "window:default"]
    }
  }
}
```

---

## 2. Xcap Library Integration

### API Overview
Xcap (v0.8.0+) = **cross-platform screenshot crate** supporting Windows, macOS, Linux (X11/Wayland).

**Main Types**:
- `Monitor` → fullscreen, region capture
- `Window` → window-specific capture

### Usage Examples

**Fullscreen Capture**:
```rust
use xcap::Monitor;

let monitors = Monitor::all().unwrap();
for monitor in monitors {
    let image = monitor.capture_image().unwrap();
    // image.bytes() → PNG data
}
```

**Region Capture**:
```rust
let region_image = monitors[0]
    .capture_region(x: 0, y: 0, width: 1024, height: 768)
    .unwrap();
```

**Window Capture**:
```rust
use xcap::Window;

let windows = Window::all().unwrap();
for window in windows {
    println!("{}: {}", window.app_name(), window.title());
    let image = window.capture_image().unwrap();
}
```

### Key Points
- Returns `image::Image` struct with `.bytes()` for PNG data
- Returns **binary PNG data** (not base64) → ideal for IPC
- No external dependencies (pure Rust)

---

## 3. Tauri Plugins

### Global Shortcut
```rust
// src-tauri/src/main.rs
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build());
```

**JS Frontend**:
```ts
import { register } from '@tauri-apps/plugin-global-shortcut';
await register('CommandOrControl+Shift+C', () => {
    console.log('Screenshot triggered');
});
```

**Capabilities**:
```json
{
  "global-shortcut:allow-register": true,
  "global-shortcut:allow-unregister": true
}
```

### System Tray
```rust
use tauri::{SystemTray, SystemTrayMenu, CustomMenuItem};

let quit = CustomMenuItem::new("quit".to_string(), "Quit");
let tray_menu = SystemTrayMenu::new().add_item(quit);

tauri::Builder::default()
    .system_tray(SystemTray::new().with_menu(tray_menu))
    .on_system_tray_event(|app, event| {
        // Handle click/menu events
    })
```

### Notification
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
}
```

**JS Frontend**:
```ts
import { sendNotification, isPermissionGranted, requestPermission }
    from '@tauri-apps/plugin-notification';

let permission = await isPermissionGranted();
if (!permission) permission = await requestPermission();

sendNotification({
    title: 'Screenshot Saved',
    body: 'File saved to clipboard'
});
```

---

## 4. IPC Communication

### Binary Data (Screenshot) Transfer

**Rust Command**:
```rust
use tauri::ipc::Response;

#[tauri::command]
fn capture_screenshot() -> Result<Vec<u8>, String> {
    let image = xcap::Monitor::all()
        .unwrap()[0]
        .capture_image()
        .unwrap();
    Ok(image.bytes().to_vec())
}
```

**TypeScript Frontend**:
```ts
import { invoke } from '@tauri-apps/api/tauri';

const imageBytes = await invoke<Uint8Array>('capture_screenshot');
const blob = new Blob([imageBytes], { type: 'image/png' });
const url = URL.createObjectURL(blob);
// Display or process image
```

### Performance Notes
- JSON serialization bottleneck for large data
- Use `tauri::ipc::Response` for optimized binary return
- Channel API available for streaming (bidirectional)

---

## 5. Platform-Specific Considerations

### macOS
- **Permission Issue**: Screen capture requires Privacy → Screen Capture permission
- **Workaround**: Use `tauri-plugin-macos-permissions` to request/check permissions
- **Notarization**: App signing needed for distribution (bundle-identifier, certificate)
- **Template Icon**: System tray icon needs `iconAsTemplate: true` for dark mode

### Linux
- **X11**: Native support via xcap
- **Wayland**: Requires portal support (still developing in xcap ecosystem)
- **Caveat**: Wayland screenshot access limited, may need additional permissions

### Windows
- **UAC**: Runs with normal user permissions by default
- **No special permissions needed** for screenshot capture
- **Visual Styles**: Supports system theme detection

### Permission System
Tauri v2 uses capability-based security:
```json
{
  "permissions": [
    "core:path:default",
    "core:window:default",
    "plugin:notification:allow-*"
  ]
}
```

---

## Resources & References

### Official Documentation
- [Tauri v2 Docs](https://v2.tauri.app/)
- [Xcap crate](https://crates.io/crates/xcap)
- [IPC Communication Guide](https://v2.tauri.app/concept/inter-process-communication/)
- [Permissions & Capabilities](https://v2.tauri.app/security/permissions/)

### GitHub Repositories
- [Xcap GitHub](https://github.com/nashaofu/xcap)
- [Tauri GitHub](https://github.com/tauri-apps/tauri)

### Community
- Tauri Discord, GitHub Discussions
- Rust community (Rust forum, Reddit r/rust)

---

## Common Gotchas

1. **macOS Permissions**: App crashes on screenshot without Privacy approval
2. **Wayland**: Xcap may not capture on Linux Wayland (use X11 fallback)
3. **Binary Serialization**: Don't use `serde_json` for images (use raw bytes)
4. **Capability Mismatch**: Forgot to add command to capabilities → 403 access denied
5. **Rust Version**: Older Rust toolchain causes build failures (update with `rustup update`)

---

## Quick Start Checklist

- [ ] Install Rust 1.70+, Node.js LTS
- [ ] Run `npm create tauri-app@latest`
- [ ] Add xcap to `src-tauri/Cargo.toml`
- [ ] Add screenshot command in `main.rs`
- [ ] Register command in `tauri.conf.json` capabilities
- [ ] Add global shortcut plugin
- [ ] Test on macOS (check Privacy permissions)
- [ ] Test on Windows & Linux (Wayland warning)

---

## Unresolved Questions

- Xcap video recording API maturity (marked as WIP)
- Exact Wayland permission model for screenshot capture
- App signing certificate requirements for macOS distribution
- Screenshot performance on high-DPI displays across platforms
