// components/ui/LayerPanel.jsx

import React, { useState, useMemo } from 'react';
import { X, GripVertical } from 'lucide-react';

const LayerPanel = ({ notes, onClose, onReorder }) => {

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => (b.z_index || 0) - (a.z_index || 0));
  }, [notes]);

  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    let reordered = [...sortedNotes];
    
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    const finalOrder = reordered.reverse();
    onReorder(finalOrder);

    setDraggedIndex(null);
  };

  return (
    <div className="fixed top-24 right-4 bg-white border border-gray-300 rounded-lg shadow-xl w-64 z-40">
      <div className="flex justify-between items-center p-2 border-b">
        <h3 className="font-semibold text-sm">Layers</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul 
        className="max-h-96 overflow-y-auto"
        onDragOver={handleDragOver}
      >
        {sortedNotes.map((note, index) => (
          <li
            key={note.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`flex items-center p-2 border-b cursor-grab ${
              draggedIndex === index ? 'opacity-50 bg-blue-100' : 'bg-white'
            }`}
          >
            <GripVertical className="h-5 w-5 text-gray-400 mr-2" />
            <div 
              className={`w-4 h-4 rounded-sm border ${note.color}`}
            ></div>
            <span className="ml-2 text-xs truncate flex-1">{note.title}</span>
            <span className="text-xs text-gray-500">{note.z_index || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LayerPanel;