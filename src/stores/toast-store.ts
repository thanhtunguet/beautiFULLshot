// Toast store - Zustand state for in-app toast notifications

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ToastData } from '../components/common/toast';

interface ToastState {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: nanoid() }],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}));

// Helper functions for common toast types
export const toast = {
  success: (title: string, message: string, filePath?: string) => {
    useToastStore.getState().addToast({
      type: 'success',
      title,
      message,
      filePath,
    });
  },
  error: (title: string, message: string) => {
    useToastStore.getState().addToast({
      type: 'error',
      title,
      message,
    });
  },
  info: (title: string, message: string) => {
    useToastStore.getState().addToast({
      type: 'info',
      title,
      message,
    });
  },
};
