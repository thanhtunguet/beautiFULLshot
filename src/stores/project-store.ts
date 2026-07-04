// Project store — Zustand state for project file management
// Tracks file path, dirty state, and open/close lifecycle

import { create } from 'zustand';
import { useCanvasStore } from './canvas-store';
import { useAnnotationStore } from './annotation-store';
import { useBackgroundStore } from './background-store';

export interface ProjectState {
  filePath: string | null;
  isDirty: boolean;
  isOpen: boolean;

  markDirty: () => void;
  markClean: () => void;
  openProject: (path: string) => void;
  closeProject: () => void;
  setFilePath: (path: string) => void;
}

let subscriptionsActive = false;

function setupDirtyTracking() {
  if (subscriptionsActive) return;
  subscriptionsActive = true;

  const markDirty = () => {
    const state = useProjectStore.getState();
    if (state.isOpen && !state.isDirty) {
      useProjectStore.setState({ isDirty: true });
    }
  };

  // Watch canvas store for image changes
  useCanvasStore.subscribe((state, prevState) => {
    if (
      state.imageUrl !== prevState.imageUrl ||
      state.originalWidth !== prevState.originalWidth ||
      state.originalHeight !== prevState.originalHeight
    ) {
      markDirty();
    }
  });

  // Watch annotation store for annotation changes
  useAnnotationStore.subscribe((state, prevState) => {
    if (state.annotations !== prevState.annotations) {
      markDirty();
    }
  });

  // Watch background store for setting changes
  let prevBgType = useBackgroundStore.getState().type;
  let prevBlur = useBackgroundStore.getState().blurAmount;
  let prevShadow = useBackgroundStore.getState().shadowBlur;
  let prevRadius = useBackgroundStore.getState().cornerRadius;
  let prevPadding = useBackgroundStore.getState().paddingPercent;
  let prevBorderWidth = useBackgroundStore.getState().borderWidth;
  let prevBorderColor = useBackgroundStore.getState().borderColor;
  let prevBorderOpacity = useBackgroundStore.getState().borderOpacity;
  let prevGradientId = useBackgroundStore.getState().gradient?.id ?? null;
  let prevSolidColor = useBackgroundStore.getState().solidColor;

  useBackgroundStore.subscribe((state) => {
    if (
      state.type !== prevBgType ||
      state.blurAmount !== prevBlur ||
      state.shadowBlur !== prevShadow ||
      state.cornerRadius !== prevRadius ||
      state.paddingPercent !== prevPadding ||
      state.borderWidth !== prevBorderWidth ||
      state.borderColor !== prevBorderColor ||
      state.borderOpacity !== prevBorderOpacity ||
      state.gradient?.id !== prevGradientId ||
      state.solidColor !== prevSolidColor
    ) {
      prevBgType = state.type;
      prevBlur = state.blurAmount;
      prevShadow = state.shadowBlur;
      prevRadius = state.cornerRadius;
      prevPadding = state.paddingPercent;
      prevBorderWidth = state.borderWidth;
      prevBorderColor = state.borderColor;
      prevBorderOpacity = state.borderOpacity;
      prevGradientId = state.gradient?.id ?? null;
      prevSolidColor = state.solidColor;
      markDirty();
    }
  });
}

export const useProjectStore = create<ProjectState>(() => {
  setupDirtyTracking();

  return {
    filePath: null,
    isDirty: false,
    isOpen: false,

    markDirty: () => {
      const state = useProjectStore.getState();
      if (state.isOpen && !state.isDirty) {
        useProjectStore.setState({ isDirty: true });
      }
    },

    markClean: () => useProjectStore.setState({ isDirty: false }),

    openProject: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),

    closeProject: () =>
      useProjectStore.setState({
        filePath: null,
        isDirty: false,
        isOpen: false,
      }),

    setFilePath: (path: string) =>
      useProjectStore.setState({
        filePath: path,
        isDirty: false,
        isOpen: true,
      }),
  };
});
