# Files Menu — Design Spec

**Date:** 2026-07-04
**Status:** Approved

## Overview

Add a native "File" menu to the macOS menu bar with Open, Save, Export, Close Project, and Delete operations. Introduce a `.bshot` project file format (ZIP archive) that bundles the source screenshot and annotation/decoration metadata so users can save and resume editing sessions.

## Architecture

### Approach: Hybrid — Native menu + React handlers

The File submenu is added in Rust (`lib.rs`) alongside the existing beautiFULLshot, Edit, and Window menus. Menu items emit Tauri events; the React layer listens and handles all UI logic (file dialogs, confirmation modals, drag-drop). This matches the app's existing pattern (`on_menu_event` → event → React).

```
┌─────────────────────────────────────────────────┐
│ Rust (lib.rs)                                    │
│  File submenu with accelerators                  │
│  on_menu_event → emit Tauri event                │
│  file_ops.rs: read_project / write_project       │
│              delete_file                         │
└──────────────┬──────────────────────────────────┘
               │ Tauri events
┌──────────────▼──────────────────────────────────┐
│ React (TypeScript)                               │
│  use-file-menu.ts    — listens, dispatches       │
│  project-store.ts    — state, dirty tracking     │
│  file-api.ts         — TS wrappers for Rust      │
│  delete-confirm-modal.tsx — three-option dialog  │
│  EditorLayout        — .bshot drag-drop          │
└─────────────────────────────────────────────────┘
```

## Project File Format (`.bshot`)

A ZIP archive with extension `.bshot` containing:

```
project.bshot
├── project.json      ← metadata, annotations, background, wallpaper path
└── screenshot.png    ← original source image
```

### `project.json` Schema

```json
{
  "version": 1,
  "createdAt": "2026-07-04T12:00:00Z",
  "updatedAt": "2026-07-04T12:00:00Z",
  "sourceImage": "screenshot.png",
  "canvas": {
    "originalWidth": 1440,
    "originalHeight": 900
  },
  "background": {
    "type": "gradient",
    "gradient": { "id": "sunset", ... },
    "solidColor": null,
    "wallpaper": { "id": "waves", "src": "/path/to/wallpaper.jpg", "thumbnail": "..." },
    "blurAmount": 0,
    "shadowBlur": 50,
    "cornerRadius": 12,
    "paddingPercent": 5,
    "borderWidth": 0,
    "borderColor": "#000000",
    "borderOpacity": 100
  },
  "annotations": [
    {
      "id": "abc123",
      "type": "rectangle",
      "x": 100, "y": 200,
      "width": 300, "height": 150,
      "fill": "transparent",
      "stroke": "#ff0000",
      "strokeWidth": 2,
      "rotation": 0,
      "draggable": true
    }
  ],
  "exportSettings": {
    "format": "png",
    "quality": 0.9,
    "pixelRatio": 2,
    "outputAspectRatio": "auto"
  }
}
```

**Design decisions:**
- Wallpaper stored as file path reference only (not embedded) — per user request
- No undo history in project file (minimal approach)
- `updatedAt` reflects last write time — refreshed on each save
- Missing wallpaper file → silently fall back to transparent background

## Rust Backend

### File Submenu (in `lib.rs`)

Added before the Edit submenu (standard macOS menu order: Apple → File → Edit → Window):

```
File
  Open...              Cmd+O         → emit "menu-file-open"
  Save                 Cmd+S         → emit "menu-file-save"
  Export...            Cmd+Shift+E   → emit "menu-file-export"
  ─────────────────────
  Close Project                   → emit "menu-file-close"
  Delete Project             → emit "menu-file-delete"
```

Implementation uses `SubmenuBuilder::new(handle, "File")` with `MenuItemBuilder` for each item, matching the existing pattern for the Edit submenu (line 74 of `lib.rs`).

### New Commands (in `file_ops.rs`)

#### `read_project(path: String) -> Result<ProjectData, String>`
- Opens the `.bshot` ZIP archive
- Reads `project.json` and deserializes into `ProjectData` struct
- Reads `screenshot.png` bytes
- Returns the combined data

#### `write_project(path: String, data: ProjectData) -> Result<String, String>`
- Creates a ZIP archive at `path`
- Writes `project.json` from `data.metadata`
- Writes `screenshot.png` from `data.screenshot_bytes`
- Returns the canonical save path

#### `delete_file(path: String, move_to_trash: bool) -> Result<(), String>`
- If `move_to_trash`: uses `trash` crate to move to system trash
- Otherwise: `std::fs::remove_file` for permanent deletion
- On Linux where trash may not be available, gracefully fall back or error

### ProjectData Struct

```rust
#[derive(Serialize, Deserialize)]
struct ProjectData {
    metadata: ProjectMetadata,      // project.json contents
    screenshot_bytes: Vec<u8>,      // raw PNG bytes
}

#[derive(Serialize, Deserialize)]
struct ProjectMetadata {
    version: u32,
    created_at: String,
    updated_at: String,
    source_image: String,
    canvas: CanvasMeta,
    background: BackgroundMeta,
    annotations: Vec<AnnotationMeta>,
    export_settings: ExportSettingsMeta,
}
// ... sub-structs for each section
```

Dependencies added: `zip` (ZIP I/O), `trash` (system trash), `serde` + `serde_json` (already present).

## Frontend

### New Store: `project-store.ts`

```typescript
interface ProjectState {
  filePath: string | null;    // null = new/unsaved project
  isDirty: boolean;           // true = has unsaved changes
  isOpen: boolean;            // true = a project is loaded

  markDirty: () => void;
  markClean: () => void;
  openProject: (path: string) => void;
  closeProject: () => void;
  setFilePath: (path: string) => void;
}
```

**Dirty tracking:** Subscribe to canvas, annotation, and background stores via Zustand `subscribe`. Any mutation to these stores calls `markDirty()`. On open/save, call `markClean()`.

### New Hook: `use-file-menu.ts`

Listens for the five Tauri events and orchestrates actions:

| Event              | Behavior                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `menu-file-open`   | Native open dialog (`.bshot` filter) → `invoke("read_project")` → restore canvas + annotations + background + export stores → set `isOpen=true`, `isDirty=false` |
| `menu-file-save`   | If `filePath` set: serialize state → `invoke("write_project")`. If no `filePath`: show save dialog → save → set path. Sets `isDirty=false`                       |
| `menu-file-export` | Delegates to existing `useExport().saveAs()`                                                                                                                     |
| `menu-file-close`  | Auto-save if dirty and filePath exists → clear canvas + annotations + background → `isOpen=false`                                                                |
| `menu-file-delete` | Open `DeleteConfirmModal`                                                                                                                                        |

### New Component: `delete-confirm-modal.tsx`

A glass-styled modal with three buttons:

- **Move to Trash** (primary) — `invoke("delete_file", { path, moveToTrash: true })` → close project → toast confirmation
- **Delete Permanently** (danger, red) — `invoke("delete_file", { path, moveToTrash: false })` → close project → toast confirmation
- **Cancel** (secondary)

Shows the filename being deleted in the message.

### Drag-Drop Extension (in `EditorLayout`)

In the existing `handleDrop` handler: before the image-type check, test if the file extension is `.bshot`. If so, call `invoke("read_project")` and restore project state instead of loading as raw image.

### File API Extensions (`file-api.ts`)

```typescript
export async function readProject(path: string): Promise<ProjectLoadResult>
export async function writeProject(path: string, data: ProjectSaveData): Promise<string>
export async function deleteFile(path: string, moveToTrash: boolean): Promise<void>
export async function showOpenDialog(): Promise<string | null>
```

### Keyboard Shortcuts

Existing Cmd+S (Save) and Cmd+C (Copy) hotkeys in `settings-store.ts` remain unchanged. The native menu accelerators (Cmd+O, Cmd+S, Cmd+Shift+E) are handled by the OS menu system and don't conflict with the in-app hotkey system.

## Error Handling

| Scenario                                     | Handling                                            |
| -------------------------------------------- | --------------------------------------------------- |
| Open fails (corrupt ZIP, wrong version)      | Toast: "Could not open project: {reason}"           |
| Save fails (disk full, permission)           | Toast: "Could not save project: {reason}"           |
| Delete fails (trash unavailable, permission) | Toast with specific reason                          |
| Missing wallpaper file at saved path         | Silently fall back to transparent background        |
| Drag-drop non-.bshot file                    | Existing behavior (open as image)                   |
| Close with unsaved + auto-save fails         | Still close, but warn: "Changes could not be saved" |
| Open project with version > current          | Toast: "Project was created with a newer version"   |

## Files Touched

| File                                             | Change                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `src-tauri/Cargo.toml`                           | Add `zip`, `trash` dependencies                                   |
| `src-tauri/src/lib.rs`                           | Add File submenu, menu event handlers                             |
| `src-tauri/src/file_ops.rs`                      | Add `read_project`, `write_project`, `delete_file` commands       |
| `src/stores/project-store.ts`                    | **New** — project state management                                |
| `src/hooks/use-file-menu.ts`                     | **New** — menu event handler                                      |
| `src/components/layout/delete-confirm-modal.tsx` | **New** — delete confirmation                                     |
| `src/components/layout/editor-layout.tsx`        | Add `.bshot` drag-drop handling                                   |
| `src/utils/file-api.ts`                          | Add `readProject`, `writeProject`, `deleteFile`, `showOpenDialog` |
| `src/types/project.ts`                           | **New** — `ProjectData`, `ProjectMetadata` etc.                   |

## Testing

- **Unit:** `project-store.ts` — dirty tracking, open/close/state transitions
- **Unit:** `read_project` / `write_project` round-trip — serialize, save, load, deserialize, verify identical state
- **Unit:** `delete-confirm-modal.tsx` — three button actions fire correct callbacks
- **Integration:** Full flow — open `.bshot` → edit annotation → save → close → reopen → verify annotation persisted
- **Manual:** macOS menu bar — all five items visible, accelerators work, events reach React

## Dependencies

- `zip` crate (Rust) — ZIP archive read/write
- `trash` crate (Rust) — cross-platform system trash
- No new npm dependencies required
