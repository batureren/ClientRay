// /components/ui/NotesList.jsx

import React from 'react';
import { StickyNote, Users, Eye } from 'lucide-react';

const NotesList = ({ filteredNotes, activeSubTab, handleNoteClick, getShareInfo, isNoteShared }) => {
  const truncateText = (text, maxLength = 150) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (filteredNotes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <StickyNote className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">{activeSubTab === 'my-notes' ? 'No notes yet' : 'No shared notes'}</p>
        <p className="text-sm">{activeSubTab === 'my-notes' ? 'Create your first note to get started' : 'Notes shared with you will appear here'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredNotes.map((note) => (
        <div
          key={note.id}
          onClick={() => handleNoteClick(note)}
          className={`${note.color || 'bg-yellow-200 border-yellow-300'} border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow relative`}
        >
          {activeSubTab === 'my-notes' && isNoteShared(note) && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-white px-2 py-1 rounded-full shadow-sm">
              <Users className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">{getShareInfo(note).length}</span>
            </div>
          )}
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold flex-1 pr-2">{note.title}</h3>
            <div className="flex gap-1 items-center">
              {activeSubTab === 'shared-notes' && (
                <span className="text-xs bg-white px-2 py-1 rounded shadow">by {note.owner_name || 'Unknown'}</span>
              )}
              <Eye className="h-4 w-4 text-gray-600" />
            </div>
          </div>
          <p className="text-sm">{truncateText(note.content)}</p>
          <p className="text-xs mt-2">{new Date(note.updated_at).toLocaleDateString()}</p>
          {activeSubTab === 'my-notes' && isNoteShared(note) && (
            <div className="text-xs text-blue-600 mt-1">
              Shared with: {getShareInfo(note).map(share => share.username).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotesList;