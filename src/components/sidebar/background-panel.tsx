// BackgroundPanel - UI for selecting background gradients, colors, and padding

import { GRADIENT_PRESETS, SOLID_COLORS } from '../../data/gradients';
import { useBackgroundStore } from '../../stores/background-store';

export function BackgroundPanel() {
  const { type, gradient, solidColor, padding, setGradient, setSolidColor, setTransparent, setPadding } =
    useBackgroundStore();

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="font-medium mb-3 text-gray-800">Background</h3>

      {/* Gradient presets grid */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-2">Gradients</p>
        <div className="grid grid-cols-6 gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setGradient(preset)}
              className={`w-8 h-8 rounded transition-all ${
                type === 'gradient' && gradient?.id === preset.id
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-gray-300'
              }`}
              style={{
                background: `linear-gradient(${preset.angle || 135}deg, ${preset.colors.join(', ')})`,
              }}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      {/* Solid colors */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Solid Colors</p>
        <div className="flex gap-2">
          {SOLID_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSolidColor(c.color)}
              className={`w-6 h-6 rounded border border-gray-300 transition-all ${
                type === 'solid' && solidColor === c.color
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-gray-300'
              }`}
              style={{ background: c.color }}
              title={c.name}
            />
          ))}
          <button
            onClick={setTransparent}
            className={`w-6 h-6 rounded border border-gray-300 transition-all ${
              type === 'transparent'
                ? 'ring-2 ring-blue-500 ring-offset-1'
                : 'hover:ring-1 hover:ring-gray-300'
            }`}
            style={{
              background:
                'repeating-linear-gradient(45deg, #ccc, #ccc 3px, #fff 3px, #fff 6px)',
            }}
            title="Transparent"
          />
        </div>
      </div>

      {/* Padding slider */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Padding: {padding}px
        </label>
        <input
          type="range"
          min="0"
          max="200"
          value={padding}
          onChange={(e) => setPadding(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
