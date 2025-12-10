// /components/ui/NotesToolbar.jsx

import React from 'react';
import { Plus, Users, StickyNote, Search, Grid, List, Layers } from 'lucide-react';

const NotesToolbar = ({
  activeSubTab,
  setActiveSubTab,
  notesCount,
  sharedNotesCount,
  searchTerm,
  setSearchTerm,
  isMobile,
  viewMode,
  handleViewModeChange,
  isLayerPanelOpen,
  setIsLayerPanelOpen,
  createNote,
}) => {
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('my-notes')}
            className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
              activeSubTab === 'my-notes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <StickyNote className="inline h-4 w-4 mr-1 md:mr-2" />
            My Notes ({notesCount})
          </button>
          <button
            onClick={() => setActiveSubTab('shared-notes')}
            className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
              activeSubTab === 'shared-notes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Users className="inline h-4 w-4 mr-1 md:mr-2" />
            Shared With Me ({sharedNotesCount})
          </button>
        </div>

        {!isMobile && (
          <div className="flex gap-2">
            <button onClick={() => handleViewModeChange('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              <Grid className="h-4 w-4" />
            </button>
            <button onClick={() => handleViewModeChange('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)} className={`p-2 rounded ${isLayerPanelOpen ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`} title="Toggle Layer Panel">
              <Layers className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-sm md:text-base"
          />
        </div>
        {activeSubTab === 'my-notes' && (
          <button onClick={createNote} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center text-sm md:text-base">
            <Plus className="h-4 w-4" />
            Add Note
          </button>
        )}
      </div>
    </div>
  );
};

export default NotesToolbar;