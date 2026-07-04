# Files Menu — Implementation Plan (Part 3: Frontend Hook + Modal + API)

> Continue from Part 2. This part covers the TypeScript file API wrappers, the menu event handler hook, and the delete confirmation modal.

---

### Task 6: Extend file-api.ts with project operations

**Goal:** Add TypeScript wrappers for the new Rust project commands and a native open dialog helper.

**Files:**
- Modify: `src/utils/file-api.ts`

**Acceptance Criteria:**
- [ ] `readProject(path)` invokes `read_project` Rust command, returns `ProjectLoadResult`
- [ ] `writeProject(path, data)` invokes `write_project`, returns saved path string
- [ ] `deleteFile(path, moveToTrash)` invokes `delete_file`
- [ ] `showOpenDialog()` uses `@tauri-apps/plugin-dialog` `open()` filtered to `.bshot` files
- [ ] Existing exports (`saveFile`, `getPicturesDir`, `getDesktopDir`, `showSaveDialog`, etc.) remain unchanged

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Add new functions to `src/utils/file-api.ts`**

Open `src/utils/file-api.ts`. The file currently exports `normalizePath`, `extractFilename`, `saveFile`, `getPicturesDir`, `getDesktopDir`, and `showSaveDialog`. Keep all existing code. Add the following imports at the top (after the existing `import` lines):

```typescript
import { open } from '@tauri-apps/plugin-dialog';
import type { ProjectLoadResult, ProjectSaveData } from '../types/project';
```

Then append these new functions at the end of the file (after `showSaveDialog`):

```typescript
/**
 * Read a .bshot project file (ZIP archive)
 * Returns metadata and raw screenshot bytes from the Rust backend
 */
export async function readProject(path: string): Promise<ProjectLoadResult> {
  return await invoke<ProjectLoadResult>('read_project', { path });
}

/**
 * Write a .bshot project file (ZIP archive)
 * Serializes metadata and screenshot bytes into a ZIP via Rust
 */
export async function writeProject(
  path: string,
  data: ProjectSaveData
): Promise<string> {
  return await invoke<string>('write_project', { path, data });
}

/**
 * Delete a file from disk
 * @param moveToTrash — if true, use system trash; otherwise permanent delete
 */
export async function deleteFile(
  path: string,
  moveToTrash: boolean
): Promise<void> {
  await invoke('delete_file', { path, moveToTrash });
}

/**
 * Show native open file dialog filtered to .bshot project files
 * Returns the selected file path, or null if cancelled
 */
export async function showOpenDialog(): Promise<string | null> {
  const selected = await open({
    filters: [{ name: 'beautiFULLshot Project', extensions: ['bshot'] }],
    multiple: false,
  });

  return selected as string | null;
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/file-api.ts
git commit -m "feat: add readProject, writeProject, deleteFile, showOpenDialog to file-api"
```

---

### Task 7: Create use-file-menu.ts hook

**Goal:** Create a hook that listens for the five Tauri File menu events and orchestrates the corresponding actions — open project, save, export, close, delete.

**Files:**
- Create: `src/hooks/use-file-menu.ts`

**Acceptance Criteria:**
- [ ] Listens for `menu-file-open`, `menu-file-save`, `menu-file-export`, `menu-file-close`, `menu-file-delete` Tauri events
- [ ] **Open:** Shows native open dialog → `readProject()` → restores canvas + annotations + background + export stores
- [ ] **Save:** Serializes current state → `writeProject()` (or shows save dialog if new project)
- [ ] **Export:** Delegates to existing `useExport().saveAs()`
- [ ] **Close:** Auto-saves if dirty + has filePath → clears canvas/annotations
- [ ] **Delete:** Opens `DeleteConfirmModal` (via a callback passed from App)
- [ ] Cleans up event listeners on unmount

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create `src/hooks/use-file-menu.ts`**

```typescript
// useFileMenu — Listens for native File menu events and orchestrates actions
// Open, Save, Export, Close Screenshot, Delete Current Project

import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../stores/project-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useBackgroundStore } from '../stores/background-store';
import { useExportStore } from '../stores/export-store';
import { useCropStore } from '../stores/crop-store';
import { useHistoryStore } from '../stores/history-store';
import { toast } from '../stores/toast-store';
import {
  readProject,
  writeProject,
  showOpenDialog,
  saveFile as showSaveDialog,
  normalizePath,
} from '../utils/file-api';
import type { ProjectSaveData, ProjectMetadata } from '../types/project';
import { logError } from '../utils/logger';

interface UseFileMenuOptions {
  /** Callback to open the delete confirmation modal */
  onDeleteRequest: () => void;
  /** Ref to the export hook's saveAs (we invoke it imperatively) */
  exportSaveAsRef: React.MutableRefObject<(() => Promise<string | null>) | null>;
}

/**
 * Build the current project metadata from all stores
 */
function buildProjectMetadata(): ProjectMetadata {
  const canvas = useCanvasStore.getState();
  const bg = useBackgroundStore.getState();
  const annotations = useAnnotationStore.getState().annotations;
  const exportSettings = useExportStore.getState();

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceImage: 'screenshot.png',
    canvas: {
      originalWidth: canvas.originalWidth,
      originalHeight: canvas.originalHeight,
    },
    background: {
      type: bg.type,
      gradient: bg.gradient
        ? { id: bg.gradient.id, name: bg.gradient.name, colors: bg.gradient.colors }
        : null,
      solidColor: bg.solidColor,
      wallpaper: bg.wallpaper
        ? { id: bg.wallpaper.id, src: bg.wallpaper.src, thumbnail: bg.wallpaper.thumbnail }
        : null,
      blurAmount: bg.blurAmount,
      shadowBlur: bg.shadowBlur,
      cornerRadius: bg.cornerRadius,
      paddingPercent: bg.paddingPercent,
      borderWidth: bg.borderWidth,
      borderColor: bg.borderColor,
      borderOpacity: bg.borderOpacity,
    },
    annotations: annotations as ProjectMetadata['annotations'],
    exportSettings: {
      format: exportSettings.format,
      quality: exportSettings.quality,
      pixelRatio: exportSettings.pixelRatio,
      outputAspectRatio: exportSettings.outputAspectRatio,
    },
  };
}

/**
 * Restore all stores from loaded project data
 */
function restoreProject(
  metadata: ProjectMetadata,
  screenshotBytes: Uint8Array
) {
  const canvasStore = useCanvasStore.getState();
  const annotationStore = useAnnotationStore.getState();
  const backgroundStore = useBackgroundStore.getState();
  const exportStore = useExportStore.getState();
  const historyStore = useHistoryStore.getState();

  // Clear existing state first
  canvasStore.clearCanvas();
  annotationStore.clearAnnotations();
  historyStore.clear();

  // Load screenshot image
  canvasStore.setImageFromBytes(
    screenshotBytes,
    metadata.canvas.originalWidth,
    metadata.canvas.originalHeight
  );

  // Restore annotations
  useAnnotationStore.setState({ annotations: metadata.annotations });

  // Restore background settings
  const bg = metadata.background;
  switch (bg.type) {
    case 'gradient':
      if (bg.gradient) backgroundStore.setGradient(bg.gradient);
      break;
    case 'solid':
      if (bg.solidColor) backgroundStore.setSolidColor(bg.solidColor);
      break;
    case 'transparent':
      backgroundStore.setTransparent();
      break;
    case 'wallpaper':
      if (bg.wallpaper) backgroundStore.setWallpaper(bg.wallpaper);
      break;
    case 'auto':
      backgroundStore.setAuto();
      break;
  }
  backgroundStore.setBlurAmount(bg.blurAmount);
  backgroundStore.setShadowBlur(bg.shadowBlur);
  backgroundStore.setCornerRadius(bg.cornerRadius);
  backgroundStore.setPaddingPercent(bg.paddingPercent);
  backgroundStore.setBorderWidth(bg.borderWidth);
  backgroundStore.setBorderColor(bg.borderColor);
  backgroundStore.setBorderOpacity(bg.borderOpacity);

  // Restore export settings
  exportStore.setFormat(metadata.exportSettings.format);
  exportStore.setQuality(metadata.exportSettings.quality);
  exportStore.setPixelRatio(metadata.exportSettings.pixelRatio);
  exportStore.setOutputAspectRatio(metadata.exportSettings.outputAspectRatio);

  // Fit canvas to view after restore
  setTimeout(() => canvasStore.fitToView(), 100);
}

export function useFileMenu({ onDeleteRequest, exportSaveAsRef }: UseFileMenuOptions) {
  const projectStore = useProjectStore;

  // ─── Open ────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    try {
      const path = await showOpenDialog();
      if (!path) return; // User cancelled

      const result = await readProject(path);

      // Convert number[] to Uint8Array
      const screenshotBytes = new Uint8Array(result.metadata.screenshotBytes
        ? (result.metadata.screenshotBytes as unknown as number[])
        : result.screenshotBytes);

      restoreProject(result.metadata, screenshotBytes);
      projectStore.getState().openProject(path);

      toast.success('Opened', `Project loaded from ${normalizePath(path).split(/[\\/]/).pop()}`);
    } catch (e) {
      logError('useFileMenu:open', e);
      const message = e instanceof Error ? e.message : String(e);
      toast.error('Open Failed', message);
    }
  }, [projectStore]);

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      const state = projectStore.getState();
      const canvas = useCanvasStore.getState();

      if (!canvas.imageBytes) {
        toast.error('Save Failed', 'No image to save. Take a screenshot first.');
        return;
      }

      let savePath = state.filePath;

      // If no existing path (new project), show save dialog
      if (!savePath) {
        const now = new Date();
        const defaultName = `screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.bshot`;
        savePath = await showSaveDialog(defaultName, 'png' as any);
        // Note: showSaveDialog is for PNG/JPEG; for .bshot we handle extension in Rust
        if (!savePath) return; // User cancelled
        savePath = savePath.replace(/\.(png|jpe?g)$/i, '.bshot');
      }

      const metadata = buildProjectMetadata();
      const data: ProjectSaveData = {
        metadata,
        screenshotBytes: Array.from(canvas.imageBytes),
      };

      const savedPath = await writeProject(savePath, data);
      const displayPath = normalizePath(savedPath);
      projectStore.getState().setFilePath(displayPath);

      toast.success('Saved', `Project saved to ${displayPath.split(/[\\/]/).pop()}`, displayPath);
    } catch (e) {
      logError('useFileMenu:save', e);
      const message = e instanceof Error ? e.message : String(e);
      toast.error('Save Failed', message);
    }
  }, [projectStore]);

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (exportSaveAsRef.current) {
      await exportSaveAsRef.current();
    }
  }, [exportSaveAsRef]);

  // ─── Close ───────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    try {
      const state = projectStore.getState();

      // Auto-save if dirty and we have a file path
      if (state.isDirty && state.filePath) {
        const canvas = useCanvasStore.getState();
        if (canvas.imageBytes) {
          const metadata = buildProjectMetadata();
          const data: ProjectSaveData = {
            metadata,
            screenshotBytes: Array.from(canvas.imageBytes),
          };
          try {
            await writeProject(state.filePath, data);
          } catch {
            // Auto-save failed — warn but still close
            toast.error('Warning', 'Could not auto-save changes before closing');
          }
        }
      }

      // Clear all state
      useCanvasStore.getState().clearCanvas();
      useAnnotationStore.getState().clearAnnotations();
      useHistoryStore.getState().clear();
      useCropStore.getState().clearCrop();
      projectStore.getState().closeProject();
    } catch (e) {
      logError('useFileMenu:close', e);
    }
  }, [projectStore]);

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const state = projectStore.getState();
    if (!state.filePath) {
      toast.error('Delete Failed', 'No project file to delete.');
      return;
    }
    onDeleteRequest();
  }, [projectStore, onDeleteRequest]);

  // ─── Event Listeners ─────────────────────────────────────────
  useEffect(() => {
    let unlistenOpen: (() => void) | null = null;
    let unlistenSave: (() => void) | null = null;
    let unlistenExport: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;
    let unlistenDelete: (() => void) | null = null;

    listen('menu-file-open', handleOpen).then((fn) => { unlistenOpen = fn; });
    listen('menu-file-save', handleSave).then((fn) => { unlistenSave = fn; });
    listen('menu-file-export', handleExport).then((fn) => { unlistenExport = fn; });
    listen('menu-file-close', handleClose).then((fn) => { unlistenClose = fn; });
    listen('menu-file-delete', handleDelete).then((fn) => { unlistenDelete = fn; });

    return () => {
      unlistenOpen?.();
      unlistenSave?.();
      unlistenExport?.();
      unlistenClose?.();
      unlistenDelete?.();
    };
  }, [handleOpen, handleSave, handleExport, handleClose, handleDelete]);
}

// Re-export saveFile from file-api for the hook to use as showSaveDialog
import { showSaveDialog as _showSaveDialog } from '../utils/file-api';
```

Wait — there's a problem with the import above. The `showSaveDialog` function in `file-api.ts` filters by PNG/JPEG, but we need an unfiltered save dialog for `.bshot`. Let me fix the hook to use `@tauri-apps/plugin-dialog`'s `save()` directly for the `.bshot` path.

**Corrected hook — replace the final import block and the save dialog usage:**

At the top of the file, update imports:

```typescript
import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../stores/project-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useBackgroundStore } from '../stores/background-store';
import { useExportStore } from '../stores/export-store';
import { useCropStore } from '../stores/crop-store';
import { useHistoryStore } from '../stores/history-store';
import { toast } from '../stores/toast-store';
import {
  readProject,
  writeProject,
  showOpenDialog,
  normalizePath,
} from '../utils/file-api';
import type { ProjectSaveData, ProjectMetadata } from '../types/project';
import { logError } from '../utils/logger';
```

Then in the `handleSave` function, replace the `showSaveDialog` line:

```typescript
      if (!savePath) {
        const now = new Date();
        const defaultName = `screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.bshot`;
        savePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'beautiFULLshot Project', extensions: ['bshot'] }],
        });
        if (!savePath) return; // User cancelled
      }
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-file-menu.ts
git commit -m "feat: add use-file-menu hook for native File menu events"
```

---

### Task 8: Create delete-confirm-modal.tsx

**Goal:** Create a glass-styled confirmation modal for project deletion with three options: Move to Trash, Delete Permanently, Cancel.

**Files:**
- Create: `src/components/layout/delete-confirm-modal.tsx`

**Acceptance Criteria:**
- [ ] Three buttons: Move to Trash (primary), Delete Permanently (danger red), Cancel
- [ ] Displays the project filename being deleted
- [ ] Move to Trash calls `deleteFile(path, true)` → closes project → toast
- [ ] Delete Permanently calls `deleteFile(path, false)` → closes project → toast
- [ ] Cancel closes modal without action
- [ ] Follows existing glass-styled modal patterns (About, Settings)

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create `src/components/layout/delete-confirm-modal.tsx`**

```typescript
// DeleteConfirmModal — Confirmation dialog for project deletion
// Three options: Move to Trash, Delete Permanently, Cancel

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../../stores/project-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useHistoryStore } from '../../stores/history-store';
import { useCropStore } from '../../stores/crop-store';
import { toast } from '../../stores/toast-store';
import { deleteFile, extractFilename as getFilename } from '../../utils/file-api';
import { logError } from '../../utils/logger';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteConfirmModal({ isOpen, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const projectStore = useProjectStore;

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDeleting]);

  const filePath = projectStore.getState().filePath;
  const filename = filePath ? getFilename(filePath) : 'Unknown project';

  const handleDelete = useCallback(async (moveToTrash: boolean) => {
    if (!filePath) return;
    setIsDeleting(true);

    try {
      await deleteFile(filePath, moveToTrash);

      // Clear project state
      useCanvasStore.getState().clearCanvas();
      useAnnotationStore.getState().clearAnnotations();
      useHistoryStore.getState().clear();
      useCropStore.getState().clearCrop();
      projectStore.getState().closeProject();

      toast.success(
        moveToTrash ? 'Moved to Trash' : 'Deleted',
        `${filename} has been ${moveToTrash ? 'moved to trash' : 'permanently deleted'}`
      );

      onClose();
    } catch (e) {
      logError('DeleteConfirmModal', e);
      const message = e instanceof Error ? e.message : String(e);
      toast.error('Delete Failed', message);
    } finally {
      setIsDeleting(false);
    }
  }, [filePath, filename, projectStore, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => !isDeleting && e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="glass-heavy floating-panel w-[400px] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <div className="p-6">
          {/* Title with warning icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 id="delete-title" className="font-medium text-gray-800 dark:text-gray-200">Delete Project</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{filename}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            This action cannot be undone. How would you like to proceed?
          </p>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => handleDelete(true)}
              disabled={isDeleting}
              className="w-full py-2.5 glass-btn rounded-xl text-sm font-medium text-orange-500 hover:text-orange-600 transition-all disabled:opacity-50"
            >
              {isDeleting ? 'Moving to Trash...' : 'Move to Trash'}
            </button>
            <button
              onClick={() => handleDelete(false)}
              disabled={isDeleting}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 transition-all disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="w-full py-2.5 glass-btn rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

Note: We use `extractFilename` from `file-api.ts` — that function already exists. If it's not exported, add `export` before its `function` declaration.

- [ ] **Step 2: Verify the existing `extractFilename` is exported**

Read `src/utils/file-api.ts` line 22. If `extractFilename` is already `export function`, it's fine. If not, change:

```typescript
function extractFilename(path: string): string {
```

to:

```typescript
export function extractFilename(path: string): string {
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/delete-confirm-modal.tsx src/utils/file-api.ts
git commit -m "feat: add delete confirmation modal with trash/permanent/cancel options"
```
