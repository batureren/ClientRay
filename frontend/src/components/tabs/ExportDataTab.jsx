import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, FileText, Users, Building, Calendar, Settings, Upload, ArrowRight, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Helper function to generate a user-friendly label from a field key (e.g., "school_name" -> "School Name")
const generateLabel = (key) => {
  const result = key.replace(/_/g, ' ');
  return result.replace(/\b\w/g, char => char.toUpperCase());
};

const ExportDataTab = ({ leads = [], accounts = [], api }) => {
  const [exportSettings, setExportSettings] = useState({
    dataType: 'leads',
    encoding: 'utf-8',
    delimiter: ',',
    includeHeaders: true,
    dateFormat: 'iso',
    includeEmptyFields: false,
    customFields: []
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  
  // Import states
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState(null);
  const [fieldMappings, setFieldMappings] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState(null);
  const [duplicateSettings, setDuplicateSettings] = useState({
    action: 'skip',
    checkFields: ['email'],
    conflictResolution: {} 
  });

  const [allCustomFields, setAllCustomFields] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!api) return;
      try {
        const response = await api.get('/custom-fields');
        setAllCustomFields(response || []);
      } catch (error) {
        console.error("Failed to fetch custom fields:", error);
        setExportStatus({ type: 'error', message: 'Could not load custom fields.' });
      }
    };
    
    fetchCustomFields();
  }, []);

  useEffect(() => {
    const currentData = exportSettings.dataType === 'leads' ? leads : accounts;
    const fieldMap = new Map();

    if (currentData && currentData.length > 0) {
      const dataKeys = Object.keys(currentData[0]);
      const defaultKeys = 
        exportSettings.dataType === 'leads'
        ? ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'status', 'createdAt']
        : ['id', 'account_name', 'website', 'primary_contact_email', 'primary_contact_phone', 'status', 'createdAt'];

      dataKeys
        .filter(key => key !== 'custom_fields')
        .forEach(key => {
          fieldMap.set(key, {
            key: key,
            label: generateLabel(key),
            default: defaultKeys.includes(key),
          });
        });
    }

    const relevantCustomFields = allCustomFields
      .filter(cf => cf.module === exportSettings.dataType);
      
    relevantCustomFields.forEach(cf => {
      fieldMap.set(cf.field_name, {
        key: cf.field_name,
        label: cf.field_label,
        default: false,
      });
    });

    const combinedFields = Array.from(fieldMap.values());
    setAvailableFields(combinedFields);

  }, [exportSettings.dataType, allCustomFields, leads, accounts]);


  const getCurrentFields = () => {
    return availableFields;
  }

  const getCurrentData = () => {
    return exportSettings.dataType === 'leads' ? leads : accounts
  }
    
  // --- Start of formatting functions ---

  const formatDate = (dateString) => {
    if (!dateString || (typeof dateString === 'string' && dateString.trim() === '')) {
      return '';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    switch (exportSettings.dateFormat) {
      case 'iso': return date.toISOString();
      case 'us': return date.toLocaleDateString('en-US');
      case 'eu': return date.toLocaleDateString('en-GB');
      case 'timestamp': return date.getTime().toString();
      default: return dateString;
    }
  };

  const formatFieldValue = (value, fieldKey) => {
    if (value === null || value === undefined) {
      return '';
    }
  
    if (fieldKey.includes('Date') || fieldKey.includes('At')) {
      return formatDate(value);
    }
  
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '';
      }
  
      if (typeof value[0] === 'object' && value[0] !== null) {
        // NOTE: The key for your assigned products might be different.
        // Change 'assigned_products' if the field key in your data is something else.
        if (fieldKey === 'assigned_products') {
          return value.map(item => item.product_name || '').join('; ');
        }
  
        return JSON.stringify(value);
      } else {
        return value.join('; ');
      }
    }
  
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
  
    return String(value);
  };
  
  const generateCSV = () => {
    const data = getCurrentData();
    const fields = getCurrentFields();
    const selectedFieldKeys = getSelectedFields();
    const selectedFields = fields.filter(field => selectedFieldKeys.includes(field.key));
  
    let csvContent = '';
    const delimiter = exportSettings.delimiter;
  
    if (exportSettings.includeHeaders) {
      const headers = selectedFields.map(field => `"${field.label}"`);
      csvContent += headers.join(delimiter) + '\n';
    }
  
    data.forEach(item => {
      const row = selectedFields.map(field => {
        const value = field.key in item 
          ? item[field.key] 
          : (item.custom_fields && field.key in item.custom_fields ? item.custom_fields[field.key] : undefined);

        const formattedValue = formatFieldValue(value, field.key);
        return `"${String(formattedValue).replace(/"/g, '""')}"`;
      });
      csvContent += row.join(delimiter) + '\n';
    });
  
    return csvContent;
  };

  // --- End of formatting functions ---


  // Auto-detect field mappings based on column names
  const autoDetectMappings = (csvHeaders) => {
    const mappings = {}
    const targetFields = getCurrentFields()
    const usedFields = new Set()
    
    // Sort headers by confidence score to prioritize better matches
    const headerScores = csvHeaders.map(header => {
      const normalizedHeader = header.toLowerCase().trim()
      
      // Find best match with confidence score
      let bestMatch = null
      let bestScore = 0
      
      targetFields.forEach(field => {
        const fieldVariations = [
          { text: field.key.toLowerCase(), weight: 1.0 },
          { text: field.label.toLowerCase(), weight: 0.9 },
          { text: field.key.replace(/_/g, '').toLowerCase(), weight: 0.8 },
          { text: field.label.replace(/\s+/g, '').toLowerCase(), weight: 0.7 }
        ]
        
        fieldVariations.forEach(variation => {
          let score = 0
          if (normalizedHeader === variation.text) {
            score = variation.weight * 1.0 // Exact match
          } else if (normalizedHeader.includes(variation.text) || variation.text.includes(normalizedHeader)) {
            score = variation.weight * 0.8 // Partial match
          }
          
          if (score > bestScore) {
            bestScore = score
            bestMatch = field
          }
        })
      })
      
      return { header, bestMatch, score: bestScore }
    })
    
    // Sort by score (highest first) and assign mappings
    headerScores
      .filter(item => item.bestMatch && item.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .forEach(item => {
        if (!usedFields.has(item.bestMatch.key)) {
          mappings[item.header] = item.bestMatch.key
          usedFields.add(item.bestMatch.key)
        }
      })
    
    return mappings
  }

  // Get available target fields (excluding already mapped ones)
  const getAvailableTargetFields = (currentHeader) => {
    const allFields = getCurrentFields()
    const usedFields = new Set()
    
    // Collect all currently mapped fields except for the current header
    Object.entries(fieldMappings).forEach(([header, targetField]) => {
      if (header !== currentHeader && targetField && targetField !== 'ignore') {
        usedFields.add(targetField)
      }
    })
    
    return allFields.filter(field => !usedFields.has(field.key))
  }

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) return { headers: [], data: [] }
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim())
      const row = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return row
    })
    
    return { headers, data }
  }

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setExportStatus({
        type: 'error',
        message: 'Please select a CSV file'
      })
      return
    }
    
    setImportFile(file)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result)
        setImportData(parsed)
        
        // Auto-detect field mappings
        const autoMappings = autoDetectMappings(parsed.headers)
        setFieldMappings(autoMappings)
        
        // Set suggested duplicate check fields
        const suggestedFields = getSuggestedDuplicateFields()
        setDuplicateSettings(prev => ({
          ...prev,
          checkFields: suggestedFields.length > 0 ? suggestedFields : ['email']
        }))
        
        setImportDialog(true)
        setExportStatus(null)
      } catch (error) {
        setExportStatus({
          type: 'error',
          message: `Failed to parse CSV: ${error.message}`
        })
      }
    }
    reader.readAsText(file)
  }

  // Transform imported data based on mappings
  const transformImportData = () => {
    if (!importData) return []
    
    return importData.data.map((row, index) => {
      const transformedRow = {}
      
Object.entries(fieldMappings).forEach(([csvField, targetField]) => {
  if (targetField && targetField !== 'ignore') {
    let value = row[csvField];

if (targetField.includes('Date') || targetField.includes('At')) {
  if (value && value.trim() !== '') {
    // Make a parseable ISO-like string
    const isoLocal = value.replace(' ', 'T'); // e.g., "2021-05-31T18:12:14"
    const date = new Date(isoLocal);

    if (!isNaN(date.getTime())) {
      value = date.toISOString();
    } else {
      value = '';
    }
  } else {
    value = '';
  }
}
    // Handle numeric fields
    if (['score', 'revenue', 'employees'].includes(targetField)) {
      value = parseFloat(value) || 0;
    }

    transformedRow[targetField] = value;
  }
});

      
      // Add default values
      if (!transformedRow.id) {
        transformedRow.id = Date.now() + Math.random() + index
      }
      if (!transformedRow.createdAt) {
        transformedRow.createdAt = new Date().toISOString()
      }
      
      // Add row index for tracking
      transformedRow._importIndex = index
      
      return transformedRow
    })
  }

  // Check for duplicates
  const checkDuplicates = (transformedData) => {
    const existingData = getCurrentData()
    const duplicates = []
    const clean = []
    
    transformedData.forEach(newRow => {
      let foundDuplicate = false
      let duplicateInfo = null
      
      // Check each configured field for duplicates
      for (const field of duplicateSettings.checkFields) {
        if (newRow[field]) {
          const existing = existingData.find(existing => {
            // Ensure both values exist and can be compared safely
            if (!existing[field] || !newRow[field]) return false
            
            // Convert both values to strings for comparison
            const existingValue = String(existing[field]).toLowerCase()
            const newValue = String(newRow[field]).toLowerCase()
            
            return existingValue === newValue
          })
          
          if (existing) {
            foundDuplicate = true
            duplicateInfo = {
              field,
              existingRecord: existing,
              newRecord: newRow,
              duplicateValue: newRow[field]
            }
            break
          }
        }
      }
      
      if (foundDuplicate) {
        duplicates.push(duplicateInfo)
      } else {
        clean.push(newRow)
      }
    })
    
    return { duplicates, clean }
  }

  // Get suggested duplicate check fields based on data type
  const getSuggestedDuplicateFields = () => {
    const fields = getCurrentFields()
    const suggestions = []
    
    if (exportSettings.dataType === 'leads') {
      // For leads, prioritize email and phone
      if (fields.find(f => f.key === 'email')) suggestions.push('email')
      if (fields.find(f => f.key === 'phone')) suggestions.push('phone')
      if (fields.find(f => f.key === 'id')) suggestions.push('id')
    } else {
      // For accounts, prioritize email and account name
      if (fields.find(f => f.key === 'primary_contact_email')) suggestions.push('primary_contact_email')
      if (fields.find(f => f.key === 'account_name')) suggestions.push('account_name')
      if (fields.find(f => f.key === 'website')) suggestions.push('website')
    }
    
    return suggestions
  }

  // Proceed with import after duplicate check
  const proceedWithImport = () => {
    const transformedData = transformImportData()
    const { duplicates, clean } = checkDuplicates(transformedData)
    
    if (duplicates.length > 0) {
      setDuplicateResults({ duplicates, clean })
      setDuplicateDialog(true)
    } else {
      performImport(clean)
    }
  }

  // Perform the actual import
const performImport = async (dataToImport) => {
  try {
    setIsImporting(true);

    if (exportSettings.dataType === 'leads') {
      await api.post('/leads/bulk', dataToImport); 
    } else if (exportSettings.dataType === 'accounts') {
      await api.post('/accounts/bulk', dataToImport); 
    }

    setExportStatus({
      type: 'success',
      message: `Successfully imported ${dataToImport.length} records${duplicateResults ? `. ${duplicateResults.duplicates.length} duplicates handled.` : ''}`
    });

    // Reset & close dialogs
    setImportDialog(false);
    setDuplicateDialog(false);
    setImportFile(null);
    setImportData(null);
    setFieldMappings({});
    setDuplicateResults(null);
    setDuplicateSettings({
      action: 'skip',
      checkFields: ['email'],
      conflictResolution: {}
    });

  } catch (error) {
    console.error('Error during import:', error);
    setExportStatus({
      type: 'error',
      message: `Import failed: ${error.message}`
    });
  } finally {
    setIsImporting(false);
  }
};


  // Handle duplicate resolution
  const handleDuplicateResolution = () => {
    if (!duplicateResults) return
    
    let finalData = [...duplicateResults.clean]
    
    duplicateResults.duplicates.forEach(duplicate => {
      const resolution = duplicateSettings.conflictResolution[duplicate.newRecord._importIndex]
      
      if (duplicateSettings.action === 'skip' && !resolution) {
        return
      } else if (duplicateSettings.action === 'update' || resolution === 'update') {
        finalData.push({
          ...duplicate.newRecord,
          id: duplicate.existingRecord.id, 
          createdAt: duplicate.existingRecord.createdAt, 
          updatedAt: new Date().toISOString()
        })
      } else if (resolution === 'import') {
        finalData.push(duplicate.newRecord)
      }
    })
    
    performImport(finalData)
  }

  // Update duplicate settings
  const updateDuplicateSettings = (key, value) => {
    setDuplicateSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Handle conflict resolution for individual records
  const setConflictResolution = (importIndex, action) => {
    setDuplicateSettings(prev => ({
      ...prev,
      conflictResolution: {
        ...prev.conflictResolution,
        [importIndex]: action
      }
    }))
  }

  const downloadCSV = () => {
    try {
      setIsExporting(true)
      setExportStatus(null)

      const csvContent = generateCSV()
      const dataType = exportSettings.dataType
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `${dataType}_export_${timestamp}.csv`

      let blob
      if (exportSettings.encoding === 'utf-8-bom') {
        const BOM = '\uFEFF'
        blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
      } else {
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setExportStatus({
        type: 'success',
        message: `Successfully exported ${getCurrentData().length} ${dataType} records`
      })
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: `Export failed: ${error.message}`
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getSelectedFields = () => {
  if (exportSettings.customFields.length > 0) {
    return exportSettings.customFields
  }
  return getCurrentFields().filter(f => f.default).map(f => f.key)
}

const handleFieldSelection = (fieldKey, checked) => {
  const currentSelection = exportSettings.customFields.length > 0 
    ? exportSettings.customFields 
    : getCurrentFields().filter(f => f.default).map(f => f.key)

  setExportSettings(prev => ({
    ...prev,
    customFields: checked
      ? [...currentSelection.filter(key => key !== fieldKey), fieldKey]
      : currentSelection.filter(key => key !== fieldKey) 
  }))
}

  // Get mapping quality indicator
  const getMappingQuality = () => {
    if (!importData) return { mapped: 0, total: 0, percentage: 0, conflicts: 0 }
    
    const mapped = Object.values(fieldMappings).filter(v => v && v !== 'ignore').length
    const total = importData.headers.length
    const percentage = total > 0 ? Math.round((mapped / total) * 100) : 0
    
    // Check for conflicts (multiple CSV fields mapping to same target)
    const targetCounts = {}
    Object.values(fieldMappings).forEach(target => {
      if (target && target !== 'ignore') {
        targetCounts[target] = (targetCounts[target] || 0) + 1
      }
    })
    const conflicts = Object.values(targetCounts).filter(count => count > 1).length
    
    return { mapped, total, percentage, conflicts }
  }

  // Handle field mapping change
  const handleFieldMappingChange = (header, newTarget) => {
    setFieldMappings(prev => {
      const updated = { ...prev }
      
      if (newTarget && newTarget !== 'ignore') {
        Object.keys(updated).forEach(otherHeader => {
          if (otherHeader !== header && updated[otherHeader] === newTarget) {
            updated[otherHeader] = 'ignore'
          }
        })
      }
      
      updated[header] = newTarget
      return updated
    })
  }

  const renderPreviewTable = () => {
    const data = getCurrentData();
    if (data.length === 0) {
      return <p className="text-sm text-center text-gray-500 py-4">No data available for preview.</p>;
    }

    const fields = getCurrentFields();
    const selectedFieldKeys = getSelectedFields();
    const selectedFields = fields.filter(field => selectedFieldKeys.includes(field.key));

    if (selectedFields.length === 0) {
      return <p className="text-sm text-center text-gray-500 py-4">Select fields above to see a preview.</p>;
    }

    const previewData = data.slice(0, 5); 

    return (
      <div className="relative w-full overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {selectedFields.map(field => (
                <th key={field.key} className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {previewData.map((item, index) => (
              <tr key={index} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                {selectedFields.map(field => {
                  const value = field.key in item 
                    ? item[field.key] 
                    : (item.custom_fields && field.key in item.custom_fields ? item.custom_fields[field.key] : undefined);
                  const formattedValue = formatFieldValue(value, field.key);
                  return (
                    <td key={field.key} className="px-4 py-2 text-gray-700 dark:text-gray-400 whitespace-nowrap">
                      {formattedValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 5 && (
          <p className="p-2 text-xs text-center text-gray-500 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            ... and {data.length - 5} more rows.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Import Data Type</Label>
              <Select
                value={exportSettings.dataType}
                onValueChange={(value) => setExportSettings(prev => ({ ...prev, dataType: value }))}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Import to Leads
                    </div>
                  </SelectItem>
                  <SelectItem value="accounts">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Import to Accounts
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csvImport"
              />
              <Label htmlFor="csvImport">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Choose CSV File
                  </span>
                </Button>
              </Label>
              {importFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Mapping Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Map CSV Fields</DialogTitle>
          </DialogHeader>
          
          {importData && (
            <div className="space-y-6">
              {/* Mapping Quality Indicator */}
              <div className={`p-4 rounded-lg ${getMappingQuality().conflicts > 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getMappingQuality().conflicts > 0 ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                  <span className="font-medium">Mapping Status</span>
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    {getMappingQuality().mapped} of {getMappingQuality().total} fields mapped ({getMappingQuality().percentage}%)
                  </div>
                  {getMappingQuality().conflicts > 0 && (
                    <div className="text-red-600">
                      ⚠️ {getMappingQuality().conflicts} field conflicts detected! Each target field can only be mapped once.
                    </div>
                  )}
                </div>
              </div>

              {/* Field Mappings */}
              <div className="space-y-4">
                <h3 className="font-medium">Map CSV columns to your fields:</h3>
                <div className="grid gap-4">
                  {importData.headers.map(header => (
                    <div key={header} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{header}</div>
                        <div className="text-xs text-gray-500">
                          Sample: {importData.data[0]?.[header] || 'No data'}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <Select
                          value={fieldMappings[header] || 'ignore'}
                          onValueChange={(value) => handleFieldMappingChange(header, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">
                              <span className="text-gray-500">Ignore this field</span>
                            </SelectItem>
                            {/* Show current mapping even if it would be unavailable */}
                            {fieldMappings[header] && fieldMappings[header] !== 'ignore' && (
                              <SelectItem value={fieldMappings[header]}>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  {getCurrentFields().find(f => f.key === fieldMappings[header])?.label}
                                </div>
                              </SelectItem>
                            )}
                            {/* Show available fields */}
                            {getAvailableTargetFields(header).map(field => (
                              <SelectItem key={field.key} value={field.key}>
                                <div className="flex items-center gap-2">
                                  {field.label}
                                  {field.default && <span className="text-xs text-blue-600">(recommended)</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import Preview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportPreview(!importPreview)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {importPreview ? 'Hide' : 'Show'} Preview
                  </Button>
                  <span className="text-sm text-gray-600">
                    {importData.data.length} rows will be imported
                  </span>
                </div>

                {importPreview && (
                  <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-auto">
                    <div className="text-xs">
                      <div className="font-mono whitespace-pre-wrap">
                        {JSON.stringify(transformImportData().slice(0, 3), null, 2)}
                        {importData.data.length > 3 && '\n... (showing first 3 records)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={proceedWithImport}
              disabled={isImporting || getMappingQuality().mapped === 0 || getMappingQuality().conflicts > 0}
            >
              {isImporting ? 'Importing...' : `Import ${importData?.data.length || 0} Records`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Detection Dialog */}
      <Dialog open={duplicateDialog} onOpenChange={setDuplicateDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Duplicate Records Detected
            </DialogTitle>
          </DialogHeader>
          
          {duplicateResults && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm">
                  <strong>{duplicateResults.duplicates.length}</strong> duplicate records found,{' '}
                  <strong>{duplicateResults.clean.length}</strong> records are clean and ready to import.
                </div>
              </div>

              {/* Duplicate Handling Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Duplicate Detection Settings</h3>
                
                {/* Fields to check */}
                <div className="space-y-2">
                  <Label>Check for duplicates based on:</Label>
                  <div className="flex flex-wrap gap-3">
                    {getCurrentFields()
                      .filter(field => ['email', 'phone', 'id', 'primary_contact_email', 'account_name', 'website'].includes(field.key))
                      .map(field => (
                        <div key={field.key} className="flex items-center space-x-2">
                          <Checkbox
                            checked={duplicateSettings.checkFields.includes(field.key)}
                            onCheckedChange={(checked) => {
                              const newFields = checked
                                ? [...duplicateSettings.checkFields, field.key]
                                : duplicateSettings.checkFields.filter(f => f !== field.key)
                              updateDuplicateSettings('checkFields', newFields)
                            }}
                          />
                          <Label className="text-sm">{field.label}</Label>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Default action */}
                <div className="space-y-2">
                  <Label>Default action for duplicates:</Label>
                  <Select
                    value={duplicateSettings.action}
                    onValueChange={(value) => updateDuplicateSettings('action', value)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip duplicates</SelectItem>
                      <SelectItem value="update">Update existing records</SelectItem>
                      <SelectItem value="manual">Manual review required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duplicate Records List */}
              <div className="space-y-4">
                <h3 className="font-medium">Duplicate Records</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {duplicateResults.duplicates.map((duplicate, index) => {
                    const resolution = duplicateSettings.conflictResolution[duplicate.newRecord._importIndex]
                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-medium text-orange-600">
                            Duplicate found: {duplicate.field} = "{duplicate.duplicateValue}"
                          </div>
                          {duplicateSettings.action === 'manual' && (
                            <Select
                              value={resolution || 'skip'}
                              onValueChange={(value) => setConflictResolution(duplicate.newRecord._importIndex, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Skip</SelectItem>
                                <SelectItem value="update">Update</SelectItem>
                                <SelectItem value="import">Import anyway</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Existing Record */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Existing Record</h4>
                            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                              {getCurrentFields().slice(0, 6).map(field => (
                                <div key={field.key}>
                                  <strong>{field.label}:</strong> {duplicate.existingRecord[field.key] || 'N/A'}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* New Record */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">New Record</h4>
                            <div className="bg-blue-50 p-3 rounded text-xs space-y-1">
                              {getCurrentFields().slice(0, 6).map(field => (
                                <div key={field.key}>
                                  <strong>{field.label}:</strong> {duplicate.newRecord[field.key] || 'N/A'}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Import Summary</h4>
                <div className="text-sm space-y-1">
                  <div>{duplicateResults.clean.length} records will be imported as new</div>
                  {duplicateSettings.action === 'update' && (
                    <div>{duplicateResults.duplicates.length} existing records will be updated</div>
                  )}
                  {duplicateSettings.action === 'skip' && (
                    <div>{duplicateResults.duplicates.length} duplicate records will be skipped</div>
                  )}
                  {duplicateSettings.action === 'manual' && (
                    <div>
                      {Object.values(duplicateSettings.conflictResolution).filter(r => r === 'update').length} records will be updated,{' '}
                      {Object.values(duplicateSettings.conflictResolution).filter(r => r === 'import').length} will be imported as new,{' '}
                      {duplicateResults.duplicates.length - Object.keys(duplicateSettings.conflictResolution).length} will be skipped
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateResolution}
              disabled={isImporting}
            >
              {isImporting ? 'Processing...' : 'Proceed with Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Export Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select
                value={exportSettings.dataType}
                onValueChange={(value) => setExportSettings(prev => ({ ...prev, dataType: value, customFields: [] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Leads ({leads.length})
                    </div>
                  </SelectItem>
                  <SelectItem value="accounts">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Accounts ({accounts.length})
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>File Encoding</Label>
              <Select
                value={exportSettings.encoding}
                onValueChange={(value) => setExportSettings(prev => ({ ...prev, encoding: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utf-8">UTF-8</SelectItem>
                  <SelectItem value="utf-8-bom">UTF-8 with BOM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delimiter</Label>
              <Select
                value={exportSettings.delimiter}
                onValueChange={(value) => setExportSettings(prev => ({ ...prev, delimiter: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=";">Semicolon (;)</SelectItem>
                  <SelectItem value="\t">Tab</SelectItem>
                  <SelectItem value="|">Pipe (|)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select
                value={exportSettings.dateFormat}
                onValueChange={(value) => setExportSettings(prev => ({ ...prev, dateFormat: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iso">ISO 8601 (2024-01-15T10:30:00Z)</SelectItem>
                  <SelectItem value="us">US Format (1/15/2024)</SelectItem>
                  <SelectItem value="eu">EU Format (15/01/2024)</SelectItem>
                  <SelectItem value="timestamp">Unix Timestamp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeHeaders"
                checked={exportSettings.includeHeaders}
                onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, includeHeaders: checked }))}
              />
              <Label htmlFor="includeHeaders">Include column headers</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeEmptyFields"
                checked={exportSettings.includeEmptyFields}
                onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, includeEmptyFields: checked }))}
              />
              <Label htmlFor="includeEmptyFields">Include empty fields</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Fields to Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getCurrentFields().map(field => (
              <div key={field.key} className="flex items-center space-x-2">
<Checkbox
  id={field.key}
  checked={getSelectedFields().includes(field.key)}
  onCheckedChange={(checked) => handleFieldSelection(field.key, checked)}
/>
                <Label htmlFor={field.key} className="text-sm font-normal">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const allFields = getCurrentFields().map(f => f.key)
    setExportSettings(prev => ({ ...prev, customFields: allFields }))
  }}
>
  Select All
</Button>
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const defaultFields = getCurrentFields().filter(f => f.default).map(f => f.key)
    setExportSettings(prev => ({ ...prev, customFields: defaultFields }))
  }}
>
  Default Selection
</Button>
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setExportSettings(prev => ({ ...prev, customFields: [] }))
  }}
>
  Clear All
</Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Messages */}
      {exportStatus && (
        <Alert className={exportStatus.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>
            {exportStatus.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Export Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Ready to Export</h3>
              <p className="text-sm text-gray-600">
                {getCurrentData().length} {exportSettings.dataType} records will be exported
              </p>
            </div>
            <Button
              onClick={downloadCSV}
              disabled={isExporting || getCurrentData().length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MODIFIED: Export Preview now renders a table */}
      <Card>
        <CardHeader>
          <CardTitle>Export Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {renderPreviewTable()}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExportDataTab