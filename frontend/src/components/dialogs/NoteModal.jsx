// /components/dialogs/NoteModal.jsx

import React, { useState } from 'react';
import { Edit3, Share2, Trash2, X, Palette, Save } from 'lucide-react';

const NoteModal = ({
  note,
  isEditing,
  isOwner,
  colorOptions,
  onSave,
  onEdit,
  onCancel,
  onClose,
  onShare,
  onDelete
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title: title.trim() || 'Untitled',
      content,
      color
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg">
            {isEditing ? 'Edit Note' : 'View Note'}
          </h3>
          <div className="flex gap-2">
            {isOwner && !isEditing && (
              <>
                <button
                  onClick={onEdit}
                  className="p-2 text-gray-600 hover:text-gray-800 rounded-full hover:bg-gray-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={onShare}
                  className="p-2 text-gray-600 hover:text-gray-800 rounded-full hover:bg-gray-100"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[calc(90vh-8rem)] overflow-y-auto">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Color Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Palette className="h-4 w-4" />
                  <div
                    className={`w-6 h-6 rounded border-2 ${color}`}
                  ></div>
                  <span className="text-sm">Change Color</span>
                </button>

                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    <div className="grid grid-cols-5 gap-2">
                      {colorOptions.map((colorOption) => (
                        <button
                          key={colorOption.classes}
                          type="button"
                          onClick={() => {
                            setColor(colorOption.classes);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded border-2 ${colorOption.classes} hover:scale-110 transition-transform ${
                            color === colorOption.classes ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title={colorOption.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Note title..."
                autoFocus
              />

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Write your note here..."
              />

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div className={`${color} rounded-lg p-4`}>
              <h2 className="text-2xl font-bold mb-4">
                {note.title}
              </h2>
              <div className="whitespace-pre-wrap leading-relaxed">
                {note.content}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-300 text-sm">
                <p>Created: {new Date(note.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(note.updated_at).toLocaleString()}</p>
                {note.owner_name && (
                  <p>Owner: {note.owner_name}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteModal;