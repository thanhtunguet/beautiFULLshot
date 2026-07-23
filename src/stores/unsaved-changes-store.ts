// Unsaved-changes store — backs an imperative confirm(Save/Discard/Cancel)
// prompt, following the same pattern as toast-store.ts's imperative `toast`
// API. `project-io.ts`'s `confirmDiscardIfDirty()` awaits `request()`;
// `UnsavedChangesModal` renders while `isOpen` and calls `resolve()`.

import { create } from 'zustand';

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

interface UnsavedChangesState {
  isOpen: boolean;
  resolver: ((choice: UnsavedChangesChoice) => void) | null;
  request: () => Promise<UnsavedChangesChoice>;
  resolve: (choice: UnsavedChangesChoice) => void;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>((set, get) => ({
  isOpen: false,
  resolver: null,

  request: () => {
    return new Promise<UnsavedChangesChoice>((resolve) => {
      set({ isOpen: true, resolver: resolve });
    });
  },

  resolve: (choice) => {
    const { resolver } = get();
    set({ isOpen: false, resolver: null });
    resolver?.(choice);
  },
}));
