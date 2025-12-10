// components/email/TemplatePreviewModal.jsx

import React from 'react';
import { X } from 'lucide-react';

const TemplatePreviewModal = ({ isOpen, onClose, template }) => {
  if (!isOpen) return null;

  const previewContent = template.content
    .replace(/\{\{first_name\}\}/g, 'John')
    .replace(/\{\{last_name\}\}/g, 'Doe')
    .replace(/\{\{email\}\}/g, 'john.doe@example.com')
    .replace(/\{\{company\}\}/g, 'Acme Corp')
    .replace(/\{\{unsubscribe_link\}\}/g, '<a href="#" style="color: #666;">Unsubscribe</a>');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            Preview: {template.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-white rounded-lg border p-4">
            <div className="mb-4 pb-3 border-b">
              <div className="font-medium text-gray-900">
                Subject: {template.subject.replace(/\{\{first_name\}\}/g, 'John')}
              </div>
              <div className="text-sm text-gray-500">
                From: Your Company &lt;noreply@yourcompany.com&gt;
              </div>
              <div className="text-sm text-gray-500">
                To: john.doe@example.com
              </div>
            </div>
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreviewModal;