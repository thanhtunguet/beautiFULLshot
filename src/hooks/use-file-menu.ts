// useFileMenu — Listens for native File menu events and orchestrates actions

import { useEffect, useCallback } from 'react';
import type React from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Event } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../stores/project-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useHistoryStore } from '../stores/history-store';
import { useCropStore } from '../stores/crop-store';
import { toast } from '../stores/toast-store';
import {
  writeProject,
  showOpenDialog,
  normalizePath,
} from '../utils/file-api';
import {
  openProjectFile,
  buildProjectMetadata,
} from '../utils/project-io';
import type { ProjectSaveData } from '../types/project';
import { logError } from '../utils/logger';

interface UseFileMenuOptions {
  onDeleteRequest: () => void;
  exportSaveAsRef: React.MutableRefObject<
    (() => Promise<string | null>) | null
  >;
}

export function useFileMenu({
  onDeleteRequest,
  exportSaveAsRef,
}: UseFileMenuOptions) {
  const projectStore = useProjectStore;

  // ─── Open ────────────────────────────────────────────────────
  const handleOpen = useCallback(async (_event: Event<unknown>) => {
    const path = await showOpenDialog();
    if (!path) return;
    await openProjectFile(path);
  }, []);

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (_event: Event<unknown>) => {
      try {
        const state = projectStore.getState();
        const canvas = useCanvasStore.getState();

        if (!canvas.imageBytes) {
          toast.error(
            'Save Failed',
            'No image to save. Take a screenshot first.'
          );
          return;
        }

        let savePath = state.filePath;

        if (!savePath) {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const defaultName = `screenshot_${now.getFullYear()}${pad(
            now.getMonth() + 1
          )}${pad(now.getDate())}_${pad(now.getHours())}${pad(
            now.getMinutes()
          )}${pad(now.getSeconds())}.bshot`;
          savePath = await save({
            defaultPath: defaultName,
            filters: [
              { name: 'beautiFULLshot Project', extensions: ['bshot'] },
            ],
          });
          if (!savePath) return;
        }

        const metadata = buildProjectMetadata();
        const data: ProjectSaveData = {
          metadata,
          screenshotBytes: Array.from(canvas.imageBytes),
        };

        const savedPath = await writeProject(savePath, data);
        const displayPath = normalizePath(savedPath);
        projectStore.getState().setFilePath(displayPath);

        toast.success(
          'Saved',
          `Project saved to ${displayPath.split(/[\\/]/).pop()}`,
          displayPath
        );
      } catch (e) {
        logError('useFileMenu:save', e);
        const message = e instanceof Error ? e.message : String(e);
        toast.error('Save Failed', message);
      }
    },
    [projectStore]
  );

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(
    async (_event: Event<unknown>) => {
      if (exportSaveAsRef.current) {
        await exportSaveAsRef.current();
      }
    },
    [exportSaveAsRef]
  );

  // ─── Close ───────────────────────────────────────────────────
  const handleClose = useCallback(
    async (_event: Event<unknown>) => {
      try {
        const state = projectStore.getState();

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
              toast.error(
                'Warning',
                'Could not auto-save changes before closing'
              );
            }
          }
        }

        useCanvasStore.getState().clearCanvas();
        useAnnotationStore.getState().clearAnnotations();
        useHistoryStore.getState().clear();
        useCropStore.getState().clearCrop();
        projectStore.getState().closeProject();
      } catch (e) {
        logError('useFileMenu:close', e);
      }
    },
    [projectStore]
  );

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = useCallback(
    (_event: Event<unknown>) => {
      const state = projectStore.getState();
      if (!state.filePath) {
        toast.error('Delete Failed', 'No project file to delete.');
        return;
      }
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
}
