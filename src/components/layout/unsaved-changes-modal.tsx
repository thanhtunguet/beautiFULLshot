// UnsavedChangesModal — Save / Discard / Cancel prompt shown by
// confirmDiscardIfDirty() (project-io.ts) before any transition that would
// replace the current project (Open, Close, Capture, Paste, Drop, pickers).

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useUnsavedChangesStore } from '../../stores/unsaved-changes-store';
import { useProjectStore } from '../../stores/project-store';
import { extractFilename } from '../../utils/file-api';

export function UnsavedChangesModal() {
  const isOpen = useUnsavedChangesStore((s) => s.isOpen);
  const resolve = useUnsavedChangesStore((s) => s.resolve);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) resolve('cancel');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, resolve]);

  const filePath = useProjectStore((s) => s.filePath);
  const filename = filePath ? extractFilename(filePath) : 'Untitled project';

  const handleSave = useCallback(() => {
    setIsSaving(true);
    // resolve() triggers confirmDiscardIfDirty()'s awaiting saveProject()
    // call; isSaving here only affects this modal's own button state, the
    // modal is dismissed by the isOpen flip once resolve() runs.
    resolve('save');
  }, [resolve]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => !isSaving && e.target === e.currentTarget && resolve('cancel')}
    >
      <div
        ref={modalRef}
        className="glass-heavy floating-panel w-[420px] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 id="unsaved-changes-title" className="font-medium text-gray-800 dark:text-gray-200">Unsaved Changes</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{filename}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            This project has unsaved changes. Do you want to save before continuing?
          </p>

          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => resolve('discard')}
              disabled={isSaving}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 transition-all disabled:opacity-50"
            >
              Discard Changes
            </button>
            <button
              onClick={() => resolve('cancel')}
              disabled={isSaving}
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
