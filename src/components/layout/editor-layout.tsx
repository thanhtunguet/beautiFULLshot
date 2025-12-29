// EditorLayout - Main application layout with toolbar, canvas, and sidebar

import { CanvasEditor } from '../canvas/canvas-editor';
import { ZoomControls } from '../canvas/zoom-controls';
import { Toolbar } from '../toolbar/toolbar';
import { Sidebar } from '../sidebar/sidebar';

export function EditorLayout() {
  return (
    <div className="h-screen flex flex-col">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative">
          <CanvasEditor />
          <ZoomControls />
        </div>

        {/* Right sidebar */}
        <Sidebar />
      </div>
    </div>
  );
}
