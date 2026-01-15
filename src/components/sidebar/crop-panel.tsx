// CropPanel - UI for crop mode with aspect ratio selection

import { ASPECT_RATIOS, OUTPUT_ASPECT_RATIOS } from '../../data/aspect-ratios';
import { useCropStore } from '../../stores/crop-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useExportStore } from '../../stores/export-store';

export function CropPanel() {
  // Use selectors for proper Zustand 5.0 subscription
  const isCropping = useCropStore((state) => state.isCropping);
  const aspectRatio = useCropStore((state) => state.aspectRatio);
  const cropRect = useCropStore((state) => state.cropRect);
  const startCrop = useCropStore((state) => state.startCrop);
  const applyCrop = useCropStore((state) => state.applyCrop);
  const cancelCrop = useCropStore((state) => state.cancelCrop);
  const setAspectRatio = useCropStore((state) => state.setAspectRatio);
  const setCropRect = useCropStore((state) => state.setCropRect);
  const imageUrl = useCanvasStore((state) => state.imageUrl);
  const originalWidth = useCanvasStore((state) => state.originalWidth);
  const originalHeight = useCanvasStore((state) => state.originalHeight);
  const cropImage = useCanvasStore((state) => state.cropImage);
  const fitToView = useCanvasStore((state) => state.fitToView);
  const outputAspectRatio = useExportStore((state) => state.outputAspectRatio);
  const setOutputAspectRatio = useExportStore((state) => state.setOutputAspectRatio);

  // Disable crop if no image loaded
  const canCrop = imageUrl !== null && originalWidth > 0;

  // Handle aspect ratio change - recalculate crop rect to match new ratio
  const handleAspectRatioChange = (newRatio: number | null) => {
    setAspectRatio(newRatio);

    // Get current rect or default
    const currentRect = cropRect || {
      x: originalWidth * 0.1,
      y: originalHeight * 0.1,
      width: originalWidth * 0.8,
      height: originalHeight * 0.8,
    };

    // For freeform (null ratio), keep current rect as-is
    if (newRatio === null) {
      setCropRect(currentRect);
      return;
    }

    // Calculate new dimensions maintaining center point
    const centerX = currentRect.x + currentRect.width / 2;
    const centerY = currentRect.y + currentRect.height / 2;

    let newWidth: number;
    let newHeight: number;

    // Determine new size based on aspect ratio, fitting within current rect area
    const currentRatio = currentRect.width / currentRect.height;
    if (newRatio > currentRatio) {
      // New ratio is wider - use current width, calculate height
      newWidth = currentRect.width;
      newHeight = newWidth / newRatio;
    } else {
      // New ratio is taller - use current height, calculate width
      newHeight = currentRect.height;
      newWidth = newHeight * newRatio;
    }

    // Calculate new position (centered on same point)
    let newX = centerX - newWidth / 2;
    let newY = centerY - newHeight / 2;

    // Clamp to image bounds
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + newWidth > originalWidth) newX = originalWidth - newWidth;
    if (newY + newHeight > originalHeight) newY = originalHeight - newHeight;

    // If still out of bounds (rect too large), scale down
    if (newX < 0 || newY < 0) {
      const scaleX = originalWidth / newWidth;
      const scaleY = originalHeight / newHeight;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% of max to leave margin
      newWidth *= scale;
      newHeight *= scale;
      newX = (originalWidth - newWidth) / 2;
      newY = (originalHeight - newHeight) / 2;
    }

    setCropRect({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: newWidth,
      height: newHeight,
    });
  };

  const handleStartCrop = () => {
    if (canCrop) {
      startCrop();
    }
  };

  const handleApplyCrop = async () => {
    // Use current cropRect or default to 80% centered if not set
    const rect = cropRect || {
      x: originalWidth * 0.1,
      y: originalHeight * 0.1,
      width: originalWidth * 0.8,
      height: originalHeight * 0.8,
    };

    // Crop the image
    await cropImage(rect);

    // Close crop mode
    applyCrop();
  };

  // Handle output aspect ratio change with auto-fit
  const handleOutputRatioChange = (ratioId: string) => {
    setOutputAspectRatio(ratioId);
    setTimeout(() => fitToView(), 0);
  };

  return (
    <div className="p-2 glass-flat rounded-xl mb-1.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Crop</h3>
        {!isCropping && (
          <button
            onClick={handleStartCrop}
            disabled={!canCrop}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              canCrop
                ? 'glass-btn text-orange-500 hover:text-orange-600'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {canCrop ? 'Start' : 'No image'}
          </button>
        )}
      </div>

      {isCropping && (
        <>
          {/* Aspect ratio presets */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.id}
                onClick={() => handleAspectRatioChange(ar.ratio)}
                className={`px-1.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  aspectRatio === ar.ratio
                    ? 'glass-btn glass-btn-active text-orange-500'
                    : 'glass-btn text-gray-600 dark:text-gray-300'
                }`}
              >
                {ar.name}
              </button>
            ))}
          </div>

          {/* Apply/Cancel buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={handleApplyCrop}
              className="flex-1 py-1.5 glass-btn glass-btn-active text-orange-500 rounded-lg text-xs font-medium transition-all"
            >
              Apply
            </button>
            <button
              onClick={cancelCrop}
              className="flex-1 py-1.5 glass-btn text-gray-600 dark:text-gray-300 rounded-lg text-xs transition-all"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Output aspect ratio selection */}
      <div className="mt-2 pt-2 border-t border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500 dark:text-gray-400">Output Ratio</label>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {OUTPUT_ASPECT_RATIOS.find((r) => r.id === outputAspectRatio)?.name || 'Auto'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {OUTPUT_ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.id}
              onClick={() => handleOutputRatioChange(ratio.id)}
              className={`py-1 px-1 rounded text-xs font-medium transition-all ${
                outputAspectRatio === ratio.id
                  ? 'glass-btn glass-btn-active text-orange-500'
                  : 'glass-btn text-gray-600 dark:text-gray-300'
              }`}
              title={ratio.name}
            >
              {ratio.id === 'auto' ? 'Auto' : ratio.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
