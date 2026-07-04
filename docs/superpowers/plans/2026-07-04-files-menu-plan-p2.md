# Files Menu — Implementation Plan (Part 2: Menu + Store)

> Continue from Part 1. This part covers the Rust File submenu and the Zustand project store.

---

### Task 4: Add File submenu to Rust native menu

**Goal:** Add a File submenu (before Edit) with Open, Save, Export, Close, Delete items. Each emits a Tauri event to the frontend.

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Acceptance Criteria:**
- [ ] File submenu appears before Edit in the macOS menu bar
- [ ] Open (Cmd+O), Save (Cmd+S), Export (Cmd+Shift+E) have keyboard accelerators
- [ ] Close Project and Delete have no accelerators
- [ ] Each item emits: `menu-file-open`, `menu-file-save`, `menu-file-export`, `menu-file-close`, `menu-file-delete`

**Verify:** `cd src-tauri && cargo build 2>&1 | tail -3` → `Finished`

**Steps:**

- [ ] **Step 1: Add File submenu and event handlers in `lib.rs`**

In `src-tauri/src/lib.rs`, locate the section where the Edit submenu is created (around line 73-81, starts with `let edit_submenu`). Add the File submenu **before** it.

Also update the existing `on_menu_event` handler to handle File menu events.

Find this block (around lines 62-81):

```rust
                // Create app submenu (first menu on macOS)
                let app_submenu = SubmenuBuilder::new(handle, "beautiFULLshot")
                    // ... existing code ...
                    .build()?;

                // Create Edit submenu for standard text editing shortcuts
                let edit_submenu = SubmenuBuilder::new(handle, "Edit")
```

Insert the File submenu between the app submenu and Edit submenu blocks:

```rust
                // Create File submenu
                let file_open = MenuItemBuilder::with_id("file_open", "Open...")
                    .accelerator("CmdOrCtrl+O")
                    .build(handle)?;
                let file_save = MenuItemBuilder::with_id("file_save", "Save")
                    .accelerator("CmdOrCtrl+S")
                    .build(handle)?;
                let file_export = MenuItemBuilder::with_id("file_export", "Export...")
                    .accelerator("CmdOrCtrl+Shift+E")
                    .build(handle)?;
                let file_close = MenuItemBuilder::with_id("file_close", "Close Project")
                    .build(handle)?;
                let file_delete = MenuItemBuilder::with_id("file_delete", "Delete Project")
                    .build(handle)?;

                let file_submenu = SubmenuBuilder::new(handle, "File")
                    .item(&file_open)
                    .item(&file_save)
                    .item(&file_export)
                    .separator()
                    .item(&file_close)
                    .item(&file_delete)
                    .build()?;
```

Then find the `MenuBuilder` chain (around lines 92-97):

```rust
                let menu = MenuBuilder::new(handle)
                    .item(&app_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;
```

Replace with:

```rust
                let menu = MenuBuilder::new(handle)
                    .item(&app_submenu)
                    .item(&file_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;
```

Finally, update the `on_menu_event` handler (around lines 103-112). Replace the existing handler:

```rust
                // Handle custom menu events
                let handle_clone = handle.clone();
                app.on_menu_event(move |_app, event| {
                    if event.id().as_ref() == "hide_to_tray" {
                        // Hide window instead of quitting
                        if let Some(window) = handle_clone.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        // Hide from dock
                        let _ = handle_clone.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    }
                });
```

Replace with:

```rust
                // Handle custom menu events
                let handle_clone = handle.clone();
                app.on_menu_event(move |_app, event| {
                    let event_id = event.id().as_ref();
                    match event_id {
                        "hide_to_tray" => {
                            if let Some(window) = handle_clone.get_webview_window("main") {
                                let _ = window.hide();
                            }
                            let _ = handle_clone.set_activation_policy(tauri::ActivationPolicy::Accessory);
                        }
                        // File menu events — forward to frontend
                        "file_open" | "file_save" | "file_export"
                        | "file_close" | "file_delete" => {
                            if let Some(window) = handle_clone.get_webview_window("main") {
                                let frontend_event = format!("menu-{}", event_id.replace('_', '-'));
                                let _ = window.emit(&frontend_event, ());
                            }
                        }
                        _ => {}
                    }
                });
```

- [ ] **Step 2: Verify build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add File submenu with Open, Save, Export, Close, Delete items"
```

---

### Task 5: Create project-store.ts with dirty tracking

**Goal:** Create a Zustand store that manages project state — file path, dirty flag, open/close — and watches canvas/annotation/background stores for changes.

**Files:**
- Create: `src/stores/project-store.ts`

**Acceptance Criteria:**
- [ ] Tracks `filePath`, `isDirty`, `isOpen`
- [ ] `markDirty()` called automatically when canvas, annotation, or background stores change
- [ ] `markClean()` resets dirty flag (called after save/open)
- [ ] `openProject(path)` sets filePath, marks clean, sets isOpen
- [ ] `closeProject()` cleans up and sets isOpen to false
- [ ] Dirty tracking stops when no project is open

**Verify:** `npx vitest run src/stores/__tests__/project-store.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write the test file**

Create `src/stores/__tests__/project-store.test.ts`:

```typescript
// Tests for project-store dirty tracking and state transitions
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../project-store';

// Reset the store before each test
beforeEach(() => {
  useProjectStore.setState({
    filePath: null,
    isDirty: false,
    isOpen: false,
  });
});

describe('project-store', () => {
  describe('initial state', () => {
    it('should start with no file path, not dirty, not open', () => {
      const state = useProjectStore.getState();
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(false);
    });
  });

  describe('markDirty / markClean', () => {
    it('should toggle dirty state', () => {
      useProjectStore.getState().markDirty();
      expect(useProjectStore.getState().isDirty).toBe(true);

      useProjectStore.getState().markClean();
      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe('openProject', () => {
    it('should set filePath, mark clean, and set isOpen', () => {
      useProjectStore.getState().openProject('/path/to/project.bshot');
      const state = useProjectStore.getState();
      expect(state.filePath).toBe('/path/to/project.bshot');
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(true);
    });
  });

  describe('setFilePath', () => {
    it('should update filePath and mark clean', () => {
      // First mark dirty, then set path (like after "Save As")
      useProjectStore.getState().markDirty();
      useProjectStore.getState().setFilePath('/new/path.bshot');
      const state = useProjectStore.getState();
      expect(state.filePath).toBe('/new/path.bshot');
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(true);
    });
  });

  describe('closeProject', () => {
    it('should reset to initial state', () => {
      useProjectStore.getState().openProject('/some/project.bshot');
      useProjectStore.getState().markDirty();
      useProjectStore.getState().closeProject();
      const state = useProjectStore.getState();
      expect(state.filePath).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.isOpen).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/__tests__/project-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/stores/project-store.ts`**

```typescript
// Project store — Zustand state for project file management
// Tracks file path, dirty state, and open/close lifecycle

import { create } from 'zustand';
import { useCanvasStore } from './canvas-store';
import { useAnnotationStore } from './annotation-store';
import { useBackgroundStore } from './background-store';

export interface ProjectState {
  filePath: string | null;  // null = new/unsaved project
  isDirty: boolean;         // true = has unsaved changes
  isOpen: boolean;          // true = a project is loaded or created

  markDirty: () => void;
  markClean: () => void;
  openProject: (path: string) => void;
  closeProject: () => void;
  setFilePath: (path: string) => void;
}

// Track whether subscriptions are active
let subscriptionsActive = false;

function setupDirtyTracking() {
  if (subscriptionsActive) return;
  subscriptionsActive = true;

  const markDirty = () => {
    const state = useProjectStore.getState();
    // Only track dirty when a project is open
    if (state.isOpen && !state.isDirty) {
      useProjectStore.setState({ isDirty: true });
    }
  };

  // Subscribe to mutations in canvas, annotation, and background stores
  useCanvasStore.subscribe((state, prevState) => {
    // Only care about actual image changes, not viewport/scale
    if (
      state.imageUrl !== prevState.imageUrl ||
      state.originalWidth !== prevState.originalWidth ||
      state.originalHeight !== prevState.originalHeight
    ) {
      markDirty();
    }
  });

  useAnnotationStore.subscribe((state, prevState) => {
    // Only care about annotation list changes, not selection/tool changes
    if (state.annotations !== prevState.annotations) {
      markDirty();
    }
  });

  let prevBgType = useBackgroundStore.getState().type;
  let prevBlur = useBackgroundStore.getState().blurAmount;
  let prevShadow = useBackgroundStore.getState().shadowBlur;
  let prevRadius = useBackgroundStore.getState().cornerRadius;
  let prevPadding = useBackgroundStore.getState().paddingPercent;
  let prevBorderWidth = useBackgroundStore.getState().borderWidth;
  let prevBorderColor = useBackgroundStore.getState().borderColor;
  let prevBorderOpacity = useBackgroundStore.getState().borderOpacity;
  let prevGradientId = useBackgroundStore.getState().gradient?.id ?? null;
  let prevSolidColor = useBackgroundStore.getState().solidColor;

  useBackgroundStore.subscribe((state) => {
    if (
      state.type !== prevBgType ||
      state.blurAmount !== prevBlur ||
      state.shadowBlur !== prevShadow ||
      state.cornerRadius !== prevRadius ||
      state.paddingPercent !== prevPadding ||
      state.borderWidth !== prevBorderWidth ||
      state.borderColor !== prevBorderColor ||
      state.borderOpacity !== prevBorderOpacity ||
      state.gradient?.id !== prevGradientId ||
      state.solidColor !== prevSolidColor
    ) {
      prevBgType = state.type;
      prevBlur = state.blurAmount;
      prevShadow = state.shadowBlur;
      prevRadius = state.cornerRadius;
      prevPadding = state.paddingPercent;
      prevBorderWidth = state.borderWidth;
      prevBorderColor = state.borderColor;
      prevBorderOpacity = state.borderOpacity;
      prevGradientId = state.gradient?.id ?? null;
      prevSolidColor = state.solidColor;
      markDirty();
    }
  });
}

export const useProjectStore = create<ProjectState>((_set, _get) => {
  // Initialize dirty tracking once
  setupDirtyTracking();

  return {
    filePath: null,
    isDirty: false,
    isOpen: false,

    markDirty: () => {
      const state = useProjectStore.getState();
      if (state.isOpen && !state.isDirty) {
        useProjectStore.setState({ isDirty: true });
      }
    },

    markClean: () => useProjectStore.setState({ isDirty: false }),

    openProject: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),

    closeProject: () =>
      useProjectStore.setState({
        filePath: null,
        isDirty: false,
        isOpen: false,
      }),

    setFilePath: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),
  };
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/stores/__tests__/project-store.test.ts`
Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/stores/project-store.ts src/stores/__tests__/project-store.test.ts
git commit -m "feat: add project-store with dirty tracking for .bshot files"
```
