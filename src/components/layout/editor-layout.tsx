// EditorLayout - Main application layout with toolbar, canvas, and sidebar

import { useCallback, useEffect, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { listen } from '@tauri-apps/api/event';
import { CanvasEditor } from '../canvas/canvas-editor';
import { ZoomControls } from '../canvas/zoom-controls';
import { Toolbar } from '../toolbar/toolbar';
import { Sidebar } from '../sidebar/sidebar';
import { WindowPickerModal } from '../capture/window-picker-modal';
import { MonitorPickerModal } from '../capture/monitor-picker-modal';
import { useUIStore } from '../../stores/ui-store';
import { logError } from '../../utils/logger';
import { readDroppedProject, readDroppedImage } from '../../utils/file-api';
import {
  guardedProjectTransition,
  loadImageAsNewCanvas,
  openImageFromBytes,
  openProjectFromData,
  getImageDimensionsFromBytes,
} from '../../utils/project-io';
import { toast } from '../../stores/toast-store';

const IMAGE_EXTENSION_RE = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico|tiff?)$/i;

export function EditorLayout() {
  const { isWindowPickerOpen, closeWindowPicker, isMonitorPickerOpen, closeMonitorPicker } = useUIStore();
  const [isDragging, setIsDragging] = useState(false);

  // Handle window capture with auto-fit — replacing the canvas, so this is
  // a guarded transition like every other capture path.
  const handleWindowCapture = useCallback(
    async (bytes: Uint8Array, width: number, height: number) => {
      await guardedProjectTransition(async () => {
        await loadImageAsNewCanvas(bytes, width, height);
      });
    },
    []
  );

  // Handle image load from File/Blob (paste). No filesystem path is
  // available here, so this doesn't go through openImageFromBytes.
  const handleImageFile = useCallback(async (file: File | Blob) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const { width, height } = await getImageDimensionsFromBytes(bytes);
      await guardedProjectTransition(async () => {
        await loadImageAsNewCanvas(bytes, width, height);
      });
    } catch (e) {
      logError('EditorLayout:handleImageFile', e);
    }
  }, []);

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

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
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImageFile]);

  // Drag-hover highlight only. Tauri's own drag-drop event fires *before*
  // the Rust handler that authorizes the dropped paths, so acting on its
  // 'drop' here would race that authorization. The actual open is driven by
  // the `files-dropped` event below, which Rust emits only after granting.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const type = event.payload.type;
        setIsDragging(type === 'enter' || type === 'over');
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);

  // Open a file the OS dropped on the window. Emitted by the Rust drag-drop
  // handler after it has recorded a one-use read grant for each path, so
  // these reads are the only ones the backend will honor.
  useEffect(() => {
    const unlisten = listen<string[]>('files-dropped', (event) => {
      const path = event.payload[0];
      if (!path) return;

      const isProject = path.toLowerCase().endsWith('.bshot');
      const isImage = IMAGE_EXTENSION_RE.test(path);

      if (isProject) {
        void guardedProjectTransition(async () => {
          const result = await readDroppedProject(path);
          await openProjectFromData(
            path,
            result.metadata,
            result.screenshotBytes,
            result.backgroundImageBytes
          );
        });
      } else if (isImage) {
        void guardedProjectTransition(async () => {
          const bytes = await readDroppedImage(path);
          await openImageFromBytes(path, bytes);
        });
      } else {
        toast.error('Open Failed', 'Unsupported file type.');
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Drop image or .bshot project here</p>
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
