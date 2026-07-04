# Files Menu — Implementation Plan (Part 4: Integration + Wiring)

> Continue from Part 3. This part covers the drag-drop extension in EditorLayout and final wiring into App.tsx.

---

### Task 9: Add .bshot drag-drop to EditorLayout

**Goal:** Extend the existing drop handler in `EditorLayout` to recognize `.bshot` files and open them as projects instead of raw images.

**Files:**
- Modify: `src/components/layout/editor-layout.tsx`

**Acceptance Criteria:**
- [ ] `.bshot` files dropped onto the app open as projects (via `readProject` + `restoreProject`)
- [ ] Non-`.bshot` image files continue to work as before (raw image load)
- [ ] Both macOS Finder drag and browser drag sources work

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Modify the `handleDrop` in `src/components/layout/editor-layout.tsx`**

Open `src/components/layout/editor-layout.tsx`. Add new imports at the top (after existing imports):

```typescript
import { useProjectStore } from '../../stores/project-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useExportStore } from '../../stores/export-store';
import { useHistoryStore } from '../../stores/history-store';
import { readProject, normalizePath } from '../../utils/file-api';
import type { ProjectMetadata } from '../../types/project';
```

Then, inside the `EditorLayout` component, add a `restoreProject` helper function **before** the `handleDrop` closure (place it after the `handleImageFile` definition, around line 61):

```typescript
  // Restore all stores from loaded project data (used by both Open menu and drag-drop)
  const restoreProjectState = useCallback(
    (metadata: ProjectMetadata, screenshotBytes: Uint8Array) => {
      const annotationStore = useAnnotationStore.getState();
      const exportStore = useExportStore.getState();
      const historyStore = useHistoryStore.getState();
      // Keep background store for settings restores
      // (background store is imported at top, use directly)

      // Clear existing state first
      clearCanvas();
      annotationStore.clearAnnotations();
      historyStore.clear();

      // Note: background store methods need to be imported
    },
    [clearCanvas]
  );
```

Actually, this approach is getting complex because we need to access many store methods. The cleaner approach is to **invoke the same handler used by `use-file-menu.ts`**. Since that hook defines `handleOpen` internally, the best approach is to:

1. Make the drag-drop handler call `readProject` + invoke the project open flow directly
2. Or better: have the drag-drop handler emit a synthetic event or call a shared function

Let me take the simpler path — duplicate the restore logic inline (it's the same code as in `use-file-menu.ts`'s `restoreProject`). Here's the corrected approach:

**In `editor-layout.tsx`, find the `handleDrop` callback (around line 112). Replace it:**

```typescript
    const handleDrop = async (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const fileName = file.name || '';

        // Check if it's a .bshot project file
        if (fileName.toLowerCase().endsWith('.bshot')) {
          try {
            // Get the file path from the drop event
            // Tauri v2: the file path may be available via the file object
            const filePath = (file as any).path;
            if (!filePath) {
              // Fallback: read the file and save to a temp location, then read as project
              // For Tauri, we can use the file's path property if available
              // Otherwise, use the file name as a fallback
              const { toast: toastFn } = await import('../../stores/toast-store');
              toastFn.error('Open Failed', 'Could not determine file path. Use File > Open instead.');
              return;
            }

            const { readProject: readProj } = await import('../../utils/file-api');
            const result = await readProj(filePath);
            const screenshotBytes = new Uint8Array(result.metadata.screenshotBytes
              ? (Object.values(result.metadata.screenshotBytes) as unknown as number[])
              : result.screenshotBytes);

            // Restore project state
            const { useAnnotationStore: aStore } = await import('../../stores/annotation-store');
            const { useBackgroundStore: bgStore } = await import('../../stores/background-store');
            const { useExportStore: eStore } = await import('../../stores/export-store');
            const { useHistoryStore: hStore } = await import('../../stores/history-store');
            const { useCropStore: cStore } = await import('../../stores/crop-store');
            const { useProjectStore: pStore } = await import('../../stores/project-store');

            clearCanvas();
            clearAnnotations();
            hStore.getState().clear();
            cStore.getState().clearCrop();

            setImageFromBytes(
              screenshotBytes,
              result.metadata.canvas.originalWidth,
              result.metadata.canvas.originalHeight
            );

            aStore.getState().setState
              ? aStore.setState({ annotations: result.metadata.annotations })
              : null;

            // Restore background
            const bg = result.metadata.background;
            const bgActions = bgStore.getState();
            switch (bg.type) {
              case 'gradient':
                if (bg.gradient) bgActions.setGradient(bg.gradient);
                break;
              case 'solid':
                if (bg.solidColor) bgActions.setSolidColor(bg.solidColor);
                break;
              case 'transparent':
                bgActions.setTransparent();
                break;
              case 'wallpaper':
                if (bg.wallpaper) bgActions.setWallpaper(bg.wallpaper);
                break;
              case 'auto':
                bgActions.setAuto();
                break;
            }
            bgActions.setBlurAmount(bg.blurAmount);
            bgActions.setShadowBlur(bg.shadowBlur);
            bgActions.setCornerRadius(bg.cornerRadius);
            bgActions.setPaddingPercent(bg.paddingPercent);
            bgActions.setBorderWidth(bg.borderWidth);
            bgActions.setBorderColor(bg.borderColor);
            bgActions.setBorderOpacity(bg.borderOpacity);

            // Restore export settings
            const expActions = eStore.getState();
            expActions.setFormat(result.metadata.exportSettings.format);
            expActions.setQuality(result.metadata.exportSettings.quality);
            expActions.setPixelRatio(result.metadata.exportSettings.pixelRatio);
            expActions.setOutputAspectRatio(result.metadata.exportSettings.outputAspectRatio);

            pStore.getState().openProject(filePath);

            setTimeout(() => fitToView(), 100);

            const { toast: toastFn } = await import('../../stores/toast-store');
            toastFn.success('Opened', `Project loaded from ${fileName}`);
            return;
          } catch (e) {
            const { logError: logErr } = await import('../../utils/logger');
            logErr('EditorLayout:dropProject', e);
            const { toast: toastFn } = await import('../../stores/toast-store');
            const message = e instanceof Error ? e.message : String(e);
            toastFn.error('Open Failed', message);
            return;
          }
        }

        // Check MIME type or file extension for image files (existing behavior)
        const isImage = file.type.startsWith('image/') ||
          /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico|tiff?)$/i.test(fileName);
        if (isImage) {
          await handleImageFile(file);
        }
      }
    };
```

Hmm, that's messy with all the dynamic imports. The cleaner approach: extract the restore logic into a shared utility function in a new file. Let me create it.

**Step 1a: Create `src/utils/project-io.ts` — shared project I/O utilities**

```typescript
// project-io.ts — Shared project I/O functions used by both
// the File menu hook and drag-drop handler

import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useBackgroundStore } from '../stores/background-store';
import { useExportStore } from '../stores/export-store';
import { useCropStore } from '../stores/crop-store';
import { useHistoryStore } from '../stores/history-store';
import { useProjectStore } from '../stores/project-store';
import { toast } from '../stores/toast-store';
import { readProject, normalizePath } from './file-api';
import { logError } from './logger';
import type { ProjectMetadata, ProjectSaveData } from '../types/project';

/**
 * Restore all stores from loaded project data.
 * Used by both File > Open and drag-drop.
 */
export function restoreProjectFromData(
  metadata: ProjectMetadata,
  screenshotBytes: Uint8Array
) {
  const canvasStore = useCanvasStore.getState();
  const annotationStore = useAnnotationStore.getState();
  const backgroundStore = useBackgroundStore.getState();
  const exportStore = useExportStore.getState();
  const historyStore = useHistoryStore.getState();
  const cropStore = useCropStore.getState();

  // Clear existing state
  canvasStore.clearCanvas();
  annotationStore.clearAnnotations();
  historyStore.clear();
  cropStore.clearCrop();

  // Load screenshot
  canvasStore.setImageFromBytes(
    screenshotBytes,
    metadata.canvas.originalWidth,
    metadata.canvas.originalHeight
  );

  // Restore annotations
  useAnnotationStore.setState({ annotations: metadata.annotations });

  // Restore background
  const bg = metadata.background;
  const bgActions = backgroundStore;
  switch (bg.type) {
    case 'gradient':
      if (bg.gradient) bgActions.setGradient(bg.gradient);
      break;
    case 'solid':
      if (bg.solidColor) bgActions.setSolidColor(bg.solidColor);
      break;
    case 'transparent':
      bgActions.setTransparent();
      break;
    case 'wallpaper':
      if (bg.wallpaper) bgActions.setWallpaper(bg.wallpaper);
      break;
    case 'auto':
      bgActions.setAuto();
      break;
  }
  bgActions.setBlurAmount(bg.blurAmount);
  bgActions.setShadowBlur(bg.shadowBlur);
  bgActions.setCornerRadius(bg.cornerRadius);
  bgActions.setPaddingPercent(bg.paddingPercent);
  bgActions.setBorderWidth(bg.borderWidth);
  bgActions.setBorderColor(bg.borderColor);
  bgActions.setBorderOpacity(bg.borderOpacity);

  // Restore export settings
  exportStore.setFormat(metadata.exportSettings.format);
  exportStore.setQuality(metadata.exportSettings.quality);
  exportStore.setPixelRatio(metadata.exportSettings.pixelRatio);
  exportStore.setOutputAspectRatio(metadata.exportSettings.outputAspectRatio);

  // Fit to view
  setTimeout(() => canvasStore.fitToView(), 100);
}

/**
 * Open a .bshot project from a file path.
 * Handles the full open flow: read → restore → update store → toast.
 * Returns true on success, false on failure.
 */
export async function openProjectFile(path: string): Promise<boolean> {
  try {
    const result = await readProject(path);

    // Convert number[] to Uint8Array (IPC serialization)
    const bytes = Array.isArray(result.screenshotBytes)
      ? new Uint8Array(result.screenshotBytes)
      : new Uint8Array(
          Object.values(result.screenshotBytes as unknown as Record<string, number>)
        );

    restoreProjectFromData(result.metadata, bytes);
    useProjectStore.getState().openProject(path);

    const displayPath = normalizePath(path);
    toast.success(
      'Opened',
      `Project loaded from ${displayPath.split(/[\\/]/).pop()}`
    );
    return true;
  } catch (e) {
    logError('openProjectFile', e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error('Open Failed', message);
    return false;
  }
}
```

**Step 1b: Update the `use-file-menu.ts` hook** to use `openProjectFile` from the shared utility instead of its own inline `restoreProject`. Replace the `handleOpen` function body with:

```typescript
  const handleOpen = useCallback(async () => {
    const path = await showOpenDialog();
    if (!path) return;
    await openProjectFile(path);
  }, []);
```

And remove the inline `restoreProject` function from the hook.

**Step 1c: In `editor-layout.tsx`**, modify `handleDrop` — add the `.bshot` check **before** the existing image check. Add import at top:

```typescript
import { openProjectFile } from '../../utils/project-io';
```

In the `handleDrop` function, find the block:

```typescript
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          // Check MIME type or file extension (macOS Finder may not set MIME)
          const isImage = file.type.startsWith('image/') ||
            /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico|tiff?)$/i.test(file.name);
          if (isImage) {
            await handleImageFile(file);
          }
        }
```

Replace with:

```typescript
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          const fileName = file.name || '';

          // Check if it's a .bshot project file
          if (fileName.toLowerCase().endsWith('.bshot')) {
            // Tauri v2: file.path may be available on the File object
            const filePath = (file as any).path;
            if (filePath) {
              await openProjectFile(filePath);
            } else {
              toast.error('Open Failed', 'Could not determine file path. Use File > Open instead.');
            }
            return;
          }

          // Check MIME type or file extension (macOS Finder may not set MIME)
          const isImage = file.type.startsWith('image/') ||
            /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico|tiff?)$/i.test(fileName);
          if (isImage) {
            await handleImageFile(file);
          }
        }
```

Add the toast import at the top:

```typescript
import { toast } from '../../stores/toast-store';
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/project-io.ts src/hooks/use-file-menu.ts src/components/layout/editor-layout.tsx
git commit -m "feat: add .bshot drag-drop support and shared project-io utilities"
```

---

### Task 10: Wire file menu into App.tsx

**Goal:** Mount the `useFileMenu` hook and `DeleteConfirmModal` in the App component so the full file menu flow works end-to-end.

**Files:**
- Modify: `src/App.tsx`

**Acceptance Criteria:**
- [ ] `useFileMenu()` is called in App component
- [ ] A ref to `useExport().saveAs` is created for the export menu item
- [ ] `DeleteConfirmModal` is rendered alongside `ToastContainer` and `UpdateModal`
- [ ] Full end-to-end: Cmd+O opens dialog, Cmd+S saves, Cmd+Shift+E exports, Close Project clears, Delete shows modal

**Verify:** `npx tsc --noEmit` → no errors, then manual verification in macOS

**Steps:**

- [ ] **Step 1: Modify `src/App.tsx`**

Open `src/App.tsx`. Add imports at top:

```typescript
import { useRef, useState } from 'react';
import { useFileMenu } from './hooks/use-file-menu';
import { DeleteConfirmModal } from './components/layout/delete-confirm-modal';
import { useExport } from './hooks/use-export';
```

Inside the `App` function, after the `useHotkeys()` call and before the `useEffect` for dark mode, add:

```typescript
  // File menu: export integration (needs a ref to saveAs)
  const { saveAs } = useExport();
  const exportSaveAsRef = useRef(saveAs);
  exportSaveAsRef.current = saveAs;

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Wire up the File menu
  useFileMenu({
    onDeleteRequest: () => setIsDeleteModalOpen(true),
    exportSaveAsRef,
  });
```

Then update the return JSX (around line 127-133):

```tsx
  return (
    <>
      <EditorLayout />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <UpdateModal />
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </>
  );
```

The full updated `App` function body between the early returns and the final return should look like:

```typescript
  // Initialize global keyboard shortcuts (in-app)
  useKeyboardShortcuts();

  // Sync hotkey settings with backend on startup
  useSyncShortcuts();

  // Initialize global hotkeys listener (system-wide from Tauri)
  useHotkeys();

  // File menu: export integration (needs a ref to saveAs)
  const { saveAs } = useExport();
  const exportSaveAsRef = useRef(saveAs);
  exportSaveAsRef.current = saveAs;

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Wire up the File menu
  useFileMenu({
    onDeleteRequest: () => setIsDeleteModalOpen(true),
    exportSaveAsRef,
  });
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire File menu hook and DeleteConfirmModal into App"
```

- [ ] **Step 4: Manual verification**

1. Run the app: `npm run tauri dev`
2. Check menu bar: File menu appears before Edit with all 5 items
3. Cmd+O → file picker opens with .bshot filter
4. Take a screenshot, annotate, Cmd+S → save dialog → verify .bshot file created
5. Close Project → canvas clears (auto-saves if dirty)
6. Cmd+O → re-open saved file → annotations restored
7. Delete → confirmation modal → Move to Trash → file gone
8. Drag .bshot file onto app window → opens as project
