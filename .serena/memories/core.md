# beautiFULLshot — Core Architecture

Cross-platform screenshot beautification desktop app (Tauri v2 + React 19). Capture, annotate, beautify, crop, and export screenshots.

## Source Map

| Directory | Purpose |
|-----------|---------|
| `src/` | React frontend (TypeScript) |
| `src/main.tsx` | Entry point → `App.tsx` (main window) |
| `src/overlay-main.tsx` | Entry point → `RegionOverlay` (region selection overlay window) |
| `src/components/` | React components, organized by feature domain |
| `src/stores/` | Zustand stores — 9 stores for state management |
| `src/hooks/` | Custom React hooks (12 hooks) |
| `src/types/` | TypeScript type definitions |
| `src/utils/` | Pure utility functions |
| `src/data/` | Static data presets (gradients, wallpapers, fonts, aspect ratios) |
| `src/constants/` | Named constants (canvas, annotations) |
| `src-tauri/` | Rust backend (Tauri commands + plugins) |
| `docs/` | Architecture, code standards, journals |

## Frontend Architecture

- **Two-window app**: `main` window (editor) + `overlay` (fullscreen region selection)
- **Vite MPA mode**: separate HTML entry points for each window
- **State**: 9 Zustand stores (`canvas-store`, `annotation-store`, `background-store`, `crop-store`, `export-store`, `history-store`, `settings-store`, `ui-store`, `toast-store`)
- **Canvas**: Konva Stage with multiple layers (image, annotations, background, crop overlay)
- **Persistence**: settings-store and background-store use Zustand `persist` middleware → localStorage

## Backend Architecture

- **Modules** in `src-tauri/src/`: screenshot, overlay, shortcuts, file_ops, clipboard, tray, permissions
- **IPC Commands**: ~25+ Tauri commands (see `mem:conventions` for patterns)
- **Native libs**: xcap (screenshot), image (PNG encoding), arboard (clipboard)
- **Plugins**: global-shortcut, notification, dialog, clipboard-manager, opener, process, updater

For tech stack details: `mem:tech_stack`
For code style/naming: `mem:conventions`
For how to run/build: `mem:suggested_commands`
For task completion checklist: `mem:task_completion`
