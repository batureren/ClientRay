// /components/ui/NotesGrid.jsx

import React from 'react';
import { StickyNote, Users, ArrowUp, ArrowDown, Eye, Edit3, Share2, Trash2 } from 'lucide-react';

const NoteCard = ({ 
    note, 
    activeSubTab, 
    isMobile, 
    resizingNote,
    handleDragStart, 
    handleDragEnd, 
    handleNoteClick, 
    handleNoteResizeStart,
    bringForward,
    sendBackward,
    isBottomNote,
    setNoteToShare,
    setShareModalOpen,
    deleteNote,
    unshareNote,
    getShareInfo,
    isNoteShared
}) => (
    <div
        key={note.id}
        draggable={!isMobile && !resizingNote}
        onDragStart={(e) => handleDragStart(e, note)}
        onDragEnd={handleDragEnd}
        className={`absolute cursor-pointer ${note.color || 'bg-yellow-200 border-yellow-300'} border-2 rounded-lg p-2 pt-6 shadow-lg hover:shadow-xl transition-shadow group select-none`}
        style={{
          left: note.x || 0,
          top: note.y || 0,
          width: note.width || 280,
          height: note.height || 200,
          zIndex: note.z_index || 0,
        }}
        onClick={() => handleNoteClick(note)}
      >
        {/* Resize Handles */}
        <>
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nw-resize opacity-0 group-hover:opacity-100" onMouseDown={(e) => handleNoteResizeStart(e, note, 'top-left')} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-ne-resize opacity-0 group-hover:opacity-100" onMouseDown={(e) => handleNoteResizeStart(e, note, 'top-right')} />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-sw-resize opacity-0 group-hover:opacity-100" onMouseDown={(e) => handleNoteResizeStart(e, note, 'bottom-left')} />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100" onMouseDown={(e) => handleNoteResizeStart(e, note, 'bottom-right')} />
            <div className="absolute -top-1 left-1/2 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-n-resize opacity-0 group-hover:opacity-100 transform -translate-x-1/2" onMouseDown={(e) => handleNoteResizeStart(e, note, 'top')} />
            <div className="absolute -bottom-1 left-1/2 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-s-resize opacity-0 group-hover:opacity-100 transform -translate-x-1/2" onMouseDown={(e) => handleNoteResizeStart(e, note, 'bottom')} />
            <div className="absolute -left-1 top-1/2 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-w-resize opacity-0 group-hover:opacity-100 transform -translate-y-1/2" onMouseDown={(e) => handleNoteResizeStart(e, note, 'left')} />
            <div className="absolute -right-1 top-1/2 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-e-resize opacity-0 group-hover:opacity-100 transform -translate-y-1/2" onMouseDown={(e) => handleNoteResizeStart(e, note, 'right')} />
        </>

        {activeSubTab === 'my-notes' && isNoteShared(note) && (
          <div className="absolute top-0 left-0 flex items-center gap-1 bg-white px-2 py-1 rounded-full shadow-sm z-10">
            <Users className="h-3 w-3 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">{getShareInfo(note).length}</span>
          </div>
        )}
        
        {/* Note Controls */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button onClick={(e) => bringForward(e, note)} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="Bring Forward"><ArrowUp className="h-3 w-3 text-gray-600" /></button>
            <button onClick={(e) => sendBackward(e, note)} className="p-1 bg-white rounded hover:bg-gray-100 shadow disabled:opacity-25" title="Send Backward" disabled={isBottomNote(note)}><ArrowDown className="h-3 w-3 text-gray-600" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleNoteClick(note, 'view'); }} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="View Note"><Eye className="h-3 w-3 text-gray-600" /></button>
            {activeSubTab === 'my-notes' && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); handleNoteClick(note, 'edit'); }} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="Edit Note"><Edit3 className="h-3 w-3 text-blue-600" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setNoteToShare(note); setShareModalOpen(true); }} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="Share Note"><Share2 className="h-3 w-3 text-green-600" /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="Delete Note"><Trash2 className="h-3 w-3 text-red-600" /></button>
                </>
            )}
            {activeSubTab === 'shared-notes' && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); unshareNote(note.id); }} className="p-1 bg-white rounded hover:bg-gray-100 shadow" title="Remove from My View"><Trash2 className="h-3 w-3 text-orange-600" /></button>
                    <div className="text-xs bg-white px-2 py-1 rounded shadow">by {note.owner_name || 'Unknown'}</div>
                </>
            )}
        </div>
        
        {/* Note Content */}
        <div className="h-full flex flex-col pointer-events-none overflow-hidden">
          <h3 className="font-semibold mb-2 line-clamp-2 text-sm">{note.title}</h3>
          <p className="text-xs flex-1 overflow-hidden">{note.content}</p>
          {activeSubTab === 'my-notes' && isNoteShared(note) && (
            <div className="text-xs text-blue-600 mt-1 truncate">Shared with: {getShareInfo(note).map(share => share.username).join(', ')}</div>
          )}
        </div>
    </div>
);

const NotesGrid = (props) => {
  const {
    gridRef,
    filteredNotes,
    activeSubTab,
    getCurrentGridSize,
    setGridSizes,
    saveGridPreferences,
    handleDragOver,
    handleDrop,
    handleGridResizeStart,
    GRID_SIZE,
  } = props;

  return (
    <div className="relative">
      <div className="mb-2 text-sm text-gray-500 flex justify-between items-center">
        <span>Grid: {getCurrentGridSize().width} × {getCurrentGridSize().height}px</span>
        <button
          onClick={() => {
            const newSizes = { width: 1200, height: 800 };
            setGridSizes(prev => ({ ...prev, [activeSubTab]: newSizes }));
            saveGridPreferences(activeSubTab, newSizes.width, newSizes.height);
          }}
          className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Reset Size
        </button>
      </div>
      <div
        ref={gridRef}
        className="relative bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg overflow-auto"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          width: getCurrentGridSize().width,
          height: getCurrentGridSize().height,
          backgroundImage: `radial-gradient(circle, #ddd 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
      >
        {filteredNotes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <StickyNote className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">{activeSubTab === 'my-notes' ? 'No notes yet' : 'No shared notes'}</p>
            <p className="text-sm">{activeSubTab === 'my-notes' ? 'Create your first note to get started' : 'Notes shared with you will appear here'}</p>
          </div>
        ) : (
          filteredNotes.map((note) => <NoteCard key={note.id} note={note} {...props} />)
        )}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-gray-400 hover:bg-gray-600 cursor-nw-resize opacity-50 hover:opacity-100"
          onMouseDown={handleGridResizeStart}
          title="Resize grid"
          style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
        />
      </div>
    </div>
  );
};

export default NotesGrid;