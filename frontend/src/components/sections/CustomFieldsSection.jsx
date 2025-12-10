// frontend/components/sections/CustomFieldsSection.jsx

import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { PlusCircle, Edit, Trash2, X, Plus, Minus } from 'lucide-react';

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${sizeClasses[size]} m-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function CustomFieldsSection({ message, setMessage }) {
  const api = useApi();

  // State
  const [fields, setFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldModalMode, setFieldModalMode] = useState('create');
  const [currentField, setCurrentField] = useState(null);
  const [optionInputMode, setOptionInputMode] = useState('individual');
  const [bulkOptionsText, setBulkOptionsText] = useState('');
  const [fieldFormData, setFieldFormData] = useState({
    module: 'leads',
    field_label: '',
    field_type: 'TEXT',
    placeholder: '',
    is_required: false,
    options: [],
  });

  const processBulkOptions = (text) => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  };

  // Data Fetching
  const fetchFields = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/custom-fields');
      setFields(response || []);
    } catch (error) {
      console.error("Failed to fetch custom fields:", error);
      setMessage({ type: 'error', content: 'Could not load custom fields.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  // Event Handlers
const handleOpenFieldModal = (mode = 'create', field = null) => {
  setFieldModalMode(mode);
  setMessage({ type: '', content: '' });
  setOptionInputMode('individual'); 
  setBulkOptionsText('');
  
  if (mode === 'edit' && field) {
    setCurrentField(field);
    setFieldFormData({
      module: field.module,
      field_label: field.field_label,
      field_type: field.field_type,
      placeholder: field.placeholder || '',
      is_required: field.is_required,
      options: field.options || [],
    });
    if (field.options && field.options.length > 0) {
      setBulkOptionsText(field.options.join('\n'));
      setOptionInputMode('bulk');
    }
  } else {
    setCurrentField(null);
    setFieldFormData({
      module: 'leads',
      field_label: '',
      field_type: 'TEXT',
      placeholder: '',
      is_required: false,
      options: [],
    });
  }
  setIsFieldModalOpen(true);
};

const handleFieldFormSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);

  // Process options based on input mode
  let finalOptions = fieldFormData.options;
  if (fieldFormData.field_type === 'SELECT' || fieldFormData.field_type === 'RADIO' || fieldFormData.field_type === 'MULTISELECT') {
    if (optionInputMode === 'bulk') {
      finalOptions = processBulkOptions(bulkOptionsText);
    }
    
    // Validate options
    if (finalOptions.length === 0) {
      const fieldTypeName = fieldFormData.field_type === 'SELECT' ? 'dropdown' : 
                           fieldFormData.field_type === 'RADIO' ? 'radio button' : 
                           'multi-select';
      setMessage({ type: 'error', content: `Please add at least one option for the ${fieldTypeName} field.` });
      setIsLoading(false);
      return;
    }
  }

  // Create final form data with processed options
  const finalFormData = {
    ...fieldFormData,
    options: finalOptions
  };

  try {
    if (fieldModalMode === 'edit') {
      await api.put(`/custom-fields/${currentField.id}`, finalFormData);
      setMessage({ type: 'success', content: 'Field updated successfully!' });
    } else {
      await api.post('/custom-fields', finalFormData);
      setMessage({ type: 'success', content: 'Field created successfully!' });
    }
    setIsFieldModalOpen(false);
    fetchFields();
  } catch (error) {
    console.error('Failed to save field:', error);
    const errorMessage = error.response?.error || 'An unexpected error occurred.';
    setMessage({ type: 'error', content: errorMessage });
  } finally {
    setIsLoading(false);
  }
};

  const handleDeleteField = async (fieldId) => {
    if (window.confirm('Are you sure you want to delete this field? All associated data will be permanently lost.')) {
      try {
        await api.delete(`/custom-fields/${fieldId}`);
        setMessage({ type: 'success', content: 'Field deleted successfully.' });
        fetchFields();
      } catch (error) {
        console.error("Failed to delete field:", error);
        setMessage({ type: 'error', content: 'Could not delete the field.' });
      }
    }
  };

  // Dropdown options management
  const addOption = () => {
    setFieldFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    setFieldFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index, value) => {
    setFieldFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  // Handle field type change
const handleFieldTypeChange = (newType) => {
  setFieldFormData(prev => ({
    ...prev,
    field_type: newType,
    options: (newType === 'SELECT' || newType === 'RADIO' || newType === 'MULTISELECT') ? (prev.options.length === 0 ? [''] : prev.options) : []
  }));
  
  // Reset option input mode and bulk text when field type changes
  if (newType !== 'SELECT' && newType !== 'RADIO' && newType !== 'MULTISELECT') {
    setOptionInputMode('individual');
    setBulkOptionsText('');
  }
};

  // Utility Functions
  const leadsFields = fields.filter(f => f.module === 'leads');
  const accountsFields = fields.filter(f => f.module === 'accounts');

  // Render Functions
  const renderFieldList = (fieldList, moduleName) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        {moduleName} Fields
      </h2>
      <div className="space-y-3">
        {fieldList.length > 0 ? (
          fieldList.map(field => (
            <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md transition-shadow hover:shadow-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{field.field_label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                    {field.field_type === 'SELECT' ? 'Dropdown' : 
                     field.field_type === 'RADIO' ? 'Radio Buttons' : 
                     field.field_type === 'MULTISELECT' ? 'Multi-Select' :
                     field.field_type} {field.is_required ? ' (Required)' : ''}
                  </span>
                  {(field.field_type === 'SELECT' || field.field_type === 'RADIO' || field.field_type === 'MULTISELECT') && field.options && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {field.options.length} options
                    </span>
                  )}
                </div>
                {(field.field_type === 'SELECT' || field.field_type === 'RADIO' || field.field_type === 'MULTISELECT') && field.options && field.options.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Options: {field.options.slice(0, 3).join(', ')}
                    {field.options.length > 3 && ` +${field.options.length - 3} more`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenFieldModal('edit', field)}
                  className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteField(field.id)}
                  className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No custom fields defined for {moduleName}.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <button
          onClick={() => handleOpenFieldModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Add Custom Field
        </button>
      </div>

      {isLoading && !fields.length ? (
        <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderFieldList(leadsFields, 'Leads')}
          {renderFieldList(accountsFields, 'Accounts')}
        </div>
      )}

      {/* Field Create/Edit Modal */}
      <Modal 
        isOpen={isFieldModalOpen} 
        onClose={() => setIsFieldModalOpen(false)} 
        title={fieldModalMode === 'edit' ? 'Edit Custom Field' : 'Create Custom Field'}
        size="lg"
      >
        <form onSubmit={handleFieldFormSubmit} className="space-y-4">
          {message.content && message.type === 'error' && (
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
              {message.content}
            </div>
          )}

          <div>
            <label htmlFor="module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
            <select
              id="module"
              name="module"
              value={fieldFormData.module}
              onChange={(e) => setFieldFormData(prev => ({ ...prev, module: e.target.value }))}
              disabled={fieldModalMode === 'edit'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="leads">Leads</option>
              <option value="accounts">Accounts</option>
            </select>
          </div>

          <div>
            <label htmlFor="field_label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Label</label>
            <input
              type="text"
              id="field_label"
              name="field_label"
              value={fieldFormData.field_label}
              onChange={(e) => setFieldFormData(prev => ({ ...prev, field_label: e.target.value }))}
              placeholder="e.g., Estimated Budget"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="field_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
            <select
              id="field_type"
              name="field_type"
              value={fieldFormData.field_type}
              onChange={(e) => handleFieldTypeChange(e.target.value)}
              disabled={fieldModalMode === 'edit'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="TEXT">Single Line Text</option>
              <option value="TEXTAREA">Multi-Line Text</option>
              <option value="NUMBER">Number</option>
              <option value="DATE">Date</option>
              <option value="BOOLEAN">Checkbox (Yes/No)</option>
              <option value="SELECT">Dropdown</option>
              <option value="MULTISELECT">Multi-Select Dropdown</option>
              <option value="RADIO">Radio Buttons</option>
            </select>
            
            {fieldModalMode === 'create' && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Choose the field type carefully. It cannot be changed after the field is created to protect existing data.
              </p>
            )}
          </div>

          {/* Options Section for Dropdown, Multi-Select, and Radio */}
{(fieldFormData.field_type === 'SELECT' || fieldFormData.field_type === 'RADIO' || fieldFormData.field_type === 'MULTISELECT') && (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {fieldFormData.field_type === 'SELECT' ? 'Dropdown Options' : 
       fieldFormData.field_type === 'RADIO' ? 'Radio Button Options' : 
       'Multi-Select Options'}
    </label>
    
    {/* Toggle between bulk input and individual inputs */}
    <div className="mb-3">
      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="radio"
            name="optionInputMode"
            value="individual"
            checked={optionInputMode === 'individual'}
            onChange={(e) => setOptionInputMode(e.target.value)}
            className="mr-2"
          />
          Individual Options
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="optionInputMode"
            value="bulk"
            checked={optionInputMode === 'bulk'}
            onChange={(e) => setOptionInputMode(e.target.value)}
            className="mr-2"
          />
          Bulk Input
        </label>
      </div>
    </div>

    {/* Bulk input mode */}
    {optionInputMode === 'bulk' ? (
      <div>
        <textarea
          value={bulkOptionsText}
          onChange={(e) => setBulkOptionsText(e.target.value)}
          placeholder={`Enter one option per line:\n\nOption 1\nOption 2\nOption 3`}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter one option per line. Empty lines will be ignored.
        </p>
        {bulkOptionsText && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
            <span className="text-gray-600 dark:text-gray-400">Preview: </span>
            <span className="text-blue-600 dark:text-blue-400">
              {bulkOptionsText.split('\n').filter(line => line.trim()).length} options will be created
            </span>
          </div>
        )}
      </div>
    ) : (
      /* Individual input mode (your existing code) */
      <div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {fieldFormData.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                required
              />
              {fieldFormData.options.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          <Plus className="w-4 h-4" />
          Add Option
        </button>
      </div>
    )}

    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
      {fieldFormData.field_type === 'SELECT' 
        ? 'Add the options that users can select from the dropdown.'
        : fieldFormData.field_type === 'RADIO'
        ? 'Add the options that users can choose from with radio buttons.'
        : 'Add the options that users can select multiple values from (multi-select dropdown).'
      }
    </p>
  </div>
)}

          {(fieldFormData.field_type !== 'SELECT' && fieldFormData.field_type !== 'RADIO' && fieldFormData.field_type !== 'MULTISELECT') && (
            <div>
              <label htmlFor="placeholder" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placeholder Text</label>
              <input
                type="text"
                id="placeholder"
                name="placeholder"
                value={fieldFormData.placeholder}
                onChange={(e) => setFieldFormData(prev => ({ ...prev, placeholder: e.target.value }))}
                placeholder="Help text shown in the input"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          <div className="flex items-center">
            <input
              id="is_required"
              name="is_required"
              type="checkbox"
              checked={fieldFormData.is_required}
              onChange={(e) => setFieldFormData(prev => ({ ...prev, is_required: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_required" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Make this field required
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsFieldModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Field'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}