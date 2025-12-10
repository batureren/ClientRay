// /components/tabs/hooks/useNotes.js

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

export const useNotes = (activeSubTab) => {
  const [notes, setNotes] = useState([]);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    console.log("is fetch notes?");
    setLoading(true);
    try {
      const data = await api.get('/notes');
      setNotes(data.data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSharedNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/notes/shared');
      setSharedNotes(data.data || []);
    } catch (error) {
      console.error('Error fetching shared notes:', error);
      setSharedNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'my-notes') {
      fetchNotes();
    }
    fetchSharedNotes();
  }, [activeSubTab, fetchNotes, fetchSharedNotes]);

  const createNote = async (newNote) => {
    try {
      const createdNote = await api.post('/notes', newNote);
      setNotes(prev => [...prev, createdNote]);
      return createdNote;
    } catch (error) {
      console.error('Error creating note:', error);
      return null;
    }
  };

  const updateNote = async (noteId, updates) => {
    try {
      const updatedNote = await api.put(`/notes/${noteId}`, updates);
      setNotes(prev => prev.map(note => note.id === noteId ? updatedNote : note));
      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const updateSharedNoteProperties = async (noteId, updates) => {
    try {
      const noteToUpdate = sharedNotes.find(n => n.id === noteId);
      if (!noteToUpdate) return;
      const payload = { ...noteToUpdate, ...updates };
      await api.put(`/notes/shared-properties/${noteId}`, payload);
      setSharedNotes(prev => prev.map(note => note.id === noteId ? { ...note, ...updates } : note));
    } catch (error) {
      console.error('Error updating shared note properties:', error);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/notes/${noteId}`);
      setNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const unshareNote = async (noteId) => {
    try {
      await api.delete(`/notes/shared/${noteId}`);
      setSharedNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error removing shared note:', error);
    }
  };

  const shareNote = async (noteId, userIds) => {
    try {
      await api.post(`/notes/${noteId}/share`, { userIds });
      fetchNotes(); // Re-fetch to get updated share info
    } catch (error) {
      console.error('Error sharing note:', error);
    }
  };

  const handleLayerReorder = async (reorderedNotes) => {
      const updates = reorderedNotes.map((note, index) => ({ id: note.id, z_index: index }));
      
      const currentSetter = activeSubTab === 'my-notes' ? setNotes : setSharedNotes;
      currentSetter(prev => prev.map(originalNote => {
        const update = updates.find(u => u.id === originalNote.id);
        return update ? { ...originalNote, z_index: update.z_index } : originalNote;
      }));

      if (activeSubTab === 'my-notes') {
          try {
              await api.put('/notes/batch-update/layers', { updates });
          } catch (error) {
              console.error('Failed to save layer order:', error);
          }
      } else {
          for (const update of updates) {
              await updateSharedNoteProperties(update.id, { z_index: update.z_index });
          }
      }
  };

  const getCurrentNotes = () => activeSubTab === 'my-notes' ? notes : sharedNotes;
  const getCurrentSetter = () => activeSubTab === 'my-notes' ? setNotes : setSharedNotes;

  return {
    notes,
    setNotes,
    sharedNotes,
    setSharedNotes,
    loading,
    createNote,
    updateNote,
    updateSharedNoteProperties,
    deleteNote,
    unshareNote,
    shareNote,
    handleLayerReorder,
    getCurrentNotes,
    getCurrentSetter,
  };
};