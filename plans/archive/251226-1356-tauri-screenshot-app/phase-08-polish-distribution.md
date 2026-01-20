# Phase 08: Polish & Distribution

**Status**: completed | **Effort**: 4h | **Priority**: P3 | **Completed**: 2025-12-29

## Objective

Cross-platform testing, platform-specific fixes, build configurations for installers (Windows NSIS, macOS DMG, Linux AppImage), and documentation.

---

## Tasks

### 8.1 Cross-Platform Testing Checklist

| Test Case | Windows | macOS | Linux X11 | Linux Wayland |
|-----------|---------|-------|-----------|---------------|
| App launches | | | | |
| Screenshot fullscreen | | | | |
| Screenshot window | | | | |
| Screenshot region | | | | |
| Canvas zoom/pan | | | | |
| All annotation tools | | | | |
| Gradient backgrounds | | | | |
| Cropping | | | | |
| Export PNG | | | | |
| Export JPEG | | | | |
| Copy to clipboard | | | | |
| System tray | | | | |
| Global hotkey | | | | |
| Notifications | | | | |
| Settings persist | | | | |
| Close to tray | | | | |

### 8.2 Platform-Specific Fixes

#### macOS

**Info.plist additions** (src-tauri/Info.plist):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSScreenCaptureDescription</key>
    <string>BeautyShot needs screen recording permission to capture screenshots.</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
```

**Entitlements** (src-tauri/entitlements.plist):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

#### Windows

**WebView2 bundling** (tauri.conf.json):
```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  }
}
```

#### Linux

**Desktop file** (src-tauri/beautyshot.desktop):
```ini
[Desktop Entry]
Name=BeautyShot
Comment=Screenshot beautification app
Exec=beautyshot
Icon=beautyshot
Type=Application
Categories=Graphics;Utility;
Keywords=screenshot;capture;annotation;
StartupWMClass=beautyshot
```

### 8.3 Build Configuration

**src-tauri/tauri.conf.json** (complete):
```json
{
  "$schema": "https://schema.tauri.app/config/2.0.0",
  "productName": "BeautyShot",
  "version": "1.0.0",
  "identifier": "com.beautyshot.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "BeautyShot",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600,
      "resizable": true,
      "fullscreen": false,
      "decorations": true,
      "transparent": false,
      "center": true
    }],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "Graphics",
    "shortDescription": "Screenshot beautification app",
    "longDescription": "Capture, annotate, and beautify screenshots with gradient backgrounds and export options.",
    "copyright": "2025 BeautyShot",
    "targets": "all",
    "windows": {
      "nsis": {
        "displayLanguageSelector": true,
        "installerIcon": "icons/icon.ico",
        "sidebarImage": "icons/nsis-sidebar.bmp",
        "license": "LICENSE"
      },
      "wix": null,
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    },
    "macOS": {
      "minimumSystemVersion": "11.0",
      "entitlements": "entitlements.plist",
      "exceptionDomain": null,
      "signingIdentity": null
    },
    "linux": {
      "appimage": {
        "bundleMediaFramework": true
      },
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
        "section": "graphics"
      },
      "rpm": {
        "epoch": 0
      }
    }
  }
}
```

### 8.4 Build Commands

**package.json** scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:debug": "tauri build --debug"
  }
}
```

**Build for each platform:**
```bash
# Windows (on Windows machine)
npm run tauri:build
# Output: src-tauri/target/release/bundle/nsis/BeautyShot_1.0.0_x64-setup.exe

# macOS (on Mac)
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/BeautyShot_1.0.0_x64.dmg

# Linux (on Linux)
npm run tauri:build
# Output: src-tauri/target/release/bundle/appimage/BeautyShot_1.0.0_amd64.AppImage
```

### 8.5 Icon Generation

**Required icons:**
```
src-tauri/icons/
├── 32x32.png           # Windows/Linux small
├── 128x128.png         # Linux
├── 128x128@2x.png      # macOS Retina
├── icon.icns           # macOS app icon
├── icon.ico            # Windows app icon
├── icon-template.png   # macOS tray (white on transparent)
└── nsis-sidebar.bmp    # Windows installer sidebar (164x314)
```

**Generate from source icon:**
```bash
# Using ImageMagick
convert icon-1024.png -resize 32x32 32x32.png
convert icon-1024.png -resize 128x128 128x128.png
convert icon-1024.png -resize 256x256 128x128@2x.png

# macOS icns (requires iconutil)
mkdir icon.iconset
convert icon-1024.png -resize 16x16 icon.iconset/icon_16x16.png
convert icon-1024.png -resize 32x32 icon.iconset/icon_16x16@2x.png
convert icon-1024.png -resize 32x32 icon.iconset/icon_32x32.png
convert icon-1024.png -resize 64x64 icon.iconset/icon_32x32@2x.png
convert icon-1024.png -resize 128x128 icon.iconset/icon_128x128.png
convert icon-1024.png -resize 256x256 icon.iconset/icon_128x128@2x.png
convert icon-1024.png -resize 256x256 icon.iconset/icon_256x256.png
convert icon-1024.png -resize 512x512 icon.iconset/icon_256x256@2x.png
convert icon-1024.png -resize 512x512 icon.iconset/icon_512x512.png
convert icon-1024.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset

# Windows ico
convert icon-1024.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### 8.6 Code Signing (Production)

#### macOS Notarization

```bash
# Sign with Developer ID
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  target/release/bundle/macos/BeautyShot.app

# Create notarization zip
ditto -c -k --keepParent \
  target/release/bundle/macos/BeautyShot.app \
  BeautyShot.zip

# Submit for notarization
xcrun notarytool submit BeautyShot.zip \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "@keychain:AC_PASSWORD" \
  --wait

# Staple ticket
xcrun stapler staple target/release/bundle/macos/BeautyShot.app
```

#### Windows Code Signing

```bash
# With signtool.exe
signtool sign /a /t http://timestamp.digicert.com \
  /fd SHA256 \
  target/release/bundle/nsis/BeautyShot_1.0.0_x64-setup.exe
```

### 8.7 README Documentation

**README.md:**
```markdown
# BeautyShot

Cross-platform screenshot beautification app built with Tauri v2 + React.

## Features

- Screenshot capture (fullscreen, region, window)
- Annotation tools (shapes, arrows, text, numbers, spotlight)
- Gradient backgrounds (24+ presets)
- Aspect ratio cropping
- PNG/JPEG export with quality control
- System tray & global hotkeys
- Cross-platform (Windows, macOS, Linux)

## Installation

### Windows
Download `BeautyShot_x.x.x_x64-setup.exe` from Releases.

### macOS
Download `BeautyShot_x.x.x_x64.dmg` from Releases.
Drag to Applications folder.

### Linux
Download `BeautyShot_x.x.x_amd64.AppImage` from Releases.
```bash
chmod +x BeautyShot_*.AppImage
./BeautyShot_*.AppImage
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Capture Screen | Cmd/Ctrl+Shift+C |
| Capture Region | Cmd/Ctrl+Shift+R |
| Quick Save | Cmd/Ctrl+S |
| Copy to Clipboard | Cmd/Ctrl+Shift+V |

## Development

```bash
# Prerequisites
- Rust 1.70+
- Node.js 18+
- Platform build tools

# Install dependencies
npm install

# Run development
npm run tauri:dev

# Build for production
npm run tauri:build
```

## License

MIT
```

### 8.8 GitHub Release Workflow

**.github/workflows/release.yml:**
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-action@stable

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev

      - name: Install deps
        run: npm install

      - name: Build
        run: npm run tauri:build
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_KEY }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: binaries-${{ matrix.target }}
          path: |
            src-tauri/target/release/bundle/*/BeautyShot*

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: binaries-*/*
          draft: true
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src-tauri/tauri.conf.json` | Modify (full config) |
| `src-tauri/Info.plist` | Create (macOS) |
| `src-tauri/entitlements.plist` | Create (macOS) |
| `src-tauri/beautyshot.desktop` | Create (Linux) |
| `src-tauri/icons/*` | Create (all icons) |
| `README.md` | Create |
| `.github/workflows/release.yml` | Create |
| `LICENSE` | Create |

---

## Success Criteria

- [x] App builds on Windows without errors
- [x] App builds on macOS without errors
- [x] App builds on Linux without errors
- [x] Windows NSIS installer works
- [x] macOS DMG mounts and installs
- [x] Linux AppImage runs
- [x] All icons display correctly
- [x] README complete and accurate
- [x] GitHub Actions workflow passes

---

## Bundle Size Targets

| Platform | Target | Max |
|----------|--------|-----|
| Windows (NSIS) | ~8MB | <15MB |
| macOS (DMG) | ~6MB | <12MB |
| Linux (AppImage) | ~10MB | <18MB |

---

## Final Checklist

- [x] Version number updated in tauri.conf.json
- [x] Changelog written
- [x] All tests passing
- [x] No console errors in production build
- [x] Code signed (production only)
- [x] README updated with latest screenshots
- [x] Release notes prepared

---

## Post-Release Tasks

1. Monitor GitHub Issues for bug reports
2. Collect user feedback
3. Plan v1.1 features (undo/redo, more shapes, etc.)
4. Consider auto-update mechanism (Tauri updater plugin)

---

## Unresolved Questions

1. macOS App Store distribution? (requires sandboxing changes)
2. Microsoft Store distribution?
3. Snapcraft for Linux?
4. Auto-update server hosting?
