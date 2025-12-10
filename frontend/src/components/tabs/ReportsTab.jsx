import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ChevronLeft, Database, Filter, Download, Plus, X, Search, BarChart3, Users, Building2, Eye, Save, Columns, ChevronDown, ChevronUp, ChevronRight, Phone } from 'lucide-react'
import { getStatusBadge } from '../ui/StatusBadge'
import SavedReportsManager from '../SavedReportsManager'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import api from '@/services/api';

const ReportsTab = () => {
  const [reportType, setReportType] = useState('leads')
  const [callType, setCallType] = useState('lead_calls')
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [filters, setFilters] = useState([])
  const [pendingFilters, setPendingFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [availableFields, setAvailableFields] = useState([])
  const [selectedFields, setSelectedFields] = useState([])
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [reportName, setReportName] = useState('')
  const [savedReports, setSavedReports] = useState([])
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [showSavedReportsManager, setShowSavedReportsManager] = useState(false)
  const [fieldsLoading, setFieldsLoading] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filter operators for different field types - now used dynamically
const operators = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'not_contains', label: 'Does not contain' }
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'equals', label: 'On Date' },
    { value: 'between', label: 'Between' },
    // Date presets
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'previous_month', label: 'Previous Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'previous_year', label: 'Previous Year' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_90_days', label: 'Last 90 Days' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' }
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not in' }
  ],
  product_date: [
    { value: 'after', label: 'After' },
    { value: 'before', label: 'Before' },
    { value: 'equals', label: 'On Date' },
    { value: 'between', label: 'Between' },
    // Date presets for product dates
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'previous_month', label: 'Previous Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'previous_year', label: 'Previous Year' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_90_days', label: 'Last 90 Days' }
  ]
}

const isDatePreset = (operator) => {
  return [
    'today', 'this_week', 'this_month', 'previous_month', 
    'this_year', 'previous_year', 'last_7_days', 'last_30_days', 'last_90_days'
  ].includes(operator);
}

  // Default selected fields - fallback if API doesn't provide preferences
  const getDefaultFields = (fields, reportType, callType = null) => {
    const defaults = {
      'leads': ['first_name', 'last_name', 'email', 'phone', 'company', 'status', 'created_at'],
      'accounts': ['account_name', 'industry', 'primary_contact_email', 'primary_contact_phone', 'employee_count', 'created_at'],
      'calls': {
        'lead_calls': ['logged_by_name', 'lead_name', 'category', 'call_outcome', 'call_date', 'call_duration', 'notes'],
        'account_calls': ['logged_by_name', 'account_name', 'category', 'call_outcome', 'call_date', 'call_duration', 'contact_person', 'notes']
      }
    };
    
    let defaultFieldNames = [];
    if (reportType === 'calls' && callType) {
      defaultFieldNames = defaults[reportType][callType] || [];
    } else {
      defaultFieldNames = defaults[reportType] || [];
    }
    
    return defaultFieldNames.filter(fieldName => 
      fields.some(field => field.name === fieldName)
    );
  };

  // Load field definitions from API or define them locally for calls
const loadFieldDefinitions = async (type, currentCallType = null) => {
    setFieldsLoading(true);
    try {
      let fields = [];
      
      if (type === 'calls') {
        // Define different fields based on call type
        if (currentCallType === 'account_calls') {
          fields = [
            { name: 'logged_by_name', label: 'Caller', type: 'text', description: 'Person who made the call' },
            { name: 'account_name', label: 'Account Name', type: 'text', description: 'Account contacted' },
            { name: 'primary_contact_name', label: 'Primary Contact', type: 'text', description: 'Primary contact of the account' },
            { name: 'company_type', label: 'Company Type', type: 'text', description: 'Type of company' },
            { name: 'industry', label: 'Industry', type: 'text', description: 'Industry sector' },
            { name: 'account_status', label: 'Account Status', type: 'select', options: ['Active', 'Inactive', 'Prospect', 'Customer'], description: 'Status of the account' },
            { name: 'category', label: 'Call Type', type: 'select', options: ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support', 'Meeting', 'Negotiation'], description: 'Type of call' },
            { name: 'call_outcome', label: 'Call Outcome', type: 'select', options: ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected', 'Meeting Scheduled'], description: 'Result of the call' },
            { name: 'call_date', label: 'Call Date', type: 'date', description: 'When the call was made' },
            { name: 'call_duration', label: 'Duration (minutes)', type: 'number', description: 'Call duration in minutes' },
            { name: 'contact_person', label: 'Contact Person', type: 'text', description: 'Person contacted at the account' },
            { name: 'notes', label: 'Notes', type: 'text', description: 'Call notes and comments' },
            { name: 'created_at', label: 'Logged At', type: 'date', description: 'When the call was logged' },
            { name: 'user_name', label: 'Logged By User', type: 'text', description: 'User who logged the call' }
          ];
        } else {
          // lead_calls fields
          fields = [
            { name: 'logged_by_name', label: 'Caller', type: 'text', description: 'Person who made the call' },
            { name: 'lead_name', label: 'Lead Name', type: 'text', description: 'Person/company called' },
            { name: 'lead_company', label: 'Lead Company', type: 'text', description: 'Company of the lead' },
            { name: 'category', label: 'Call Type', type: 'select', options: ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support'], description: 'Type of call' },
            { name: 'call_outcome', label: 'Call Outcome', type: 'select', options: ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected'], description: 'Result of the call' },
            { name: 'call_date', label: 'Call Date', type: 'date', description: 'When the call was made' },
            { name: 'call_duration', label: 'Duration (minutes)', type: 'number', description: 'Call duration in minutes' },
            { name: 'notes', label: 'Notes', type: 'text', description: 'Call notes and comments' },
            { name: 'created_at', label: 'Logged At', type: 'date', description: 'When the call was logged' },
            { name: 'user_name', label: 'Logged By User', type: 'text', description: 'User who logged the call' }
          ];
        }
      } else {
        const response = await api.get(`/field-definitions/${type}`);
        fields = response.data || [];
        
        // Add product date filter fields for accounts report
        if (type === 'accounts') {
        const productDateFields = [
          {
            name: 'product_created_date',
            label: `Product Assignment Date`,
            type: 'product_date',
            description: 'Filter by product assignment date'
          }
        ];
        fields = [...fields, ...productDateFields];
      }
      }
      
      setAvailableFields(fields);
      
      // Set default selected fields
      const defaultSelected = getDefaultFields(fields, type, currentCallType);
      if (defaultSelected.length > 0) {
        setSelectedFields(defaultSelected);
      } else {
        setSelectedFields(fields.slice(0, 7).map(f => f.name));
      }
    } catch (error) {
      console.error(`Error loading field definitions for ${type}:`, error);
      // Fallback to empty array or show error message
      setAvailableFields([]);
      setSelectedFields([]);
    }
    setFieldsLoading(false);
  };

  useEffect(() => {
    const initializeReport = async () => {
      if (reportType === 'calls') {
        await loadFieldDefinitions(reportType, callType);
      } else {
        await loadFieldDefinitions(reportType);
      }
      setFilters([]);
      setPendingFilters([]);
      fetchReportData(1, itemsPerPage, []);
      loadSavedReports();
    };
    
    initializeReport();
  }, [reportType, callType]);

    useEffect(() => {
    fetchReportData(1, itemsPerPage, filters);
  }, [filters]);

  const fetchReportData = async (page = 1, limit = itemsPerPage, appliedFilters = filters) => {
    setLoading(true);
    setCurrentPage(page);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (appliedFilters.length > 0) {
        params.append('filters', JSON.stringify(appliedFilters));
      }

      let endpoint = reportType;
      if (reportType === 'calls') {
        // Use different endpoints based on call type
        endpoint = callType === 'account_calls' ? 'account-calls/reports' : 'calls/reports';
      }

      const response = await api.get(`/${endpoint}?${params.toString()}`);
      
    let processedData = response.data.data || [];

    // Handle calls data structure
    if (reportType === 'calls') {
      if (response.calls) {
        processedData = response.calls;
        setTotalItems(response.total || processedData.length);
        setTotalPages(Math.ceil((response.total || processedData.length) / limit));
        setCurrentPage(page);
      } else if (Array.isArray(processedData)) {
        // Handle direct array response
        setTotalItems(processedData.length);
        setTotalPages(Math.ceil(processedData.length / limit));
        setCurrentPage(1);
      }
    } else if (reportType === 'accounts' && Array.isArray(processedData)) {
      processedData = processedData.map(item => {
        const totalProductsValue = item.total_products_value || 0;
        const productNames = item.product_names || '';

        return {
          ...item,
          total_products_value: totalProductsValue,
          has_product_name: productNames,
        };
      });
    }

    if (reportType !== 'calls' && response.data && response.pagination) {
      setData(processedData);
      setFilteredData(processedData);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
      setCurrentPage(response.pagination.currentPage);
    } else if (reportType !== 'calls') {
      setData(processedData);
      setFilteredData(processedData);
      setTotalItems(Array.isArray(processedData) ? processedData.length : 0);
      setTotalPages(
        Math.ceil(
          (Array.isArray(processedData) ? processedData.length : 0) / limit
        )
      );
      setCurrentPage(1);
    } else {
      // For calls
      setData(processedData);
      setFilteredData(processedData);
    }
  } catch (error) {
    console.error(`Error loading ${reportType}:`, error);
    setData([]);
    setFilteredData([]);
    setTotalItems(0);
    setTotalPages(0);
  }

  setLoading(false);
  };

const loadSavedReports = async () => {
  try {
    const response = await api.get('/saved-reports', {
      params: { type: reportType }
    })
    setSavedReports(response.data.data || [])
  } catch (error) {
    console.error('Error loading saved reports:', error)
    setSavedReports([])
  }
}

  const addFilter = () => {
    const newFilter = {
      id: Date.now(),
      field: availableFields[0]?.name || '',
      operator: 'equals',
      value: ''
    }
    setPendingFilters([...pendingFilters, newFilter])
  }

const updatePendingFilter = (filterId, key, value) => {
  setPendingFilters(pendingFilters.map(filter => {
    if (filter.id === filterId) {
      if (key === 'field') {
        const field = availableFields.find(f => f.name === value);
        const defaultOperator = field?.type === 'product_date' ? 'after' : 'equals';
        return { ...filter, [key]: value, operator: defaultOperator, value: '' };
      } else if (key === 'operator') {
        // Clear value when switching operators, especially to presets
        return { ...filter, [key]: value, value: '' };
      }
      return { ...filter, [key]: value };
    }
    return filter;
  }))
}

  const removePendingFilter = (filterId) => {
    setPendingFilters(pendingFilters.filter(filter => filter.id !== filterId))
  }

  const applyPendingFilters = () => {
    setFilters([...pendingFilters])
  }

  const clearAllFilters = () => {
    setFilters([])
    setPendingFilters([])
  }

  const deleteAppliedFilter = (filterId) => {
    const updatedFilters = filters.filter(filter => filter.id !== filterId)
    setFilters(updatedFilters)
  }

  const openFilterBuilder = () => {
    setPendingFilters([...filters])
    setShowFilterBuilder(true)
  }

  const toggleFieldSelection = (fieldName) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldName)) {
        return prev.filter(name => name !== fieldName)
      } else {
        return [...prev, fieldName]
      }
    })
  }

  const resetFieldSelection = () => {
    const defaultSelected = getDefaultFields(availableFields, reportType, reportType === 'calls' ? callType : null);
    if (defaultSelected.length > 0) {
      setSelectedFields(defaultSelected);
    } else {
      setSelectedFields(availableFields.slice(0, 7).map(f => f.name));
    }
  }

const saveReport = async () => {
  if (!reportName.trim() || pendingFilters.length === 0) {
    return
  }

  try {
    const reportData = {
      report_name: reportName.trim(),
      report_type: reportType,
      call_type: reportType === 'calls' ? callType : null, // Save call type for calls
      filters: pendingFilters,
      selected_fields: selectedFields,
      is_public: true
    }

    await api.post('/saved-reports', reportData)
    setReportName('')
    loadSavedReports()
  } catch (error) {
    console.error('Error saving report:', error)
    alert(error.response?.data?.error || 'Error saving report')
  }
}

const deleteSavedReport = async (reportId) => {
  try {
    await api.delete(`/saved-reports/${reportId}`)
    loadSavedReports()
  } catch (error) {
    console.error('Error deleting saved report:', error)
    alert(error.response?.data?.error || 'Error deleting report')
  }
}

  const loadSavedReport = (report) => {
    setReportType(report.report_type)
    if (report.call_type) {
      setCallType(report.call_type)
    }
    setPendingFilters(report.filters)
    setFilters(report.filters)
    if (report.selected_fields) {
      setSelectedFields(report.selected_fields)
    }
    setShowFilterBuilder(false)
    setShowSavedReportsManager(false)
  }

  const exportData = () => {
    const selectedFieldObjects = availableFields.filter(field => selectedFields.includes(field.name))
    const csvContent = "data:text/csv;charset=utf-8," + 
      [
        selectedFieldObjects.map(field => field.label).join(','),
        ...data.map(item => 
          selectedFieldObjects.map(field => {
            const value = getDisplayValue(item, field, true) // true for export
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
          }).join(',')
        )
      ].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${reportType}_${reportType === 'calls' ? callType : ''}_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getDisplayValue = (item, field, isExport = false) => {
    let value = item[field.name];
    
    if (value === null || value === undefined || value === '') return '-';
    
    if (field.type === 'date') {
      return new Date(value).toLocaleDateString();
    }

  if (field.name === 'purchase_date' && value) {
    return new Date(value).toLocaleDateString();
  }
    
    if (field.name === 'status' && reportType === 'leads' && !isExport) {
      return getStatusBadge(value);
    }

    // Handle call outcome badges for calls report
    if (field.name === 'call_outcome' && reportType === 'calls' && !isExport) {
      const outcomeColors = {
        'Successful': 'bg-green-100 text-green-800',
        'No Answer': 'bg-yellow-100 text-yellow-800',
        'Voicemail': 'bg-blue-100 text-blue-800',
        'Busy': 'bg-orange-100 text-orange-800',
        'Disconnected': 'bg-red-100 text-red-800',
        'Meeting Scheduled': 'bg-purple-100 text-purple-800'
      };
      const colorClass = outcomeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {value}
        </span>
      );
    }

    // Handle call category badges for calls report
    if (field.name === 'category' && reportType === 'calls' && !isExport) {
      const categoryColors = {
        'Sale': 'bg-green-100 text-green-800',
        'Follow-up': 'bg-blue-100 text-blue-800',
        'Informational': 'bg-gray-100 text-gray-800',
        'Reminder': 'bg-yellow-100 text-yellow-800',
        'Support': 'bg-purple-100 text-purple-800',
        'Meeting': 'bg-indigo-100 text-indigo-800',
        'Negotiation': 'bg-red-100 text-red-800'
      };
      const colorClass = categoryColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {value}
        </span>
      );
    }

    // Handle account status badges for account calls
    if (field.name === 'account_status' && reportType === 'calls' && callType === 'account_calls' && !isExport) {
      const statusColors = {
        'Active': 'bg-green-100 text-green-800',
        'Inactive': 'bg-gray-100 text-gray-800',
        'Prospect': 'bg-blue-100 text-blue-800',
        'Customer': 'bg-purple-100 text-purple-800'
      };
      const colorClass = statusColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {value}
        </span>
      );
    }
    
    if (field.type === 'number' && (field.name === 'annual_revenue' || field.name === 'total_products_value')) {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 0 
      }).format(value);
    }

    if (field.type === 'number') {
      return Number(value).toLocaleString();
    }
    
    return String(value);
  }

const renderFilterValue = (filter, field) => {
  if (field?.type === 'select' && field.options) {
    return (
      <select 
        value={filter.value} 
        onChange={(e) => updatePendingFilter(filter.id, 'value', e.target.value)}
        className="px-3 py-2 border rounded-md w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select value</option>
        {field.options.map(option => (
          <option key={option} value={option}>
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
    )
  }

  if (isDatePreset(filter.operator)) {
    return (
      <div className="px-3 py-2 text-gray-500 italic text-sm">
        No additional input needed
      </div>
    )
  }

  // Handle "between" operator for dates and numbers
  if (filter.operator === 'between') {
    const values = filter.value ? filter.value.split(',') : ['', '']
    const value1 = values[0] || ''
    const value2 = values[1] || ''

    return (
      <div className="flex items-center space-x-2">
        <input
          type={
            field?.type === 'date' || field?.type === 'product_date'
              ? 'date'
              : field?.type === 'number'
              ? 'number'
              : 'text'
          }
          value={value1}
          onChange={(e) => {
            const newValue = `${e.target.value},${value2}`
            updatePendingFilter(filter.id, 'value', newValue)
          }}
          placeholder="From"
          className="px-3 py-2 border rounded-md w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-sm">to</span>
        <input
          type={
            field?.type === 'date' || field?.type === 'product_date'
              ? 'date'
              : field?.type === 'number'
              ? 'number'
              : 'text'
          }
          value={value2}
          onChange={(e) => {
            const newValue = `${value1},${e.target.value}`
            updatePendingFilter(filter.id, 'value', newValue)
          }}
          placeholder="To"
          className="px-3 py-2 border rounded-md w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    )
  }

  // Handle "in" and "not_in" operators
  if (filter.operator === 'in' || filter.operator === 'not_in') {
    return (
      <input
        type="text"
        value={filter.value}
        onChange={(e) => updatePendingFilter(filter.id, 'value', e.target.value)}
        placeholder="Enter values separated by commas"
        className="px-3 py-2 border rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    )
  }

  // Regular single input
  return (
    <input
      type={
        field?.type === 'date' || field?.type === 'product_date'
          ? 'date'
          : field?.type === 'number'
          ? 'number'
          : 'text'
      }
      value={filter.value}
      onChange={(e) => updatePendingFilter(filter.id, 'value', e.target.value)}
      placeholder="Enter value"
      className="px-3 py-2 border rounded-md w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

  const toggleRowExpansion = (itemId) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedRows(newExpanded)
  }

  const getSelectedFieldObjects = () => {
    return availableFields.filter(field => selectedFields.includes(field.name))
  }

    // Handle page changes
  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) {
      fetchReportData(page, itemsPerPage, filters);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit);
    fetchReportData(1, newLimit, filters); // Go back to page 1
  };
  
    // Handle previous/next page
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // Generate page numbers for pagination controls
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    if (totalPages <= 1) return [1];

    for (let i = Math.max(2, currentPage - delta);
         i <= Math.min(totalPages - 1, currentPage + delta);
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };

  // Get the appropriate icon for the report type
  const getReportIcon = () => {
    switch (reportType) {
      case 'leads': return <Users className="h-5 w-5 text-gray-900 dark:text-gray-100" />;
      case 'accounts': return <Building2 className="h-5 w-5 text-gray-900 dark:text-gray-100" />;
      case 'calls': return <Phone className="h-5 w-5 text-gray-900 dark:text-gray-100" />;
      default: return <BarChart3 className="h-5 w-5 text-gray-900 dark:text-gray-100" />;
    }
  };

  // Get the report type display name
  const getReportTypeDisplayName = () => {
    switch (reportType) {
      case 'leads': return 'Leads Report';
      case 'accounts': return 'Accounts Report';
      case 'calls': return 'Call Reports';
      default: return 'Report';
    }
  };

  // Show loading spinner while fields are being loaded
  if (fieldsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading field definitions...</span>
      </div>
    );
  }

return (
    <div className="space-y-6">
      {showSavedReportsManager && (
  <Card className="border-blue-200">
    <CardContent className="p-6">
      <SavedReportsManager
        
        reportType={reportType}
        currentFilters={pendingFilters.length > 0 ? pendingFilters : filters}
        currentSelectedFields={selectedFields}
        onLoadReport={loadSavedReport}
        onClose={() => setShowSavedReportsManager(false)}
      />
    </CardContent>
  </Card>
)}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
    Reports & Analytics
  </h2>
  <div className="flex items-center space-x-2">
    {getReportIcon()}
    <select
      value={reportType}
      onChange={(e) => setReportType(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900
      focus:outline-none focus:ring-2 focus:ring-blue-500
      dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400"
    >
      <option value="leads">Leads Report</option>
      <option value="accounts">Accounts Report</option>
      <option value="calls">Call Reports</option>
    </select>
  </div>
</div>

        
        <div className="flex flex-wrap gap-2">
          <Button 
  variant="outline" 
  onClick={() => setShowSavedReportsManager(!showSavedReportsManager)}
  size="sm"
>
  <Database className="h-4 w-4 mr-2" />
  Saved Reports
</Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFieldSelector(!showFieldSelector)}
            size="sm"
          >
            <Columns className="h-4 w-4 mr-2" />
            Fields ({selectedFields.length})
          </Button>
          <Button 
            variant="outline" 
            onClick={openFilterBuilder}
            size="sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters {filters.length > 0 && `(${filters.length})`}
          </Button>
          <Button 
            variant="outline" 
            onClick={exportData}
            disabled={filteredData.length === 0}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Field Selector */}
{showFieldSelector && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <span>Select Fields to Display</span>
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={resetFieldSelection}>
            Reset to Default
          </Button>
          <Button size="sm" onClick={() => setShowFieldSelector(false)}>
            Done
          </Button>
        </div>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {availableFields
          .filter(field => 
            field.name !== 'product_created_date'
          )
          .map(field => (
            <label
              key={field.name}
              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedFields.includes(field.name)}
                onChange={() => toggleFieldSelection(field.name)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm">
                {field.label}
              </span>
            </label>
          ))}
      </div>
      <div className="mt-4 text-sm text-gray-600">
        Selected {selectedFields.length} of {availableFields.filter(f => f.name !== 'product_created_date').length} fields
      </div>
    </CardContent>
  </Card>
)}

{/* Saved Reports - Quick Access */}
{savedReports.length > 0 && !showSavedReportsManager && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <div className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Quick Access - Recent Saved Reports
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowSavedReportsManager(true)}
        >
          View All ({savedReports.length})
        </Button>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {savedReports.slice(0, 6).map(report => (
          <div key={report.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadSavedReport(report)}
              className="flex items-center space-x-2 flex-1 justify-start"
            >
              <Eye className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium truncate">{report.report_name}</div>
                <div className="text-xs text-gray-500">
                  {report.report_type} • by {report.created_by_name}
                </div>
              </div>
            </Button>
            {report.can_edit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteSavedReport(report.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}

      {/* Applied Filters Display */}
      {filters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Applied Filters</span>
              <Button size="sm" variant="outline" onClick={clearAllFilters}>
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => {
                const field = availableFields.find(f => f.name === filter.field)
                return (
                  <div key={filter.id} className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">
                      {field?.label} {filter.operator} "{filter.value}"
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteAppliedFilter(filter.id)}
                      className="h-5 w-5 p-0 text-blue-700 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Builder */}
      {showFilterBuilder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>Filter Builder</span>
              <div className="flex space-x-2">
                <Button size="sm" onClick={addFilter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowFilterBuilder(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingFilters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No filters added yet. Click "Add Filter" to get started.</p>
              </div>
            ) : (
              <>
                {pendingFilters.map(filter => {
                  const field = availableFields.find(f => f.name === filter.field)
                  const availableOperators = operators[field?.type] || operators.text

                  return (
                    <div key={filter.id} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 p-3 border rounded-lg bg-gray-50">
                      <select 
                        value={filter.field} 
                        onChange={(e) => updatePendingFilter(filter.id, 'field', e.target.value)}
                        className="px-3 py-2 border rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                       {availableFields.map(field => (
                          <option key={field.name} value={field.name}>
                            {field.label}
                            {field.type === 'product_date' && ' ⚡'}
                          </option>
                        ))}
                      </select>

                      <select 
                        value={filter.operator} 
                        onChange={(e) => updatePendingFilter(filter.id, 'operator', e.target.value)}
                        className="px-3 py-2 border rounded-md w-full sm:w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableOperators.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {renderFilterValue(filter, field)}

                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => removePendingFilter(filter.id)}
                        className="w-full sm:w-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}

              {/* Product Date Filter Notice */}
                {pendingFilters.some(filter => 
filter.field === 'product_created_date'
                ) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-blue-800">
                      <span className="font-medium">⚡ Product Date Filter Active</span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      This filter will affect the calculation of total product values and product counts. 
                      Only products assigned within the specified date range will be included in the totals.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t space-y-4 sm:space-y-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                      type="text"
                      placeholder="Report name (optional)"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      className="px-3 py-2 border rounded-md w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button 
                      onClick={saveReport}
                      disabled={!reportName.trim() || pendingFilters.length === 0}
                      size="sm"
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save Report
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={applyPendingFilters}
                    disabled={pendingFilters.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    Apply Filters ({pendingFilters.length})
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <span>{getReportTypeDisplayName()} Results</span>
              <span className="px-2 py-1 text-sm bg-gray-100 rounded dark:text-gray-100 dark:bg-background">
                {totalItems} records
              </span>
            </div>
            {/* Radio button for call type */}
            {reportType === 'calls' && (
              <div className="flex items-center space-x-4 text-sm font-normal text-gray-700 dark:text-gray-300">
                <label className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="callType"
                    value="lead_calls"
                    checked={callType === 'lead_calls'}
                    onChange={(e) => setCallType(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span>Lead Calls</span>
                </label>
                <label className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="callType"
                    value="account_calls"
                    checked={callType === 'account_calls'}
                    onChange={(e) => setCallType(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span>Account Calls</span>
                </label>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {filters.length > 0 ? 'Filtered results based on your criteria' : 'All records'}
            {filters.some(filter => 
  filter.field === 'product_created_date'
            ) && (
              <span className="block mt-1 text-blue-600 font-medium">
                ⚡ Product totals calculated from filtered date range
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pagination Info and Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  `Showing ${totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} records`
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Per page:</label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange} disabled={loading}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1 || loading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((pageNum, index) => (
                  <Button
                    key={index}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                    disabled={pageNum === '...' || loading}
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages || loading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {loading && data.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading {getReportTypeDisplayName().toLowerCase()}...</span>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-transparent ">
                      {getSelectedFieldObjects().map(field => (
                        <th key={field.name} className="text-left p-3 font-medium text-gray-900 dark:text-neutral-100">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={getSelectedFieldObjects().length} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-2">
                            <Search className="h-8 w-8 text-gray-400" />
                            <span className="text-gray-500">No records found matching your criteria</span>
                            {filters.length > 0 && (
                                <Button variant="outline" onClick={clearAllFilters} size="sm">
                                  Clear Filters
                                </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => (
                        <tr key={item.id || index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                          {getSelectedFieldObjects().map(field => (
                            <td key={field.name} className="p-3">
                              {getDisplayValue(item, field)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                {data.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                            <Search className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                            <span className="text-gray-500 dark:text-gray-400">
                                No records found matching your criteria
                            </span>
                             {filters.length > 0 && (
                                <Button variant="outline" onClick={clearAllFilters} size="sm" className="dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800">
                                Clear Filters
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                  data.map((item, index) => {
                    const isExpanded = expandedRows.has(item.id || index)
                    const selectedFieldObjects = getSelectedFieldObjects()
                    const primaryFields = selectedFieldObjects.slice(0, 3)
                    const secondaryFields = selectedFieldObjects.slice(3)

                    return (
                      <Card
                        key={item.id || index}
                        className="border border-gray-200 dark:border-gray-700"
                      >
          <CardContent className="p-4">
            {/* Primary Fields */}
            <div className="space-y-2">
              {primaryFields.map(field => (
                <div
                  key={field.name}
                  className="flex justify-between items-start"
                >
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-1/3">
                    {field.label}:
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 w-2/3 text-right">
                    {getDisplayValue(item, field)}
                  </span>
                </div>
              ))}
            </div>

            {/* Secondary Fields */}
            {secondaryFields.length > 0 && (
              <>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {secondaryFields.map(field => (
                      <div
                        key={field.name}
                        className="flex justify-between items-start"
                      >
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-1/3">
                          {field.label}:
                        </span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 w-2/3 text-right">
                          {getDisplayValue(item, field)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleRowExpansion(item.id || index)
                    }
                    className="w-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show More ({secondaryFields.length} more fields)
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Special handling for call reports - show call notes prominently */}
            {reportType === 'calls' && item.notes && item.notes.trim() && isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Call Notes
                </h4>
                <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border-l-4 border-blue-500">
                  {item.notes}
                </div>
              </div>
            )}

            {/* Accounts → Assigned Products */}
            {reportType === 'accounts' &&
              item.assigned_products &&
              item.assigned_products.length > 0 &&
              isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Assigned Products ({item.assigned_products.length})
                  </h4>
                  <div className="space-y-2">
                    {item.assigned_products.slice(0, 3).map((product, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {product.product_name}
                        </div>
                        <div className="text-gray-600 dark:text-gray-300">
                          Qty: {product.quantity} | Price: ${product.unit_price}
                        </div>
                      </div>
                    ))}
                    {item.assigned_products.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        ... and {item.assigned_products.length - 3} more products
                      </div>
                    )}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )
    })
  )}
</div>

            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
  
}

export default ReportsTab