// EditorLayout - Main application layout with toolbar, canvas, and sidebar

import { useCallback, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { CanvasEditor } from '../canvas/canvas-editor';
import { ZoomControls } from '../canvas/zoom-controls';
import { Toolbar } from '../toolbar/toolbar';
import { Sidebar } from '../sidebar/sidebar';
import { WindowPickerModal } from '../capture/window-picker-modal';
import { MonitorPickerModal } from '../capture/monitor-picker-modal';
import { useUIStore } from '../../stores/ui-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { logError } from '../../utils/logger';
import {
  isSupportedImagePath,
  openImageBytes,
  openImageFile,
  openProjectFile,
} from '../../utils/project-io';
import { toast } from '../../stores/toast-store';

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

function normalizeClipboardPathToken(token: string): string | null {
  const trimmed = token.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed || trimmed.startsWith('#')) return null;

  if (trimmed.startsWith('file://')) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'file:') return null;

      const decodedPath = decodeURIComponent(url.pathname);
      if (!decodedPath) return null;

      // On Windows, file:///C:/... becomes /C:/... in pathname.
      if (/^\/[A-Za-z]:\//.test(decodedPath)) {
        return decodedPath.slice(1);
      }

      // UNC path format: file://server/share/path -> //server/share/path
      if (url.host) {
        return `//${url.host}${decodedPath}`;
      }

      return decodedPath;
    } catch {
      return null;
    }
  }

  return trimmed;
}

function extractImagePathsFromText(rawText: string): string[] {
  if (!rawText) return [];

  const candidates = rawText
    .split(/\r?\n/)
    .map(normalizeClipboardPathToken)
    .filter((value): value is string => Boolean(value));

  return candidates.filter((value) => isSupportedImagePath(value));
}

function extractImagePathsFromClipboard(clipboard: DataTransfer | null): string[] {
  if (!clipboard) return [];

  const uriList = clipboard.getData('text/uri-list');
  const plainText = clipboard.getData('text/plain');

  const allPaths = [
    ...extractImagePathsFromText(uriList),
    ...extractImagePathsFromText(plainText),
  ];

  return Array.from(new Set(allPaths));
}

export function EditorLayout() {
  const { isWindowPickerOpen, closeWindowPicker, isMonitorPickerOpen, closeMonitorPicker } = useUIStore();
  const { imageBytes, setImageFromBytes, fitToView } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);
  const isCanvasEmpty = !imageBytes;

  // Handle window capture with auto-fit
  const handleWindowCapture = useCallback(
    (bytes: Uint8Array, width: number, height: number) => {
      setImageFromBytes(bytes, width, height);
      // Auto-fit to view after capture
      setTimeout(() => fitToView(), 50);
    },
    [setImageFromBytes, fitToView]
  );

  const openPathAsProjectOrImage = useCallback(async (rawPath: string) => {
    const path = rawPath.trim();
    if (!path) return false;

    if (path.toLowerCase().endsWith('.bshot')) {
      await openProjectFile(path);
      return true;
    }

    if (isSupportedImagePath(path)) {
      await openImageFile(path);
      return true;
    }

    return false;
  }, []);

  // Handle image load from File/Blob when absolute path is not available
  const handleImageFile = useCallback(async (file: File | Blob) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const sourceName = file instanceof File ? file.name : undefined;
      await openImageBytes(bytes, sourceName);
    } catch (e) {
      logError('EditorLayout:handleImageFile', e);
      toast.error('Open Failed', 'Could not read image data from clipboard/drop.');
    }
  }, []);

  const handleDroppedFile = useCallback(
    async (file: File) => {
      const fileName = file.name || '';
      const filePath = (file as File & { path?: string }).path;

      if (filePath) {
        await openPathAsProjectOrImage(filePath);
        return;
      }

      if (fileName.toLowerCase().endsWith('.bshot')) {
        toast.error('Open Failed', 'Could not determine file path. Use File > Open instead.');
        return;
      }

      const isImage = file.type.startsWith('image/') || isSupportedImagePath(fileName);
      if (isImage) {
        await handleImageFile(file);
      }
    },
    [handleImageFile, openPathAsProjectOrImage]
  );

  // Handle paste from clipboard only when no image is currently loaded.
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isCanvasEmpty) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              await handleImageFile(file);
            }
            return;
          }
        }
      }

      const clipboardFiles = Array.from(e.clipboardData?.files || []);
      const imageFile = clipboardFiles.find(
        (file) => file.type.startsWith('image/') || isSupportedImagePath(file.name)
      );
      if (imageFile) {
        e.preventDefault();
        await handleImageFile(imageFile);
        return;
      }

      const eventPaths = extractImagePathsFromClipboard(e.clipboardData);
      if (eventPaths[0]) {
        e.preventDefault();
        await openPathAsProjectOrImage(eventPaths[0]);
        return;
      }

      // Fallback for platforms where paste event doesn't expose file paths.
      try {
        const fallbackText = await readText();
        const fallbackPath = extractImagePathsFromText(fallbackText)[0];
        if (fallbackPath) {
          e.preventDefault();
          await openPathAsProjectOrImage(fallbackPath);
        }
      } catch {
        // Ignore clipboard API failures and let normal paste behavior continue.
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImageFile, isCanvasEmpty, openPathAsProjectOrImage]);

  // Tauri native file-drop events provide reliable absolute paths for Finder/Explorer drops.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | null = null;

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        switch (event.payload.type) {
          case 'enter':
          case 'over':
            setIsDragging(true);
            break;
          case 'leave':
            setIsDragging(false);
            break;
          case 'drop':
            setIsDragging(false);
            if (event.payload.paths.length > 0) {
              await openPathAsProjectOrImage(event.payload.paths[0]);
            }
            break;
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        logError('EditorLayout:onDragDropEvent', error);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [openPathAsProjectOrImage]);

  // Browser fallback for dev mode / non-Tauri runtime.
  useEffect(() => {
    if (isTauriRuntime()) return;

    let dragCounter = 0;

    const handleDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await handleDroppedFile(files[0]);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDroppedFile]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden canvas-area spatial-gap">
      {/* Top toolbar - floating glass panel */}
      <Toolbar />

      {/* Main content area with spatial gaps */}
      <div className="flex-1 flex min-h-0 overflow-hidden gap-3">
        {/* Canvas area - central focus with rounded corners */}
        <div className="flex-1 relative min-w-0 overflow-hidden rounded-2xl">
          <CanvasEditor />
          <ZoomControls />
        </div>

        {/* Right sidebar - floating glass panel */}
        <Sidebar />
      </div>

      {/* Drag overlay indicator */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] bg-orange-500/20 border-4 border-dashed border-orange-500 flex items-center justify-center pointer-events-none">
          <div className="glass-heavy rounded-2xl px-8 py-6 text-center">
            <svg className="w-16 h-16 mx-auto mb-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Drop image here</p>
          </div>
        </div>
      )}

      {/* Window picker modal */}
      <WindowPickerModal
        isOpen={isWindowPickerOpen}
        onClose={closeWindowPicker}
        onCapture={handleWindowCapture}
      />

      {/* Monitor picker modal for region capture */}
      <MonitorPickerModal
        isOpen={isMonitorPickerOpen}
        onClose={closeMonitorPicker}
      />
    </div>
  );
}
