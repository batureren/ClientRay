// frontend/components/sections/FieldMappingsSection.jsx

import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { Link, ArrowRight, Trash2, AlertTriangle, X } from 'lucide-react';

// Field Type Compatibility Matrix
const FIELD_TYPE_COMPATIBILITY = {
  'TEXT': ['TEXT', 'TEXTAREA'],
  'TEXTAREA': ['TEXT', 'TEXTAREA'], 
  'NUMBER': ['NUMBER'],
  'DATE': ['DATE'],
  'BOOLEAN': ['BOOLEAN'],
  'SELECT': ['SELECT', 'RADIO', 'MULTISELECT'],
  'RADIO': ['SELECT', 'RADIO', 'MULTISELECT'],
  'MULTISELECT': ['MULTISELECT', 'SELECT']
};

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

export default function FieldMappingsSection({ message, setMessage }) {
  const api = useApi();

  // State
  const [mappings, setMappings] = useState([]);
  const [availableFields, setAvailableFields] = useState({ lead_fields: [], account_fields: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingFormData, setMappingFormData] = useState({
    lead_field_id: '',
    account_field_id: '',
    mapping_type: 'DIRECT'
  });

  // Computed Compatible Account Fields
  const compatibleAccountFields = useMemo(() => {
    if (!mappingFormData.lead_field_id) {
      return availableFields.account_fields;
    }

    const selectedLeadField = availableFields.lead_fields.find(
      field => field.id.toString() === mappingFormData.lead_field_id
    );

    if (!selectedLeadField) {
      return availableFields.account_fields;
    }

    const compatibleTypes = FIELD_TYPE_COMPATIBILITY[selectedLeadField.field_type] || [];
    
    return availableFields.account_fields.filter(
      accountField => compatibleTypes.includes(accountField.field_type)
    );
  }, [mappingFormData.lead_field_id, availableFields]);

  // Data Fetching
  const fetchMappings = async () => {
    try {
      const response = await api.get('/custom-field-mappings');
      setMappings(response || []);
    } catch (error) {
      console.error("Failed to fetch field mappings:", error);
      setMessage({ type: 'error', content: 'Could not load field mappings.' });
    }
  };

  const fetchAvailableFields = async () => {
    try {
      const response = await api.get('/custom-field-mappings/available-fields');
      setAvailableFields(response || { lead_fields: [], account_fields: [] });
    } catch (error) {
      console.error("Failed to fetch available fields:", error);
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchMappings(), fetchAvailableFields()]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Event Handlers
  const handleOpenMappingModal = () => {
    setMessage({ type: '', content: '' });
    setMappingFormData({
      lead_field_id: '',
      account_field_id: '',
      mapping_type: 'DIRECT'
    });
    setIsMappingModalOpen(true);
  };

  const handleLeadFieldChange = (leadFieldId) => {
    setMappingFormData(prev => ({
      ...prev,
      lead_field_id: leadFieldId,
      account_field_id: ''
    }));
  };

  const handleMappingFormSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post('/custom-field-mappings', mappingFormData);
      setMessage({ type: 'success', content: 'Field mapping created successfully!' });
      setIsMappingModalOpen(false);
      fetchAllData();
    } catch (error) {
      console.error('Failed to create mapping:', error);
      const errorMessage = error.response?.error || 'Failed to create mapping.';
      setMessage({ type: 'error', content: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (window.confirm('Are you sure you want to delete this field mapping?')) {
      try {
        await api.delete(`/custom-field-mappings/${mappingId}`);
        setMessage({ type: 'success', content: 'Field mapping deleted successfully.' });
        fetchAllData();
      } catch (error) {
        console.error("Failed to delete mapping:", error);
        setMessage({ type: 'error', content: 'Could not delete the mapping.' });
      }
    }
  };

  // Utility Functions
  const getFieldTypeDisplay = (fieldType) => {
    const typeMap = {
      'TEXT': 'Single Line Text',
      'TEXTAREA': 'Multi-Line Text',
      'NUMBER': 'Number',
      'DATE': 'Date',
      'BOOLEAN': 'Checkbox (Yes/No)',
      'SELECT': 'Dropdown',
      'MULTISELECT': 'Multi-Select Dropdown',
      'RADIO': 'Radio Buttons'
    };
    return typeMap[fieldType] || fieldType;
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Lead to Account Field Mappings
          </h2>
          <button
            onClick={handleOpenMappingModal}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            <Link className="w-4 h-4" />
            Add Mapping
          </button>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</p>
        ) : (
          <div className="space-y-3">
            {mappings.length > 0 ? (
              mappings.map(mapping => (
                <div key={mapping.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-medium text-blue-600 dark:text-blue-400">
                        {mapping.lead_field_label}
                      </p>
                      <p className="text-xs text-gray-500">Lead Field</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                    <div className="text-center">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {mapping.account_field_label}
                      </p>
                      <p className="text-xs text-gray-500">Account Field</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                      {mapping.mapping_type}
                    </span>
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Link className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No field mappings configured.</p>
                <p className="text-sm mt-1">Create mappings to transfer lead custom fields to accounts during conversion.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Field Mapping Modal */}
      <Modal 
        isOpen={isMappingModalOpen} 
        onClose={() => setIsMappingModalOpen(false)} 
        title="Create Field Mapping" 
        size="lg"
      >
        <form onSubmit={handleMappingFormSubmit} className="space-y-4">
          {message.content && message.type === 'error' && (
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
              {message.content}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Field Mapping</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              When a lead is converted to an account, the selected lead field data will be automatically transferred to the corresponding account field.
            </p>
          </div>

          <div>
            <label htmlFor="lead_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lead Field</label>
            <select
              id="lead_field_id"
              name="lead_field_id"
              value={mappingFormData.lead_field_id}
              onChange={(e) => handleLeadFieldChange(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a lead field...</option>
              {availableFields.lead_fields.map(field => (
                <option key={field.id} value={field.id}>
                  {field.field_label} ({getFieldTypeDisplay(field.field_type)})
                </option>
              ))}
            </select>
          </div>

          <div className="text-center">
            <ArrowRight className="w-6 h-6 mx-auto text-gray-400" />
          </div>

          <div>
            <label htmlFor="account_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Field
              {mappingFormData.lead_field_id && (
                <span className="text-xs text-gray-500 ml-2">
                  (Compatible types only)
                </span>
              )}
            </label>
            <select
              id="account_field_id"
              name="account_field_id"
              value={mappingFormData.account_field_id}
              onChange={(e) => setMappingFormData(prev => ({ ...prev, account_field_id: e.target.value }))}
              required
              disabled={!mappingFormData.lead_field_id}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">
                {mappingFormData.lead_field_id ? 'Select an account field...' : 'Select a lead field first'}
              </option>
              {compatibleAccountFields.map(field => (
                <option key={field.id} value={field.id}>
                  {field.field_label} ({getFieldTypeDisplay(field.field_type)})
                </option>
              ))}
            </select>
            
            {mappingFormData.lead_field_id && compatibleAccountFields.length === 0 && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  No compatible account fields found. Create an account field with a compatible type first.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="mapping_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mapping Type</label>
            <select
              id="mapping_type"
              name="mapping_type"
              value={mappingFormData.mapping_type}
              onChange={(e) => setMappingFormData(prev => ({ ...prev, mapping_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="DIRECT">Direct Transfer</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsMappingModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !mappingFormData.lead_field_id || compatibleAccountFields.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}