# Phase 01: Project Setup & Scaffolding

**Status**: ✅ DONE | **Effort**: 2h | **Priority**: P1
**Completed**: 2025-12-27 | **Review Report**: `../reports/code-reviewer-251227-0323-phase01-setup.md`

## Objective

Bootstrap Tauri v2 + React + TypeScript project with proper Rust toolchain, dependencies, and folder structure.

---

## Prerequisites

- Rust 1.70+ installed (`rustup update stable`)
- Node.js 18+ LTS
- Platform build tools:
  - Windows: Visual Studio Build Tools 2022
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`

---

## Tasks

### 1.1 Create Tauri Project

```bash
cd /Users/dcppsw/Projects/beautyshot
npm create tauri-app@latest . -- --template react-ts --package-manager npm
```

**Expected structure:**
```
beautyshot/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── src-tauri/              # Rust backend
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

### 1.2 Install Frontend Dependencies

```bash
npm install react-konva@18 konva
npm install @tauri-apps/api@2
npm install @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-notification
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.3 Configure Tailwind CSS

**tailwind.config.js:**
```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

**src/styles.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1.4 Add Rust Dependencies

**src-tauri/Cargo.toml:**
```toml
[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-global-shortcut = "2.0"
tauri-plugin-notification = "2.0"
xcap = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }
```

### 1.5 Configure Tauri

**src-tauri/tauri.conf.json:**
```json
{
  "$schema": "https://schema.tauri.app/config/2.0.0",
  "productName": "BeautyShot",
  "version": "0.1.0",
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
      "resizable": true,
      "fullscreen": false
    }],
    "security": {
      "csp": null
    }
  }
}
```

### 1.6 Setup Capabilities

**src-tauri/capabilities/default.json:**
```json
{
  "identifier": "default",
  "description": "Default capabilities for BeautyShot",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "global-shortcut:default",
    "notification:default"
  ]
}
```

### 1.7 Create Folder Structure

```
src/
├── components/
│   ├── canvas/           # Konva canvas components
│   ├── toolbar/          # Tool selection UI
│   ├── sidebar/          # Settings panels
│   └── common/           # Shared components
├── hooks/                # Custom React hooks
├── stores/               # State management
├── utils/                # Helper functions
├── types/                # TypeScript types
└── assets/               # Icons, images
```

---

## Verification

```bash
# Run dev mode
npm run tauri dev

# Expected: Window opens with React app
# Console shows: Tauri is ready
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Create (via scaffolding) |
| `src-tauri/Cargo.toml` | Modify (add deps) |
| `src-tauri/tauri.conf.json` | Modify (configure) |
| `src-tauri/capabilities/default.json` | Create |
| `tailwind.config.js` | Create |
| `src/styles.css` | Modify (tailwind) |

---

## Success Criteria

- [✅] `npm run tauri dev` opens window without errors
- [✅] React app renders in Tauri webview
- [✅] Rust compiles without warnings (423 crates compiled)
- [✅] Tailwind CSS classes work (v4 stable)
- [✅] Folder structure created

## Issues Fixed (2025-12-27)

All critical issues from code review have been resolved:
- ✅ **C1**: CSP enabled with proper security policy
- ✅ **C3**: Product name standardized to `BeautyFullShot` (per Round 2 validation)
- ✅ **M2**: Added `rel="noopener noreferrer"` to external links
- ✅ **H2**: .gitkeep files added to empty folders
- ✅ Title updated in `index.html`

---

## Platform Notes

- **macOS**: First build takes 5-10min (compiling Rust deps)
- **Windows**: Ensure WebView2 runtime installed
- **Linux**: Install webkit2gtk dev package first

---

## Next Phase

[Phase 02: Screenshot Capture](./phase-02-screenshot-capture.md)
