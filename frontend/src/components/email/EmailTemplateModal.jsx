// components/email/EmailTemplateModal.jsx

import React, { useState, useEffect } from 'react';
import { X, Eye, Save } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

const EmailTemplateModal = ({ isOpen, onClose, onSave, template = null, api }) => {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    description: '',
    category: 'general'
  });
  
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        subject: template.subject || '',
        content: template.content || '',
        description: template.description || '',
        category: template.category || 'general'
      });
    } else {
      setFormData({
        name: '',
        subject: '',
        content: '',
        description: '',
        category: 'general'
      });
    }
  }, [template, isOpen]);

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.content) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const templateCategories = [
    { value: 'general', label: 'General' },
    { value: 'welcome', label: 'Welcome' },
    { value: 'followup', label: 'Follow-up' },
    { value: 'promotional', label: 'Promotional' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'transactional', label: 'Transactional' }
  ];

  const previewContent = formData.content
    .replace(/\{\{first_name\}\}/g, 'John')
    .replace(/\{\{last_name\}\}/g, 'Doe')
    .replace(/\{\{email\}\}/g, 'john.doe@example.com')
    .replace(/\{\{company\}\}/g, 'Acme Corp')
    .replace(/\{\{unsubscribe_link\}\}/g, '<a href="#" style="color: #666;">Unsubscribe</a>');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {template ? 'Edit Template' : 'Create Email Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Form Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {templateCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description of this template"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email subject line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Content *
                </label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Template Variables</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div><code className="bg-blue-100 px-1 rounded">{'{{first_name}}'}</code> - Recipient's first name</div>
                  <div><code className="bg-blue-100 px-1 rounded">{'{{last_name}}'}</code> - Recipient's last name</div>
                  <div><code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> - Recipient's email address</div>
                  <div><code className="bg-blue-100 px-1 rounded">{'{{company}}'}</code> - Company name (for accounts)</div>
                  <div><code className="bg-blue-100 px-1 rounded">{'{{unsubscribe_link}}'}</code> - Unsubscribe link (required)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-1/2 border-l border-gray-200 bg-gray-50">
              <div className="p-4 border-b bg-white">
                <h3 className="font-medium">Preview</h3>
                <p className="text-sm text-gray-600">How your email will look with sample data</p>
              </div>
              <div className="p-4 h-full overflow-y-auto">
                <div className="bg-white rounded-lg border p-4 max-w-full">
                  <div className="mb-4 pb-3 border-b">
                    <div className="font-medium text-gray-900">
                      Subject: {formData.subject.replace(/\{\{first_name\}\}/g, 'John')}
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
                    // --- FIX HERE: Removed the incorrect .replace() call ---
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.subject || !formData.content}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {template ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateModal;