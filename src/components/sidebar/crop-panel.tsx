// CropPanel - UI for crop mode with aspect ratio selection

import { ASPECT_RATIOS } from '../../data/aspect-ratios';
import { useCropStore } from '../../stores/crop-store';

export function CropPanel() {
  const { isCropping, aspectRatio, startCrop, applyCrop, cancelCrop, setAspectRatio } =
    useCropStore();

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="font-medium mb-3 text-gray-800">Crop</h3>

      {!isCropping ? (
        <button
          onClick={() => startCrop()}
          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Start Crop
        </button>
      ) : (
        <>
          {/* Aspect ratio presets */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.id}
                onClick={() => setAspectRatio(ar.ratio)}
                className={`px-2 py-1.5 text-sm rounded transition-colors ${
                  aspectRatio === ar.ratio
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {ar.name}
              </button>
            ))}
          </div>

          {/* Apply/Cancel buttons */}
          <div className="flex gap-2">
            <button
              onClick={applyCrop}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={cancelCrop}
              className="flex-1 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
