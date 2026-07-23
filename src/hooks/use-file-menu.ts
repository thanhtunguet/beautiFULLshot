// useFileMenu — Listens for native File menu events and orchestrates actions

import { useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Event } from '@tauri-apps/api/event';
import { useProjectStore } from '../stores/project-store';
import { pickAndOpen } from '../utils/file-api';
import {
  saveProject,
  openImageFromBytes,
  openProjectFromData,
  guardedProjectTransition,
  closeProjectAndClearCanvas,
  tryAcquireTransitionLock,
} from '../utils/project-io';
import { toast } from '../stores/toast-store';

interface UseFileMenuOptions {
  onDeleteRequest: () => void;
  exportSaveAsRef: React.MutableRefObject<
    (() => Promise<string | null>) | null
  >;
}

/**
 * Module-level ref to the latest handleSave callback, so keyboard handlers
 * can invoke project save imperatively when Cmd/Ctrl+S is pressed and a
 * project is open (use-keyboard-shortcuts.ts).
 */
export const projectSaveRef: React.MutableRefObject<
  (() => Promise<void>) | null
> = { current: null };

export function useFileMenu({
  onDeleteRequest,
  exportSaveAsRef,
}: UseFileMenuOptions) {
  const projectStore = useProjectStore;

  // Re-entrancy guard for Export (a blocking native dialog, not a
  // project-replacing transition, so it doesn't use the shared
  // transition lock in project-io.ts).
  const isExportBusyRef = useRef(false);

  // ─── Open ────────────────────────────────────────────────────
  const handleOpen = useCallback(async (_event: Event<unknown>) => {
    await guardedProjectTransition(async () => {
      const result = await pickAndOpen();
      if (result.kind === 'cancelled') return;

      if (result.kind === 'project') {
        await openProjectFromData(
          result.path,
          result.data.metadata,
          result.data.screenshotBytes,
          result.data.backgroundImageBytes
        );
      } else {
        await openImageFromBytes(result.path, new Uint8Array(result.bytes));
      }
    });
  }, []);

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = useCallback(async (_event: Event<unknown>) => {
    await saveProject();
  }, []);

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(
    async (_event: Event<unknown>) => {
      if (isExportBusyRef.current) return;
      if (exportSaveAsRef.current) {
        isExportBusyRef.current = true;
        try {
          await exportSaveAsRef.current();
        } finally {
          isExportBusyRef.current = false;
        }
      }
    },
    [exportSaveAsRef]
  );

  // ─── Close ───────────────────────────────────────────────────
  const handleClose = useCallback(async (_event: Event<unknown>) => {
    await guardedProjectTransition(async () => {
      await closeProjectAndClearCanvas();
    });
  }, []);

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = useCallback(
    (_event: Event<unknown>) => {
      const state = projectStore.getState();
      if (!state.filePath) {
        toast.error('Delete Failed', 'No project file to delete.');
        return;
      }
      if (!tryAcquireTransitionLock()) {
        toast.error('Delete Failed', 'Please finish the current action first.');
        return;
      }
      // Lock is released by App.tsx's DeleteConfirmModal onClose handler.
      onDeleteRequest();
    },
    [projectStore, onDeleteRequest]
  );

  // ─── Event Listeners ─────────────────────────────────────────
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    listen('menu-file-open', handleOpen).then((fn) =>
      unlisteners.push(fn)
    );
    listen('menu-file-save', handleSave).then((fn) =>
      unlisteners.push(fn)
    );
    listen('menu-file-export', handleExport).then((fn) =>
      unlisteners.push(fn)
    );
    listen('menu-file-close', handleClose).then((fn) =>
      unlisteners.push(fn)
    );
    listen('menu-file-delete', handleDelete).then((fn) =>
      unlisteners.push(fn)
    );

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [handleOpen, handleSave, handleExport, handleClose, handleDelete]);

  // Expose save callback for keyboard shortcut handler
  projectSaveRef.current = () => handleSave({} as Event<unknown>);
}
