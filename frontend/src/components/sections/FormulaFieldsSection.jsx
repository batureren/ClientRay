// frontend/components/sections/FormulaFieldsSection.jsx

import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Calculator, Trash2, Info, CheckCircle, XCircle, X, RefreshCw, Clock, Play } from 'lucide-react';

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

export default function FormulaFieldsSection({ message, setMessage }) {
  const api = useApi();

  // State
  const [formulaFields, setFormulaFields] = useState([]);
  const [availableFieldsForFormula, setAvailableFieldsForFormula] = useState({ fields: [], functions: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [formulaFormData, setFormulaFormData] = useState({
    module: 'leads',
    field_label: '',
    return_type: 'TEXT',
    formula_expression: '',
    description: '',
    update_schedule: 'manual',
    target_field_name: ''
  });
  const [formulaValidation, setFormulaValidation] = useState(null);
  const [isValidatingFormula, setIsValidatingFormula] = useState(false);
  const [manualUpdateLoading, setManualUpdateLoading] = useState({});
  const [customFields, setCustomFields] = useState([]);

  // Schedule options for the dropdown
  const scheduleOptions = [
    { value: 'manual', label: 'Manual Only', description: 'Only update when manually triggered' },
    { value: 'hourly', label: 'Every Hour', description: 'Updates every hour at minute 0' },
    { value: 'every_6_hours', label: 'Every 6 Hours', description: 'Updates every 6 hours' },
    { value: 'every_12_hours', label: 'Every 12 Hours', description: 'Updates every 12 hours' },
    { value: 'daily', label: 'Daily', description: 'Updates daily at 2 AM' },
    { value: 'weekly', label: 'Weekly', description: 'Updates every Sunday at 2 AM' },
    { value: 'monthly', label: 'Monthly', description: 'Updates on the 1st of each month at 2 AM' }
  ];

  // Helper function to get schedule display info
  const getScheduleInfo = (schedule) => {
    const option = scheduleOptions.find(opt => opt.value === schedule);
    return option || { label: 'Unknown', description: '' };
  };

  // Data Fetching
  const fetchFormulaFields = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/formula-fields');
      setFormulaFields(response || []);
    } catch (error) {
      console.error("Failed to fetch formula fields:", error);
      setMessage({ type: 'error', content: 'Could not load formula fields.' });
    } finally {
      setIsLoading(false);
    }
  };

const fetchCustomFields = async (module) => {
  try {
    const response = await api.get('/custom-fields');
    const moduleCustomFields = (response || []).filter(field => field.module === module);
    setCustomFields(moduleCustomFields);
  } catch (error) {
    console.error("Failed to fetch custom fields:", error);
    setCustomFields([]);
    setMessage({ type: 'error', content: 'Could not load custom fields.' });
  }
};

  const fetchAvailableFieldsForFormula = async (module) => {
    try {
      const response = await api.get(`/formula-fields/available-fields/${module}`);
      setAvailableFieldsForFormula(response || { fields: [], functions: [] });
    } catch (error) {
      console.error("Failed to fetch available fields for formula:", error);
    }
  };

  useEffect(() => {
    fetchFormulaFields();
  }, []);

    useEffect(() => {
    if (availableFieldsForFormula.fields.length > 0 && !formulaFormData.target_field_name) {
      setFormulaFormData(prev => ({
        ...prev,
        target_field_name: availableFieldsForFormula.fields[0].field_name
      }));
    }
  }, [availableFieldsForFormula.fields]);

useEffect(() => {
  if (customFields.length > 0) {
    setFormulaFormData(prev => {
      const currentFieldExists = customFields.some(field => field.field_name === prev.target_field_name);
      
      if (!prev.target_field_name || !currentFieldExists) {
        return {
          ...prev,
          target_field_name: customFields[0].field_name
        };
      }
      return prev; 
    });
  } else {
    setFormulaFormData(prev => ({
      ...prev,
      target_field_name: ''
    }));
  }
}, [customFields]);

  const validateFormula = async (formula, module) => {
    if (!formula.trim()) {
      setFormulaValidation(null);
      return;
    }

    setIsValidatingFormula(true);
    try {
      const response = await api.post('/formula-fields/validate', { formula, module });
      setFormulaValidation(response);
    } catch (error) {
      setFormulaValidation({ 
        valid: false, 
        error: error.response?.error || 'Validation failed' 
      });
    } finally {
      setIsValidatingFormula(false);
    }
  };

const handleOpenFormulaModal = () => {
  setMessage({ type: '', content: '' });
  setFormulaFormData({
    module: 'leads',
    field_label: '',
    return_type: 'TEXT',
    formula_expression: '',
    description: '',
    update_schedule: 'manual',
    target_field_name: ''
  });
  setFormulaValidation(null);
  setIsFormulaModalOpen(true);
  fetchAvailableFieldsForFormula('leads');
  fetchCustomFields('leads'); // Add this line
};

const handleFormulaModuleChange = (module) => {
  setFormulaFormData(prev => ({
    ...prev,
    module,
    target_field_name: ''
  }));
  
  fetchAvailableFieldsForFormula(module);
  fetchCustomFields(module);
  
  if (formulaFormData.formula_expression.trim()) {
    validateFormula(formulaFormData.formula_expression, module);
  }
};

  const handleFormulaExpressionChange = (expression) => {
    setFormulaFormData(prev => ({ ...prev, formula_expression: expression }));
    clearTimeout(window.formulaValidationTimeout);
    window.formulaValidationTimeout = setTimeout(() => {
      validateFormula(expression, formulaFormData.module);
    }, 500);
  };

  const handleFormulaFormSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post('/formula-fields', formulaFormData);
      setMessage({ type: 'success', content: 'Formula field created successfully!' });
      setIsFormulaModalOpen(false);
      fetchFormulaFields();
    } catch (error) {
      console.error('Failed to create formula field:', error);
      const errorMessage = error.response?.error || 'Failed to create formula field.';
      setMessage({ type: 'error', content: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFormulaField = async (fieldId) => {
    if (window.confirm('Are you sure you want to delete this formula field?')) {
      try {
        await api.delete(`/formula-fields/${fieldId}`);
        setMessage({ type: 'success', content: 'Formula field deleted successfully.' });
        fetchFormulaFields();
      } catch (error) {
        console.error("Failed to delete formula field:", error);
        setMessage({ type: 'error', content: 'Could not delete the formula field.' });
      }
    }
  };

  // Manual trigger function
  const triggerManualUpdate = async (fieldId) => {
    setManualUpdateLoading(prev => ({ ...prev, [fieldId]: true }));
    
    try {
      await api.post(`/formula-fields/trigger/${fieldId}`);
      setMessage({ type: 'success', content: 'Manual update completed successfully!' });
      fetchFormulaFields(); // Refresh to show updated timestamps
    } catch (error) {
      console.error('Failed to trigger manual update:', error);
      const errorMessage = error.response?.error || 'Failed to trigger manual update.';
      setMessage({ type: 'error', content: errorMessage });
    } finally {
      setManualUpdateLoading(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  // Update schedule function
  const updateSchedule = async (fieldId, newSchedule) => {
    try {
      await api.put(`/formula-fields/${fieldId}/schedule`, { update_schedule: newSchedule });
      setMessage({ type: 'success', content: 'Schedule updated successfully!' });
      fetchFormulaFields();
    } catch (error) {
      console.error('Failed to update schedule:', error);
      setMessage({ type: 'error', content: 'Failed to update schedule.' });
    }
  };

  const insertFieldReference = (fieldName) => {
    const textarea = document.getElementById('formula_expression');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = formulaFormData.formula_expression;
      const newValue = currentValue.substring(0, start) + `{${fieldName}}` + currentValue.substring(end);
      
      setFormulaFormData(prev => ({ ...prev, formula_expression: newValue }));
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldName.length + 2, start + fieldName.length + 2);
      }, 0);
    }
  };

  const insertFunction = (functionName) => {
    const textarea = document.getElementById('formula_expression');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = formulaFormData.formula_expression;
      const newValue = currentValue.substring(0, start) + `${functionName}()` + currentValue.substring(end);
      
      setFormulaFormData(prev => ({ ...prev, formula_expression: newValue }));
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + functionName.length + 1, start + functionName.length + 1);
      }, 0);
    }
  };

  // Helper function to format last updated time
  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Formula Fields
          </h2>
          <button
            onClick={handleOpenFormulaModal}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
          >
            <Calculator className="w-4 h-4" />
            Add Formula Field
          </button>
        </div>

        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            About Formula Fields
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Formula fields automatically calculate values based on other fields and functions. 
            They can be scheduled to update automatically (hourly, daily, weekly) or triggered manually.
            Scheduled updates help keep calculated values current without impacting real-time performance.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</p>
        ) : (
          <div className="space-y-6">
            {['leads', 'accounts'].map(module => {
              const moduleFields = formulaFields.filter(f => f.module === module);
              return (
                <div key={module}>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 capitalize">
                    {module} Formula Fields
                  </h3>
                  <div className="space-y-3">
                    {moduleFields.length > 0 ? (
                      moduleFields.map(field => (
                        <div key={field.id} className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {field.field_label}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                field.is_active 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              }`}>
                                {field.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                {field.return_type}
                              </span>
                            </div>

                            {/* Schedule Information */}
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Schedule: <span className="font-medium">{getScheduleInfo(field.update_schedule || 'manual').label}</span>
                              </span>
                              {field.last_updated && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                  Last updated: {formatLastUpdated(field.last_updated)}
                                </span>
                              )}
                            </div>

                            {field.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {field.description}
                              </p>
                            )}
                            
                            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border">
                              <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                                {field.formula_expression}
                              </code>
                            </div>

                            {/* Schedule Update Dropdown */}
                            <div className="mt-3 flex items-center gap-2">
                              <label className="text-xs text-gray-500 dark:text-gray-400">Update Schedule:</label>
                              <select
                                value={field.update_schedule || 'manual'}
                                onChange={(e) => updateSchedule(field.id, e.target.value)}
                                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                {scheduleOptions.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            {/* Manual Trigger Button */}
                            <button
                              onClick={() => triggerManualUpdate(field.id)}
                              disabled={manualUpdateLoading[field.id]}
                              className="p-2 text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 disabled:opacity-50"
                              title="Trigger Manual Update"
                            >
                              {manualUpdateLoading[field.id] ? (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteFormulaField(field.id)}
                              className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                              title="Delete Formula Field"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        No formula fields defined for {module}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formula Field Modal */}
      <Modal 
        isOpen={isFormulaModalOpen} 
        onClose={() => setIsFormulaModalOpen(false)} 
        title="Create Formula Field" 
        size="2xl"
      >
        <form onSubmit={handleFormulaFormSubmit} className="space-y-4">
          {message.content && message.type === 'error' && (
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
              {message.content}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="formula_module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Module
              </label>
              <select
                id="formula_module"
                value={formulaFormData.module}
                onChange={(e) => handleFormulaModuleChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              >
                <option value="leads">Leads</option>
                <option value="accounts">Accounts</option>
              </select>
            </div>

            <div>
              <label htmlFor="formula_return_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Return Type
              </label>
              <select
                id="formula_return_type"
                value={formulaFormData.return_type}
                onChange={(e) => setFormulaFormData(prev => ({ ...prev, return_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
                <option value="BOOLEAN">Boolean</option>
                <option value="MULTISELECT">Multiselect</option>
              </select>
            </div>
          </div>

        <div>
            <label htmlFor="formula_field_label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formula Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="formula_field_label"
              value={formulaFormData.field_label}
              onChange={(e) => setFormulaFormData(prev => ({ ...prev, field_label: e.target.value }))}
              placeholder="e.g., Check for Phone Number"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            />
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              A unique name for this formula rule.
            </p>
          </div>

<div>
  <label htmlFor="formula_target_field" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Target Field to Update
  </label>
  <select
    id="formula_target_field"
    value={formulaFormData.target_field_name}
    onChange={(e) => setFormulaFormData(prev => ({ ...prev, target_field_name: e.target.value }))}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
  >
    {customFields.length === 0 ? (
      <option value="">No custom fields available</option>
    ) : (
      customFields.map(field => (
        <option key={field.field_name} value={field.field_name}>
          {field.field_label} ({field.field_type})
        </option>
      ))
    )}
  </select>
  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
    Select a custom field to overwrite with the formula's result. Only custom fields are shown to prevent overwriting system fields.
  </p>
</div>

          {/* NEW: Update Schedule Dropdown */}
          <div>
            <label htmlFor="formula_update_schedule" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Update Schedule
            </label>
            <select
              id="formula_update_schedule"
              value={formulaFormData.update_schedule}
              onChange={(e) => setFormulaFormData(prev => ({ ...prev, update_schedule: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            >
              {scheduleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {getScheduleInfo(formulaFormData.update_schedule).description}
            </p>
          </div>

          <div>
            <label htmlFor="formula_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              id="formula_description"
              value={formulaFormData.description}
              onChange={(e) => setFormulaFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this formula calculates"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="formula_expression" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formula Expression
            </label>
            <textarea
              id="formula_expression"
              value={formulaFormData.formula_expression}
              onChange={(e) => handleFormulaExpressionChange(e.target.value)}
              placeholder="e.g., IF({lead_score} > 80 AND {industry} = 'Technology', 'Hot Lead', 'Cold Lead')"
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
            
            {/* Formula Validation Display */}
            {formulaValidation && (
              <div className={`mt-2 p-2 rounded-md flex items-start gap-2 ${
                formulaValidation.valid 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
              }`}>
                {formulaValidation.valid ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-xs ${
                  formulaValidation.valid 
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {formulaValidation.valid ? 'Formula is valid!' : formulaValidation.error}
                </p>
              </div>
            )}

            {isValidatingFormula && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Validating formula...
              </p>
            )}
          </div>

          {/* Field and Function References */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Available Fields</h4>
              <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {availableFieldsForFormula.fields?.map(field => (
                  <button
                    key={field.field_name}
                    type="button"
                    onClick={() => insertFieldReference(field.field_name)}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="font-medium">{field.field_label}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">({field.field_type})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Available Functions</h4>
              <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {availableFieldsForFormula.functions?.map(func => (
                  <button
                    key={func}
                    type="button"
                    onClick={() => insertFunction(func)}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0 font-mono"
                  >
                    {func}()
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Formula Examples */}
<div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
  <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Formula Examples</h5>
  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-mono">
    <p>• Simple condition: <code>{`IF({lead_score} > 80, "Hot", "Cold")`}</code></p>
    <p>• Multiple conditions: <code>{`IF(AND({lead_score} > 70, {industry} = "Tech"), true, false)`}</code></p>
    <p>• Math calculation: <code>{`ROUND({opportunity_amount} * 0.15, 2)`}</code></p>
    <p>• Text combination: <code>{`CONCATENATE({first_name}, " ", {last_name})`}</code></p>
    <p>• Uppercase text: <code>{`UPPER({company_name})`}</code></p>
    <p>• Length check: <code>{`LEN({phone_number})`}</code></p>
    <p>• Date difference (days since created): <code>{`DATEDIFF(TODAY(), {created_date})`}</code></p>
    <p>• Date before check: <code>{`IF({contract_end} < TODAY(), "Expired", "Active")`}</code></p>
    <p>• Date after check: <code>{`IF({meeting_date} > TODAY(), "Upcoming", "Past")`}</code></p>
    <p>• Blank check: <code>{`IF(ISBLANK({email}), "Missing Email", {email})`}</code></p>
    <p>• Max of two values: <code>{`MAX({budget}, {spend})`}</code></p>
    <p>• Min of two values: <code>{`MIN({discount}, 20)`}</code></p>
    <p>• Not logic: <code>{`IF(NOT({is_active}), "Inactive", "Active")`}</code></p>
    <p>• Complex example (lead score aging):  
      <code>{`IF(AND({lead_score} > 70, DATEDIFF(TODAY(), {last_contacted}) > 30), "Stale Lead", "Fresh")`}</code>
    </p>
  </div>
</div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsFormulaModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formulaValidation?.valid}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Formula Field'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}