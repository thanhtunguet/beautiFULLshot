// Sidebar - Right sidebar with Edit (background/crop) and Export tabs

import { useState } from 'react';
import { BackgroundPanel } from './background-panel';
import { CropPanel } from './crop-panel';
import { ExportPanel } from './export-panel';
import { useCanvasStore } from '../../stores/canvas-store';

type SidebarTab = 'edit' | 'export';

export function Sidebar() {
  const { imageUrl } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('edit');

  const tabs: { id: SidebarTab; label: string }[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-500 border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {!imageUrl && (
          <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-sm border-b border-gray-200 dark:border-gray-700">
            Take a screenshot to get started
          </div>
        )}

        {activeTab === 'edit' && (
          <>
            <BackgroundPanel />
            <CropPanel />
          </>
        )}

        {activeTab === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}
