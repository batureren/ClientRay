// /components/tabs/NotesTab.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LayerPanel from '../ui/LayerPanel';
import NoteModal from '../dialogs/NoteModal';
import ShareModal from '../dialogs/ShareModal';
import NotesToolbar from '../ui/NotesToolbar';
import NotesGrid from '../ui/NotesGrid';
import NotesList from '../ui/NotesList';
import { useNotes } from './hooks/useNotes';
import api from '@/services/api';

// Constants
const GRID_SIZE = 20;
const MIN_NOTE_WIDTH = 200;
const MIN_NOTE_HEIGHT = 150;
const MAX_NOTE_WIDTH = 500;
const MAX_NOTE_HEIGHT = 400;
const DEFAULT_NOTE_WIDTH = 280;
const DEFAULT_NOTE_HEIGHT = 200;

const NotesTab = ({ user, users }) => {
  const [activeSubTab, setActiveSubTab] = useState('my-notes');
  console.log(activeSubTab);
  const { t } = useTranslation();
  
  const colorOptions = [
    { name: t('notesTab.colors.white'), classes: 'bg-white border-black-300 text-gray-800', color: '#000000' },
    { name: t('notesTab.colors.yellow'), classes: 'bg-yellow-200 border-yellow-300 text-gray-800', color: '#fef3c7' },
    { name: t('notesTab.colors.blue'), classes: 'bg-blue-200 border-blue-300 text-gray-800', color: '#dbeafe' },
    { name: t('notesTab.colors.green'), classes: 'bg-green-200 border-green-300 text-gray-800', color: '#dcfce7' },
    { name: t('notesTab.colors.pink'), classes: 'bg-pink-200 border-pink-300 text-gray-800', color: '#fce7f3' },
    { name: t('notesTab.colors.purple'), classes: 'bg-purple-200 border-purple-300 text-gray-800', color: '#e9d5ff' },
    { name: t('notesTab.colors.orange'), classes: 'bg-orange-200 border-orange-300 text-gray-800', color: '#fed7aa' },
    { name: t('notesTab.colors.gray'), classes: 'bg-gray-200 border-gray-300 text-gray-800', color: '#e5e7eb' },
    { name: t('notesTab.colors.indigo'), classes: 'bg-indigo-200 border-indigo-300 text-gray-800', color: '#c7d2fe' },
    { name: t('notesTab.colors.teal'), classes: 'bg-teal-200 border-teal-300 text-gray-800', color: '#ccfbf1' },
    { name: t('notesTab.colors.dangerRed'), classes: 'bg-red-500 border-red-600 text-white', color: '#ef4444' },
    { name: t('notesTab.colors.warningAmber'), classes: 'bg-amber-400 border-amber-500 text-gray-800', color: '#facc15' },
    { name: t('notesTab.colors.successGreen'), classes: 'bg-green-500 border-green-600 text-white', color: '#22c55e' },
    { name: t('notesTab.colors.infoBlue'), classes: 'bg-sky-500 border-sky-600 text-white', color: '#0ea5e9' },
    { name: t('notesTab.colors.deepPurple'), classes: 'bg-violet-500 border-violet-600 text-white', color: '#8b5cf6' },
    { name: t('notesTab.colors.charcoal'), classes: 'bg-slate-600 border-slate-700 text-white', color: '#475569' }
  ];
  const {
    notes, sharedNotes, loading, 
    createNote: apiCreateNote, updateNote, updateSharedNoteProperties,
    deleteNote: apiDeleteNote, unshareNote: apiUnshareNote, shareNote, handleLayerReorder,
    getCurrentNotes, getCurrentSetter
  } = useNotes(activeSubTab);

  // UI State
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [noteToShare, setNoteToShare] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [isMobile, setIsMobile] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  
  // Interaction State
  const [gridSizes, setGridSizes] = useState({ 
    'my-notes': { width: 1200, height: 800 }, 
    'shared-notes': { width: 1200, height: 800 } 
  });
  const [isResizingGrid, setIsResizingGrid] = useState(false);
  const [resizingNote, setResizingNote] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });

  // Refs
  const gridRef = useRef(null);
  const draggedNote = useRef(null);
  const draggedElement = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const wasResizing = useRef(false);
  const saveTimeoutRef = useRef(null);
  const gridSizesRef = useRef(gridSizes);
  
  useEffect(() => { gridSizesRef.current = gridSizes; }, [gridSizes]);

  // Preferences Management
  useEffect(() => {
    const loadUserPreferences = async () => {
        try {
            const data = await api.get('/users/preferences');
            const preferences = data.data
            if (preferences) {
                setGridSizes({
                    'my-notes': { width: preferences.notes_grid_width || 1200, height: preferences.notes_grid_height || 800 },
                    'shared-notes': { width: preferences.shared_notes_grid_width || 1200, height: preferences.shared_notes_grid_height || 800 }
                });
                setViewMode(preferences.notes_view_mode || 'grid');
            }
        } catch (error) { console.error(t('notesTab.errors.loadPreferences'), error); }
    };
    loadUserPreferences();
  }, []);

  const saveGridPreferences = (tab, width, height) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try { await api.put('/users/preferences/grid', { tab, width, height }); } 
      catch (error) { console.error(t('notesTab.errors.saveGrid'), error); }
    }, 500);
  };

  const saveViewModePreferences = async (mode) => {
    try { await api.put('/users/preferences', { notes_view_mode: mode }); } 
    catch (error) { console.error(t('notesTab.errors.saveView'), error); }
  };
  
  // Mobile check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Wrapper functions to connect UI events to data logic
  const createNote = async () => {
    const newNote = {
        title: t('notesTab.newNote.title'),
        content: t('notesTab.newNote.content'),
        x: Math.floor(Math.random() * 5) * (DEFAULT_NOTE_WIDTH + GRID_SIZE),
        y: Math.floor(Math.random() * 3) * (DEFAULT_NOTE_HEIGHT + GRID_SIZE),
        width: DEFAULT_NOTE_WIDTH, height: DEFAULT_NOTE_HEIGHT,
        color: colorOptions[Math.floor(Math.random() * 8)].classes,
    };
    const createdNote = await apiCreateNote(newNote);
    if (createdNote) handleNoteClick(createdNote, 'edit');
  };

  const deleteNote = async (noteId) => {
    if (!confirm(t('notesTab.confirmations.delete'))) return;
    await apiDeleteNote(noteId);
    if (selectedNote?.id === noteId) {
        setViewModalOpen(false);
        setSelectedNote(null);
        setIsEditing(false);
    }
  };

  const unshareNote = async (noteId) => {
    if (!confirm(t('notesTab.confirmations.unshare'))) return;
    await apiUnshareNote(noteId);
    if (selectedNote?.id === noteId) {
      setViewModalOpen(false);
      setSelectedNote(null);
    }
  };
  
  // Event Handlers for UI interactions
  const handleNoteClick = (note, action = 'view') => {
    if (wasResizing.current) { wasResizing.current = false; return; }
    setSelectedNote(note);
    setViewModalOpen(true);
    if (action === 'edit' && activeSubTab === 'my-notes') {
      setIsEditing(true);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    saveViewModePreferences(mode);
  };

  // --- Interaction Handlers (Drag, Drop, Resize) --- //

  const handleDragStart = (e, note) => {
    if (isMobile || resizingNote) return;
    draggedNote.current = note;
    draggedElement.current = e.target;
    const rect = e.target.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e) => {
    if (isMobile || !draggedNote.current) return;
    if (e.target) e.target.style.opacity = '1';
    
    const finalNote = getCurrentNotes().find(n => n.id === draggedNote.current.id);
    if (finalNote) {
      const updates = { x: finalNote.x, y: finalNote.y };
      if (activeSubTab === 'my-notes') updateNote(finalNote.id, updates);
      else updateSharedNoteProperties(finalNote.id, updates);
    }
    draggedNote.current = null;
    draggedElement.current = null;
  };

  const handleDragOver = (e) => {
    if (isMobile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    if (isMobile || !draggedNote.current || !gridRef.current) return;
    e.preventDefault();
    const rect = gridRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left - dragOffset.current.x;
    const rawY = e.clientY - rect.top - dragOffset.current.y;
    const x = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
    
    const noteWidth = draggedNote.current.width || DEFAULT_NOTE_WIDTH;
    const noteHeight = draggedNote.current.height || DEFAULT_NOTE_HEIGHT;
    const currentGridSize = gridSizes[activeSubTab];
    const maxX = currentGridSize.width - noteWidth;
    const maxY = currentGridSize.height - noteHeight;
    
    const finalX = Math.max(0, Math.min(x, maxX));
    const finalY = Math.max(0, Math.min(y, maxY));
    
    getCurrentSetter()(prev => prev.map(n => n.id === draggedNote.current.id ? { ...n, x: finalX, y: finalY } : n));
  };

  const handleGridResizeStart = (e) => {
    setIsResizingGrid(true);
    e.preventDefault();
  };

  const handleGridResize = (e) => {
    if (!isResizingGrid) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newWidth = Math.round(Math.max(800, e.clientX - rect.left));
    const newHeight = Math.round(Math.max(400, e.clientY - rect.top));
    setGridSizes(prev => ({ ...prev, [activeSubTab]: { width: newWidth, height: newHeight } }));
  };

  const handleGridResizeEnd = () => {
    if (isResizingGrid) {
      const currentSize = gridSizesRef.current[activeSubTab];
      if (currentSize) saveGridPreferences(activeSubTab, currentSize.width, currentSize.height);
    }
    setIsResizingGrid(false);
  };

  const handleNoteResizeStart = (e, note, direction) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNote({ note, direction });
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: note.width || DEFAULT_NOTE_WIDTH, height: note.height || DEFAULT_NOTE_HEIGHT });
  };

  const handleNoteResize = (e) => {
    if (!resizingNote) return;
    const { note, direction } = resizingNote;
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    let newWidth = resizeStartSize.width;
    let newHeight = resizeStartSize.height;

    if (direction.includes('right')) newWidth = Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, resizeStartSize.width + deltaX));
    if (direction.includes('left')) newWidth = Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, resizeStartSize.width - deltaX));
    if (direction.includes('bottom')) newHeight = Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, resizeStartSize.height + deltaY));
    if (direction.includes('top')) newHeight = Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, resizeStartSize.height - deltaY));

    newWidth = Math.round(newWidth / GRID_SIZE) * GRID_SIZE;
    newHeight = Math.round(newHeight / GRID_SIZE) * GRID_SIZE;
    
    getCurrentSetter()(prev => prev.map(n => n.id === note.id ? { ...n, width: newWidth, height: newHeight } : n));
  };

  const handleNoteResizeEnd = () => {
    if (resizingNote) {
      wasResizing.current = true;
      const finalNote = getCurrentNotes().find(n => n.id === resizingNote.note.id);
      if (finalNote) {
        const updates = { width: finalNote.width, height: finalNote.height };
        if (activeSubTab === 'my-notes') updateNote(finalNote.id, updates);
        else updateSharedNoteProperties(finalNote.id, updates);
      }
      setResizingNote(null);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      handleGridResize(e);
      handleNoteResize(e);
    };
    const handleMouseUp = () => {
      handleGridResizeEnd();
      handleNoteResizeEnd();
      if (draggedNote.current?.id) handleDragEnd({ target: draggedElement.current });
    };

    if (isResizingGrid || resizingNote || draggedNote.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingGrid ? 'nw-resize' : 'grabbing';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingGrid, resizingNote, notes, sharedNotes, activeSubTab]);


  // --- Helper functions for rendering --- //
  const getShareInfo = (note) => note.shares || [];
  const isNoteShared = (note) => note.shares && note.shares.length > 0;
  const isBottomNote = (noteToCheck) => (noteToCheck.z_index || 0) === 0;

  const bringForward = (e, noteToMove) => {
    e.stopPropagation();
    const newZ = (noteToMove.z_index || 0) + 1;
    getCurrentSetter()(prev => prev.map(n => n.id === noteToMove.id ? { ...n, z_index: newZ } : n));
    if (activeSubTab === 'my-notes') updateNote(noteToMove.id, { z_index: newZ });
    else updateSharedNoteProperties(noteToMove.id, { z_index: newZ });
  };

  const sendBackward = (e, noteToMove) => {
    e.stopPropagation();
    const currentZ = noteToMove.z_index || 0;
    if (currentZ <= 0) return;
    const newZ = currentZ - 1;
    getCurrentSetter()(prev => prev.map(n => n.id === noteToMove.id ? { ...n, z_index: newZ } : n));
    if (activeSubTab === 'my-notes') updateNote(noteToMove.id, { z_index: newZ });
    else updateSharedNoteProperties(noteToMove.id, { z_index: newZ });
  };
    
  const filteredNotes = getCurrentNotes().filter(note =>
    (note.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (note.content?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="space-y-4 md:space-y-6">
      <NotesToolbar
        activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab}
        notesCount={notes.length} sharedNotesCount={sharedNotes.length}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        isMobile={isMobile} viewMode={viewMode} handleViewModeChange={handleViewModeChange}
        isLayerPanelOpen={isLayerPanelOpen} setIsLayerPanelOpen={setIsLayerPanelOpen}
        createNote={createNote}
      />
      
      <div className="relative">
        {loading ? (
          <div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          (isMobile || viewMode === 'list') ? (
            <NotesList 
              filteredNotes={filteredNotes} 
              activeSubTab={activeSubTab} 
              handleNoteClick={handleNoteClick} 
              getShareInfo={getShareInfo} 
              isNoteShared={isNoteShared} 
            />
          ) : (
            <NotesGrid
                gridRef={gridRef}
                filteredNotes={filteredNotes}
                activeSubTab={activeSubTab}
                isMobile={isMobile}
                resizingNote={resizingNote}
                getCurrentGridSize={() => gridSizes[activeSubTab]}
                setGridSizes={setGridSizes}
                saveGridPreferences={saveGridPreferences}
                GRID_SIZE={GRID_SIZE}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                handleGridResizeStart={handleGridResizeStart}
                handleNoteClick={handleNoteClick}
                handleNoteResizeStart={handleNoteResizeStart}
                bringForward={bringForward}
                sendBackward={sendBackward}
                isBottomNote={isBottomNote}
                setNoteToShare={setNoteToShare}
                setShareModalOpen={setShareModalOpen}
                deleteNote={deleteNote}
                unshareNote={unshareNote}
                getShareInfo={getShareInfo}
                isNoteShared={isNoteShared}
            />
          )
        )}
      </div>

      {isLayerPanelOpen && viewMode === 'grid' && (
        <LayerPanel notes={getCurrentNotes()} onClose={() => setIsLayerPanelOpen(false)} onReorder={handleLayerReorder} />
      )}

      {viewModalOpen && selectedNote && (
        <NoteModal
          note={selectedNote}
          isEditing={isEditing}
          isOwner={activeSubTab === 'my-notes'}
          colorOptions={colorOptions}
          onSave={async (updates) => {
            const updated = await updateNote(selectedNote.id, updates);
            if (updated) {
                setSelectedNote(prev => ({ ...prev, ...updates }));
            }
            setIsEditing(false);
          }}
          onEdit={() => setIsEditing(true)}
          onCancel={() => { setIsEditing(false); if(isMobile || viewMode === 'list') setViewModalOpen(false); }}
          onClose={() => { setViewModalOpen(false); setSelectedNote(null); setIsEditing(false); }}
          onShare={() => { setNoteToShare(selectedNote); setShareModalOpen(true); }}
          onDelete={() => {
            if (activeSubTab === 'my-notes') deleteNote(selectedNote.id);
            else unshareNote(selectedNote.id);
          }}
        />
      )}

      {shareModalOpen && noteToShare && (
        <ShareModal
          note={noteToShare}
          users={users.filter(u => u.id !== user.id)}
          onShare={shareNote}
          onClose={() => { setShareModalOpen(false); setNoteToShare(null); }}
        />
      )}
    </div>
  );
};

export default NotesTab;