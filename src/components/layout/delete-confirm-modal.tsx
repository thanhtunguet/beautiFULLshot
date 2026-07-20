// DeleteConfirmModal — Confirmation dialog for project deletion

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../../stores/project-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useHistoryStore } from '../../stores/history-store';
import { useCropStore } from '../../stores/crop-store';
import { toast } from '../../stores/toast-store';
import { deleteFile, extractFilename } from '../../utils/file-api';
import { logError } from '../../utils/logger';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteConfirmModal({ isOpen, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDeleting]);

  const filePath = useProjectStore.getState().filePath;
  const filename = filePath ? extractFilename(filePath) : 'Unknown project';

  const handleDelete = useCallback(async (moveToTrash: boolean) => {
    if (!filePath) return;
    setIsDeleting(true);

    try {
      await deleteFile(filePath, moveToTrash);

      // Clear all project state
      useCanvasStore.getState().clearCanvas();
      useAnnotationStore.getState().clearAnnotations();
      useHistoryStore.getState().clear();
      useCropStore.getState().clearCrop();
      useProjectStore.getState().closeProject();

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
  }, [filePath, filename, onClose]);

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
