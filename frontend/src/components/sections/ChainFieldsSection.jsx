import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { GitBranch, Plus, Trash2, Edit, X, ArrowRight, Lock, MapPin, UploadCloud } from 'lucide-react';

// Reusable Modal Component (no changes here)
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl'
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


export default function ChainFieldsSection({ message, setMessage }) {
  const api = useApi();

  // State
  const [chainRules, setChainRules] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChainModalOpen, setIsChainModalOpen] = useState(false);
  const [chainModalMode, setChainModalMode] = useState('create');
  const [currentChain, setCurrentChain] = useState(null);
  const [chainFormData, setChainFormData] = useState({
    rule_name: '',
    module: 'leads',
    source_field_id: '',
    trigger_value: '',
    target_field_id: '',
    target_value: '',
    comparison_operator: 'equals',
    rule_type: 'simple',
    bulk_mappings: []
  });

  // Bulk mapping state for adding new mappings
  const [newMapping, setNewMapping] = useState({
    trigger_value: '',
    target_value: '',
    comparison_operator: 'equals'
  });

  // *** NEW: State for batch import ***
  const [bulkImportMode, setBulkImportMode] = useState('single'); // 'single' or 'batch'
  const [batchMappingsText, setBatchMappingsText] = useState('');

  const comparisonOperators = [
    { value: 'equals', label: 'Equals', description: 'Exact match' },
    { value: 'not_equals', label: 'Not Equals', description: 'Does not match' },
    { value: 'contains', label: 'Contains', description: 'Contains text (for text fields)' },
    { value: 'greater_than', label: 'Greater Than', description: 'Greater than value (for numbers)' },
    { value: 'less_than', label: 'Less Than', description: 'Less than value (for numbers)' },
    { value: 'is_empty', label: 'Is Empty', description: 'Field has no value' },
    { value: 'is_not_empty', label: 'Is Not Empty', description: 'Field has any value' }
  ];

  // Data Fetching
  const fetchChainRules = async () => {
    try {
      const response = await api.get('/chain-fields');
      setChainRules(response || []);
    } catch (error) {
      console.error("Failed to fetch chain rules:", error);
      setMessage({ type: 'error', content: 'Could not load chain rules.' });
    }
  };

  const fetchCustomFields = async () => {
    try {
      const response = await api.get('/custom-fields');
      setCustomFields(response || []);
    } catch (error) {
      console.error("Failed to fetch custom fields:", error);
      setCustomFields([]);
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchChainRules(), fetchCustomFields()]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Helper functions
  const getFieldsByModule = (module) => {
    return customFields.filter(field => field.module === module);
  };

  const getFieldById = (fieldId) => {
    return customFields.find(field => field.id === parseInt(fieldId));
  };

  const getOperatorLabel = (operator) => {
    const op = comparisonOperators.find(op => op.value === operator);
    return op ? op.label : operator;
  };

  // Bulk mapping handlers
  const addBulkMapping = () => {
    if (!newMapping.trigger_value.trim() || !newMapping.target_value.trim()) {
      setMessage({ type: 'error', content: 'Both trigger and target values are required for bulk mappings.' });
      return;
    }

    const isDuplicate = chainFormData.bulk_mappings.some(
      mapping => mapping.trigger_value.toLowerCase() === newMapping.trigger_value.toLowerCase()
    );

    if (isDuplicate) {
      setMessage({ type: 'error', content: 'This trigger value already exists in the mappings.' });
      return;
    }

    setChainFormData(prev => ({
      ...prev,
      bulk_mappings: [...prev.bulk_mappings, { ...newMapping }]
    }));

    setNewMapping({
      trigger_value: '',
      target_value: '',
      comparison_operator: 'equals'
    });

    setMessage({ type: '', content: '' });
  };

  const removeBulkMapping = (index) => {
    setChainFormData(prev => ({
      ...prev,
      bulk_mappings: prev.bulk_mappings.filter((_, i) => i !== index)
    }));
  };

  // Event Handlers
  const handleOpenChainModal = (mode = 'create', chain = null) => {
    setChainModalMode(mode);
    setMessage({ type: '', content: '' });
    
    // *** NEW: Reset batch import state on modal open ***
    setBulkImportMode('single');
    setBatchMappingsText('');
    
    if (mode === 'edit' && chain) {
      setCurrentChain(chain);
      setChainFormData({
        rule_name: chain.rule_name,
        module: chain.module,
        source_field_id: chain.source_field_id.toString(),
        trigger_value: chain.trigger_value || '',
        target_field_id: chain.target_field_id.toString(),
        target_value: chain.target_value || '',
        comparison_operator: chain.comparison_operator,
        rule_type: chain.rule_type || 'simple',
        bulk_mappings: chain.mappings || []
      });
    } else {
      setCurrentChain(null);
      setChainFormData({
        rule_name: '',
        module: 'leads',
        source_field_id: '',
        trigger_value: '',
        target_field_id: '',
        target_value: '',
        comparison_operator: 'equals',
        rule_type: 'simple',
        bulk_mappings: []
      });
    }

    setNewMapping({
      trigger_value: '',
      target_value: '',
      comparison_operator: 'equals'
    });

    setIsChainModalOpen(true);
  };
  
  // *** NEW: Batch import handler ***
  const handleBatchImport = () => {
    if (!batchMappingsText.trim()) {
      setMessage({ type: 'error', content: 'Batch import field is empty.' });
      return;
    }

    const lines = batchMappingsText.trim().split('\n');
    const newMappings = [];
    const existingTriggers = new Set(chainFormData.bulk_mappings.map(m => m.trigger_value.toLowerCase()));
    let duplicatesInBatch = 0;
    let invalidLines = 0;

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      // Remove trailing comma if present
      if (line.endsWith(',')) {
          line = line.slice(0, -1);
      }
      
      // Find the separator (colon or comma)
      const separatorIndex = line.includes(':') ? line.indexOf(':') : line.lastIndexOf(',');
      
      if (separatorIndex === -1) {
        invalidLines++;
        return;
      }
      
      let trigger = line.substring(0, separatorIndex).trim();
      let target = line.substring(separatorIndex + 1).trim();

      // Clean up quotes
      trigger = trigger.replace(/^"|"$/g, '');
      target = target.replace(/^"|"$/g, '');

      if (!trigger || !target) {
        invalidLines++;
        return;
      }
      
      if (existingTriggers.has(trigger.toLowerCase())) {
        duplicatesInBatch++;
        return;
      }

      newMappings.push({
        trigger_value: trigger,
        target_value: target,
        comparison_operator: 'equals'
      });
      existingTriggers.add(trigger.toLowerCase());
    });

    if (newMappings.length > 0) {
      setChainFormData(prev => ({
        ...prev,
        bulk_mappings: [...prev.bulk_mappings, ...newMappings]
      }));
      let successMessage = `${newMappings.length} new mappings imported successfully.`;
      if (duplicatesInBatch > 0 || invalidLines > 0) {
        successMessage += ` ${duplicatesInBatch} duplicates and ${invalidLines} invalid lines were skipped.`;
      }
      setMessage({ type: 'success', content: successMessage });
      setBatchMappingsText(''); // Clear textarea on success
    } else {
      setMessage({ type: 'error', content: 'No valid new mappings found. Please check the format and ensure trigger values are unique.' });
    }
  };

  // (No changes to other handlers like handleModuleChange, handleOperatorChange, etc.)
  const handleModuleChange = (module) => {
    setChainFormData(prev => ({
      ...prev,
      module,
      source_field_id: '',
      target_field_id: ''
    }));
  };

  const handleOperatorChange = (operator) => {
    setChainFormData(prev => ({
      ...prev,
      comparison_operator: operator,
      trigger_value: (operator === 'is_empty' || operator === 'is_not_empty') ? '' : prev.trigger_value
    }));
  };

  const handleRuleTypeChange = (ruleType) => {
    setChainFormData(prev => ({
      ...prev,
      rule_type: ruleType,
      trigger_value: '',
      target_value: '',
      bulk_mappings: []
    }));

    setNewMapping({
      trigger_value: '',
      target_value: '',
      comparison_operator: 'equals'
    });
  };

  const handleChainFormSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!chainFormData.rule_name || !chainFormData.source_field_id || !chainFormData.target_field_id) {
      setMessage({ type: 'error', content: 'Rule name, source field, and target field are required.' });
      setIsLoading(false);
      return;
    }

    if (chainFormData.source_field_id === chainFormData.target_field_id) {
      setMessage({ type: 'error', content: 'Source and target fields cannot be the same.' });
      setIsLoading(false);
      return;
    }

    if (chainFormData.rule_type === 'simple') {
      const needsTriggerValue = !['is_empty', 'is_not_empty'].includes(chainFormData.comparison_operator);
      if (needsTriggerValue && !chainFormData.trigger_value.trim()) {
        setMessage({ type: 'error', content: 'Trigger value is required for this comparison operator.' });
        setIsLoading(false);
        return;
      }
      if (!chainFormData.target_value.trim()) {
        setMessage({ type: 'error', content: 'Target value is required for simple rules.' });
        setIsLoading(false);
        return;
      }
    } else if (chainFormData.rule_type === 'bulk_mapping') {
      if (chainFormData.bulk_mappings.length === 0) {
        setMessage({ type: 'error', content: 'At least one mapping is required for bulk mapping rules.' });
        setIsLoading(false);
        return;
      }
    }

    try {
      const submitData = { ...chainFormData };
      
      if (chainModalMode === 'edit') {
        await api.put(`/chain-fields/${currentChain.id}`, submitData);
        setMessage({ type: 'success', content: 'Chain rule updated successfully!' });
      } else {
        await api.post('/chain-fields', submitData);
        setMessage({ type: 'success', content: 'Chain rule created successfully!' });
      }
      setIsChainModalOpen(false);
      fetchAllData();
    } catch (error) {
      console.error('Failed to save chain rule:', error);
      const errorMessage = error.response?.error || 'Failed to save chain rule.';
      setMessage({ type: 'error', content: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChainRule = async (ruleId) => {
    if (window.confirm('Are you sure you want to delete this chain rule?')) {
      try {
        await api.delete(`/chain-fields/${ruleId}`);
        setMessage({ type: 'success', content: 'Chain rule deleted successfully.' });
        fetchAllData();
      } catch (error) {
        console.error("Failed to delete chain rule:", error);
        setMessage({ type: 'error', content: 'Could not delete the chain rule.' });
      }
    }
  };

  // Render Functions (no changes to renderChainRuleCard or renderChainRulesList)
  const renderChainRuleCard = (rule) => {
    const isSimpleRule = rule.rule_type === 'simple' || !rule.rule_type;
    
    return (
      <div key={rule.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{rule.rule_name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                rule.is_active 
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}>
                {rule.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isSimpleRule
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
              }`}>
                {isSimpleRule ? (
                  <>
                    <GitBranch className="w-3 h-3 mr-1" />
                    Simple Rule
                  </>
                ) : (
                  <>
                    <MapPin className="w-3 h-3 mr-1" />
                    Bulk Mapping ({rule.mappings?.length || 0} mappings)
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenChainModal('edit', rule)}
              className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
              title="Edit Chain Rule"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteChainRule(rule.id)}
              className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              title="Delete Chain Rule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chain Flow Visualization */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="text-center">
                <div className="font-medium text-blue-600 dark:text-blue-400">
                  {rule.source_field_label}
                </div>
                <div className="text-xs text-gray-500 mt-1">Source Field</div>
              </div>
              
              <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                {isSimpleRule ? (
                  <>
                    <span className="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">
                      {getOperatorLabel(rule.comparison_operator)}
                    </span>
                    {rule.trigger_value && (
                      <span className="text-xs font-mono bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                        "{rule.trigger_value}"
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs font-mono bg-purple-200 dark:bg-purple-700 px-2 py-1 rounded">
                    {rule.mappings?.length || 0} Mappings
                  </span>
                )}
              </div>
              
              <ArrowRight className="w-4 h-4 text-gray-400" />
              
              <div className="text-center">
                <div className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {rule.target_field_label}
                </div>
                <div className="text-xs text-gray-500 mt-1">Target Field (Read-only)</div>
              </div>
              
              {isSimpleRule && (
                <>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="text-center">
                    <div className="font-mono text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                      "{rule.target_value}"
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Assigned Value</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {!isSimpleRule && rule.mappings && rule.mappings.length > 0 && (
            <div className="mt-3 border-t dark:border-gray-600 pt-3">
              <div className="text-xs text-gray-500 mb-2">Sample Mappings:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rule.mappings.slice(0, 4).map((mapping, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-xs">
                    <span className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">
                      "{mapping.trigger_value}"
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">
                      "{mapping.target_value}"
                    </span>
                  </div>
                ))}
                {rule.mappings.length > 4 && (
                  <div className="text-xs text-gray-500 italic">
                    +{rule.mappings.length - 4} more mappings...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChainRulesList = (moduleRules, moduleName) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
        {moduleName} Chain Rules
      </h3>
      <div className="space-y-3">
        {moduleRules.length > 0 ? (
          moduleRules.map(rule => renderChainRuleCard(rule))
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No chain rules defined for {moduleName}.
          </p>
        )}
      </div>
    </div>
  );

  const leadsRules = chainRules.filter(rule => rule.module === 'leads');
  const accountsRules = chainRules.filter(rule => rule.module === 'accounts');


  // The main component return statement and the modal are heavily modified.
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chain Fields</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create conditional field relationships that automatically set values based on other field values
          </p>
        </div>
        <button
          onClick={() => handleOpenChainModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <GitBranch className="w-5 h-5" />
          Add Chain Rule
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">How Chain Fields Work</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Chain fields automatically set the value of a target field when a source field meets specific conditions. 
              Choose between two rule types:
            </p>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3 h-3" />
                <span><strong>Simple Rules:</strong> One trigger value sets one target value</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                <span><strong>Bulk Mapping:</strong> Multiple trigger values mapped to their respective target values in one rule</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading && !chainRules.length ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderChainRulesList(leadsRules, 'Leads')}
          {renderChainRulesList(accountsRules, 'Accounts')}
        </div>
      )}

      {/* Chain Rule Create/Edit Modal */}
      <Modal 
        isOpen={isChainModalOpen} 
        onClose={() => setIsChainModalOpen(false)} 
        title={chainModalMode === 'edit' ? 'Edit Chain Rule' : 'Create Chain Rule'}
        size="4xl"
      >
        <form onSubmit={handleChainFormSubmit} className="space-y-6">
          {message.content && (
            <div className={`p-3 rounded-md ${
              message.type === 'error' 
                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' 
                : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
            }`}>
              {message.content}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="rule_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="rule_name"
                value={chainFormData.rule_name}
                onChange={(e) => setChainFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="e.g., School Rank Assignment"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
              <select
                id="module"
                value={chainFormData.module}
                onChange={(e) => handleModuleChange(e.target.value)}
                disabled={chainModalMode === 'edit'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="leads">Leads</option>
                <option value="accounts">Accounts</option>
              </select>
            </div>

            <div>
              <label htmlFor="rule_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Type
              </label>
              <select
                id="rule_type"
                value={chainFormData.rule_type}
                onChange={(e) => handleRuleTypeChange(e.target.value)}
                disabled={chainModalMode === 'edit'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="simple">Simple Rule</option>
                <option value="bulk_mapping">Bulk Mapping</option>
              </select>
            </div>
          </div>
          
          {/* Source and Target Field Configuration (no changes here) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Source Field (Trigger)
              </h4>
              
              <div>
                <label htmlFor="source_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field to Monitor <span className="text-red-500">*</span>
                </label>
                <select
                  id="source_field_id"
                  value={chainFormData.source_field_id}
                  onChange={(e) => setChainFormData(prev => ({ ...prev, source_field_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select source field...</option>
                  {getFieldsByModule(chainFormData.module).map(field => (
                    <option key={field.id} value={field.id}>
                      {field.field_label} ({field.field_type})
                    </option>
                  ))}
                </select>
              </div>

              {chainFormData.rule_type === 'simple' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="comparison_operator" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Condition
                    </label>
                    <select
                      id="comparison_operator"
                      value={chainFormData.comparison_operator}
                      onChange={(e) => handleOperatorChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                    >
                      {comparisonOperators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="trigger_value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Trigger Value
                    </label>
                    <input
                      type="text"
                      id="trigger_value"
                      value={chainFormData.trigger_value}
                      onChange={(e) => setChainFormData(prev => ({ ...prev, trigger_value: e.target.value }))}
                      placeholder="e.g., California"
                      disabled={chainFormData.comparison_operator === 'is_empty' || chainFormData.comparison_operator === 'is_not_empty'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Target Field (Auto-filled)
              </h4>
              
              <div>
                <label htmlFor="target_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field to Auto-fill <span className="text-red-500">*</span>
                </label>
                <select
                  id="target_field_id"
                  value={chainFormData.target_field_id}
                  onChange={(e) => setChainFormData(prev => ({ ...prev, target_field_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select target field...</option>
                  {getFieldsByModule(chainFormData.module)
                    .filter(field => field.id.toString() !== chainFormData.source_field_id)
                    .map(field => (
                    <option key={field.id} value={field.id}>
                      {field.field_label} ({field.field_type})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This field will become read-only and automatically filled when the condition is met.
                </p>
              </div>
            </div>
          </div>
          
          {/* *** MODIFIED: Conditional Value Section with Tabs *** */}
          {chainFormData.rule_type === 'simple' ? (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                Value to Assign
              </h4>
              <div>
                <label htmlFor="target_value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value to Set <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="target_value"
                  value={chainFormData.target_value}
                  onChange={(e) => setChainFormData(prev => ({ ...prev, target_value: e.target.value }))}
                  placeholder="e.g., A-Rank"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The value that will be automatically assigned to the target field.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  Define Bulk Mappings
                </h4>
                {/* TABS for input mode */}
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md p-0.5">
                    <button type="button" onClick={() => setBulkImportMode('single')} className={`px-3 py-1 text-xs rounded-md ${bulkImportMode === 'single' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>One by One</button>
                    <button type="button" onClick={() => setBulkImportMode('batch')} className={`px-3 py-1 text-xs rounded-md ${bulkImportMode === 'batch' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Batch Import</button>
                </div>
              </div>
              
              {bulkImportMode === 'single' ? (
                <div className="flex items-end gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Source Value</label>
                    <input type="text" placeholder="e.g., California" value={newMapping.trigger_value} onChange={(e) => setNewMapping(prev => ({ ...prev, trigger_value: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"/>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Target Value</label>
                     <input type="text" placeholder="e.g., West Coast" value={newMapping.target_value} onChange={(e) => setNewMapping(prev => ({ ...prev, target_value: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"/>
                  </div>
                  <button type="button" onClick={addBulkMapping} className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"><Plus className="w-5 h-5" /></button>
                </div>
              ) : (
                <div>
                  <textarea
                    rows="5"
                    value={batchMappingsText}
                    onChange={(e) => setBatchMappingsText(e.target.value)}
                    placeholder={'"Harvard University": "A",\nStanford University: B\n"MIT", "C"'}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  ></textarea>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use `Source: Target` or `"Source", "Target"` format, one per line.
                    </p>
                    <button
                      type="button"
                      onClick={handleBatchImport}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Import Mappings
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 max-h-60 overflow-y-auto pr-2 space-y-2">
                {chainFormData.bulk_mappings.length > 0 ? (
                  chainFormData.bulk_mappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                      <span className="flex-1 font-mono text-sm text-blue-800 dark:text-blue-300">{mapping.trigger_value}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="flex-1 font-mono text-sm text-green-800 dark:text-green-300">{mapping.target_value}</span>
                      <button type="button" onClick={() => removeBulkMapping(index)} className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">No mappings defined yet. Add them above.</p>
                )}
              </div>
            </div>
          )}

          {/* Preview (no changes) */}
          {chainFormData.source_field_id && chainFormData.target_field_id && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview</h5>
              {chainFormData.rule_type === 'simple' ? (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {getFieldById(chainFormData.source_field_id)?.field_label}
                  </span>
                  <span className="text-gray-500">{getOperatorLabel(chainFormData.comparison_operator)}</span>
                  {chainFormData.trigger_value && (
                    <span className="font-mono bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                      "{chainFormData.trigger_value}"
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {getFieldById(chainFormData.target_field_id)?.field_label}
                  </span>
                  <span className="text-gray-500">=</span>
                  <span className="font-mono bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                    "{chainFormData.target_value}"
                  </span>
                </div>
              ) : (
                 <div className="flex items-center space-x-2 text-sm">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {getFieldById(chainFormData.source_field_id)?.field_label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {getFieldById(chainFormData.target_field_id)?.field_label}
                  </span>
                  <span className="text-gray-500">via</span>
                  <span className="font-mono bg-purple-200 dark:bg-purple-700 px-2 py-1 rounded">
                    {chainFormData.bulk_mappings.length} mappings
                  </span>
                 </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsChainModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : chainModalMode === 'edit' ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}