import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2, Plus, Settings, Layout, BarChart3, PieChart, LineChart,
  Table, List, Database, Edit2, Trash2, Eye, Copy, Grid3x3,
  Save, X, ChevronLeft, RefreshCw, MoreVertical, Download,
  AlertTriangle, Move, Type
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import api from '@/services/api';

// Import chart components
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { PieChart as RechartsPieChart, Cell, Pie } from 'recharts';
import { LineChart as RechartsLineChart, Line } from 'recharts';

// Import react-grid-layout
import { Responsive, WidthProvider } from 'react-grid-layout';

// Import the widget editor
import DashboardWidgetEditor from '../DashboardWidgetEditor';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardTab = () => {
  const [dashboards, setDashboards] = useState([]);
  const [currentDashboard, setCurrentDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [showEditDashboardModal, setShowEditDashboardModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [widgetData, setWidgetData] = useState({});
  const [widgetLoading, setWidgetLoading] = useState({});
  const [widgetErrors, setWidgetErrors] = useState({});

  // State for react-grid-layout
  const [layout, setLayout] = useState([]);

  const [newDashboardForm, setNewDashboardForm] = useState({
    dashboard_name: '',
    description: '',
    is_public: true,
    grid_columns: 12
  });

  const [editDashboardForm, setEditDashboardForm] = useState({
    id: null,
    dashboard_name: '',
    description: '',
    is_public: true,
    grid_columns: 12
  });

  const [newWidgetForm, setNewWidgetForm] = useState({
    saved_report_id: '',
    widget_title: '',
    widget_type: 'table',
    width: 6,
    height: 4
  });

  const [view, setView] = useState('list'); // 'list' or 'dashboard'
  const intervalRefs = useRef({});

  // Widget types configuration
  const widgetTypes = [
    { value: 'table', label: 'Data Table', icon: Table },
    { value: 'bar_chart', label: 'Bar Chart', icon: BarChart3 },
    { value: 'line_chart', label: 'Line Chart', icon: LineChart },
    { value: 'pie_chart', label: 'Pie Chart', icon: PieChart },
    { value: 'metric_card', label: 'Metric Card', icon: Database },
    { value: 'list', label: 'Simple List', icon: List },
    { value: 'text_field', label: 'Text Display', icon: Type }
  ];

  // Chart colors
  const chartColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const cleanupIntervals = () => {
    Object.values(intervalRefs.current).forEach(intervalId => {
      if (intervalId) clearInterval(intervalId);
    });
    intervalRefs.current = {};
  };

  useEffect(() => {
    loadDashboards();
    loadSavedReports();
    return cleanupIntervals; // Cleanup intervals on component unmount
  }, []);

  // Setup auto-refresh intervals when dashboard loads
  useEffect(() => {
    cleanupIntervals(); // Clear old intervals before setting new ones
    if (currentDashboard && currentDashboard.widgets) {
      currentDashboard.widgets.forEach(widget => {
        const displayOptions = widget.display_options || {};
        if (displayOptions.autoRefresh && displayOptions.refreshInterval) {
          setupWidgetAutoRefresh(widget);
        }
      });
    }
  }, [currentDashboard]);

  useEffect(() => {
    if (currentDashboard && currentDashboard.widgets) {
      const newLayout = currentDashboard.widgets.map(w => ({
        i: w.id.toString(),
        x: w.position_x || 0,
        y: w.position_y || 0,
        w: w.width || 6,
        h: w.height || 4,
        minW: 2,
        minH: 3,
      }));
      setLayout(newLayout);
    }
  }, [currentDashboard?.widgets]);

 const handleLayoutChange = (newLayout) => {
    if (!editMode) return;

    // Update the layout state for immediate visual feedback
    setLayout(newLayout);

    // Find changed widgets and send updates to the backend
    newLayout.forEach(layoutItem => {
      const widget = currentDashboard.widgets.find(w => w.id.toString() === layoutItem.i);
      if (widget) {
        const hasChanged =
          widget.position_x !== layoutItem.x ||
          widget.position_y !== layoutItem.y ||
          widget.width !== layoutItem.w ||
          widget.height !== layoutItem.h;

        if (hasChanged) {
          const updatedFields = {
            position_x: layoutItem.x,
            position_y: layoutItem.y,
            width: layoutItem.w,
            height: layoutItem.h,
          };

          api.put(`/dashboards/${currentDashboard.id}/widgets/${widget.id}`, updatedFields)
             .then(() => {
                setCurrentDashboard(prev => ({
                  ...prev,
                  widgets: prev.widgets.map(w =>
                    w.id.toString() === layoutItem.i ? { ...w, ...updatedFields } : w
                  )
                }));
             })
             .catch(err => {
                console.error("Failed to save layout change for widget:", widget.id, err);
             });
        }
      }
    });
  };

  const setupWidgetAutoRefresh = (widget) => {
    const displayOptions = widget.display_options || {};
    const intervalMs = (displayOptions.refreshInterval || 300) * 1000;

    if (intervalRefs.current[widget.id]) {
      clearInterval(intervalRefs.current[widget.id]);
    }

    intervalRefs.current[widget.id] = setInterval(() => {
      loadWidgetData(widget, true);
    }, intervalMs);
  };

  const loadDashboards = async () => {
    try {
      const response = await api.get('/dashboards');
      setDashboards(response.data || []);
    } catch (error) {
      console.error('Error loading dashboards:', error);
      setDashboards([]);
    }
  };

  const loadSavedReports = async () => {
    try {
      const response = await api.get('/saved-reports');
      setSavedReports(response.data || []);
    } catch (error) {
      console.error('Error loading saved reports:', error);
      setSavedReports([]);
    }
  };

  const loadDashboard = async (dashboardId) => {
    setLoading(true);
    setView('dashboard');
    try {
      const response = await api.get(`/dashboards/${dashboardId}`);
      setCurrentDashboard(response.data);
      setWidgetData({});
      setWidgetLoading({});
      setWidgetErrors({});

      // Load data for all widgets
      if (response.data.widgets) {
        response.data.widgets.forEach(widget => loadWidgetData(widget));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setCurrentDashboard(null);
    }
    setLoading(false);
  };

  const loadWidgetData = async (widget, silent = false) => {
    const widgetId = widget.id;

    if (!silent) {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: true }));
    }
    setWidgetErrors(prev => ({ ...prev, [widgetId]: null }));

    try {
      const params = new URLSearchParams({});

      if (widget.filters && widget.filters.length > 0) {
        params.append('filters', JSON.stringify(widget.filters));
      }

      const data = await api.get(`/${widget.report_type}?${params.toString()}`);
      const response = data.data
      let extractedData = [];
      if (response && Array.isArray(response[widget.report_type])) {
        extractedData = response[widget.report_type];
      } else if (response && Array.isArray(response.data)) {
        extractedData = response.data;
      } else if (Array.isArray(response)) {
        extractedData = response;
      }
      
      setWidgetData(prev => ({
        ...prev,
        [widgetId]: extractedData
      }));

    } catch (error) {
      console.error(`Error loading data for widget ${widgetId}:`, error);
      setWidgetErrors(prev => ({
        ...prev,
        [widgetId]: error.response?.error || 'Failed to load widget data'
      }));
      setWidgetData(prev => ({
        ...prev,
        [widgetId]: []
      }));
    } finally {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: false }));
    }
  };

  const refreshAllWidgets = async () => {
    if (currentDashboard && currentDashboard.widgets) {
      currentDashboard.widgets.forEach(widget => loadWidgetData(widget));
    }
  };

const renderTextField = (widget, data) => {
  const { display_options = {} } = widget;
  const { textField, fontSize = 'large', textColor = '#1f2937', textAlign = 'center', showLabel = true } = display_options;

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <span className="text-gray-400 text-lg">No data available</span>
      </div>
    );
  }

  if (!textField) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-center">
        <span className="text-sm text-gray-500">Please configure the text field in widget settings</span>
      </div>
    );
  }

  const value = data[0][textField];
  const displayValue = value !== null && value !== undefined ? String(value) : 'N/A';

  const fontSizeClasses = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-4xl',
    xlarge: 'text-6xl'
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  const formatFieldName = (field) => {
    if (typeof field !== 'string') return '';
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`flex flex-col items-center justify-center h-full p-4 ${alignClasses[textAlign]}`}>
      <div
        className={`font-bold ${fontSizeClasses[fontSize]} break-words max-w-full`}
        style={{ color: textColor }}
        title={displayValue.length > 50 ? displayValue : undefined}
      >
        {displayValue.length > 100 ? displayValue.substring(0, 100) + '...' : displayValue}
      </div>
      {showLabel && (
        <div className="text-sm text-gray-500 mt-2 capitalize">
          {formatFieldName(textField)}
        </div>
      )}
    </div>
  );
};

const createDashboard = async () => {
  try {
    const response = await api.post('/dashboards', newDashboardForm);

    setShowNewDashboardModal(false);
    setNewDashboardForm({
      dashboard_name: '',
      description: '',
      is_public: true,
      grid_columns: 12
    });
    await loadDashboards();

    const newId = response.data?.id || response.data?.dashboard?.id;
    if (newId) {
      await loadDashboard(newId);
    } else {
      console.warn('No dashboard ID returned from createDashboard API.');
    }
  } catch (error) {
    console.error('Error creating dashboard:', error);
    alert(error.response?.data?.error || 'Error creating dashboard');
  }
};

  const openEditDashboardModal = () => {
    if (!currentDashboard) return;
    setEditDashboardForm({
      id: currentDashboard.id,
      dashboard_name: currentDashboard.dashboard_name,
      description: currentDashboard.description || '',
      is_public: currentDashboard.is_public,
      grid_columns: currentDashboard.grid_columns || 12,
    });
    setShowEditDashboardModal(true);
  };

  const updateDashboard = async () => {
    try {
      await api.put(`/dashboards/${editDashboardForm.id}`, editDashboardForm);
      setShowEditDashboardModal(false);
      setCurrentDashboard(prev => ({ ...prev, ...editDashboardForm }));
      await loadDashboards();
    } catch (error) {
      console.error('Error updating dashboard:', error);
      alert(error.response?.data?.error || 'Error updating dashboard');
    }
  };

  const deleteDashboard = async (dashboardId) => {
    if (!confirm('Are you sure you want to delete this dashboard and all its widgets?')) return;
    try {
      await api.delete(`/dashboards/${dashboardId}`);
      await loadDashboards();
      if (currentDashboard?.id === dashboardId) {
        setCurrentDashboard(null);
        setView('list');
      }
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      alert(error.response?.data?.error || 'Error deleting dashboard');
    }
  };

  const addWidget = async () => {
    try {
      await api.post(`/dashboards/${currentDashboard.id}/widgets`, newWidgetForm);
      setShowAddWidgetModal(false);
      setNewWidgetForm({ saved_report_id: '', widget_title: '', widget_type: 'table', width: 6, height: 4 });
      await loadDashboard(currentDashboard.id);
    } catch (error) {
      console.error('Error adding widget:', error);
      alert(error.response?.data?.error || 'Error adding widget');
    }
  };

  const updateWidget = async (updatedWidgetData) => {
    if (!editingWidget) return;
    try {
      await api.put(`/dashboards/${currentDashboard.id}/widgets/${editingWidget.id}`, updatedWidgetData);
      setEditingWidget(null);
      await loadDashboard(currentDashboard.id);
    } catch (error) {
      console.error('Error updating widget:', error);
      alert(error.response?.data?.error || 'Error updating widget');
    }
  };

  const deleteWidget = async (widgetId) => {
    if (!confirm('Are you sure you want to remove this widget from the dashboard?')) return;
    try {
      if (intervalRefs.current[widgetId]) {
        clearInterval(intervalRefs.current[widgetId]);
        delete intervalRefs.current[widgetId];
      }
      await api.delete(`/dashboards/${currentDashboard.id}/widgets/${widgetId}`);
      await loadDashboard(currentDashboard.id);
    } catch (error) {
      console.error('Error deleting widget:', error);
      alert(error.response?.data?.error || 'Error deleting widget');
    }
  };

  const duplicateWidget = async (widget) => {
    const duplicatedWidget = {
      saved_report_id: widget.saved_report_id,
      widget_title: `${widget.widget_title} (Copy)`,
      widget_type: widget.widget_type,
      position_x: widget.position_x, // Keep position simple for now
      position_y: widget.position_y,
      width: widget.width,
      height: widget.height,
      chart_config: widget.chart_config || {},
      display_options: widget.display_options || {}
    };

    try {
      await api.post(`/dashboards/${currentDashboard.id}/widgets`, duplicatedWidget);
      await loadDashboard(currentDashboard.id);
    } catch (error) {
      console.error('Error duplicating widget:', error);
      alert(error.response?.data?.error || 'Error duplicating widget');
    }
  };

  const exportDashboard = () => {
    const dashboardData = {
      dashboard: {
        dashboard_name: currentDashboard.dashboard_name,
        description: currentDashboard.description,
        is_public: currentDashboard.is_public,
        grid_columns: currentDashboard.grid_columns,
        widgets: currentDashboard.widgets,
      },
      export_details: {
        export_date: new Date().toISOString(),
        version: "1.0"
      },
      widget_data_snapshot: widgetData
    };

    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${currentDashboard.dashboard_name.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderWidgetContent = (widget) => {
    const data = widgetData[widget.id] || [];
    const isLoading = widgetLoading[widget.id];
    const error = widgetErrors[widget.id];

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[150px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center p-4">
          <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm font-medium text-red-600">Error</p>
          <p className="text-xs text-gray-600 mb-3">{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadWidgetData(widget)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      );
    }

    // Pass widget config to specific render functions
    switch (widget.widget_type) {
      case 'metric_card': return renderMetricCard(widget, data);
      case 'bar_chart': return renderBarChart(widget, data);
      case 'line_chart': return renderLineChart(widget, data);
      case 'pie_chart': return renderPieChart(widget, data);
      case 'list': return renderList(widget, data);
      case 'text_field': return renderTextField(widget, data);
      default: return renderTable(widget, data);
    }
  };

  const renderMetricCard = (widget, data) => {
    const { display_options = {} } = widget;
    const { metricType = 'count', metricField, showIcon = true } = display_options;

    // Handle "Count Records" first, as it has no dependencies on metricField.
    if (metricType === 'count') {
      const value = Array.isArray(data) ? data.length : 0;
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          {showIcon && <Database className="h-8 w-8 text-blue-500 mb-2" />}
          <div className="text-3xl font-bold text-gray-800">
            {value.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1 text-center">Total Records</div>
        </div>
      );
    }

    // For all other metric types, we require a field and valid data.
    if (!metricField) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="text-sm text-gray-600">Please select a field in the widget settings to perform this calculation.</p>
        </div>
      );
    }
    
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
              {showIcon && <Database className="h-8 w-8 text-blue-500 mb-2" />}
              <div className="text-3xl font-bold text-gray-800">0</div>
              <div className="text-sm text-gray-500 mt-1 text-center capitalize">{metricType} of {metricField}</div>
            </div>
          );
    }

    // Perform the calculation
    const numericData = data.map(item => parseFloat(item[metricField])).filter(n => !isNaN(n));
    let value = 0;
    let label = `${metricType} of ${metricField}`;

    if (numericData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
              <p className="text-sm text-gray-600">The selected field '{metricField}' does not contain numeric data for calculation.</p>
            </div>
        );
    }

    switch (metricType) {
        case 'sum': 
            value = numericData.reduce((a, b) => a + b, 0);
            break;
        case 'average': 
            value = numericData.reduce((a, b) => a + b, 0) / numericData.length;
            break;
        case 'min': 
            value = Math.min(...numericData);
            break;
        case 'max': 
            value = Math.max(...numericData);
            break;
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        {showIcon && <Database className="h-8 w-8 text-blue-500 mb-2" />}
        <div className="text-3xl font-bold text-gray-800">
          {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-gray-500 mt-1 text-center capitalize">{label}</div>
      </div>
    );
  };

// Helper functions
const hasDuplicateXValues = (data, xField) => {
  const xValues = data.map(item => item[xField]);
  return new Set(xValues).size < xValues.length;
};

const isNumeric = (str) => {
  if (str === null || str === undefined || str === '') return false;
  return !isNaN(str) && !isNaN(parseFloat(str));
};

const isDateLike = (str) => {
  if (!str || typeof str !== 'string') return false;
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{1,2}\/\d{1,2}\/\d{4}/,
    /^\d{4}\/\d{1,2}\/\d{1,2}/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  ];
  return datePatterns.some(pattern => pattern.test(str));
};

const formatValue = (value) => {
  if (value === null || value === undefined) return 'N/A';

  // Check if it's a date
  if (isDateLike(String(value))) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Format based on the precision of the date
      const str = String(value);
      if (str.includes('T') || str.includes(' ')) {
        // Has time component
        return date.toLocaleString();
      } else {
        // Date only
        return date.toLocaleDateString();
      }
    }
  }
  if (isNumeric(value)) {
    const num = parseFloat(value);
    // Format numbers appropriately
    if (num > 999999) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num > 999) {
      return (num / 1000).toFixed(1) + 'K';
    } else if (num % 1 !== 0) {
      return num.toFixed(2);
    }
    return num.toLocaleString();
  }

  return String(value);
};

const processValue = (value) => {
  if (value === null || value === undefined) return 0;

  // For dates, return timestamp for sorting/aggregation, but we'll format for display
  if (isDateLike(String(value))) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  // For numbers
  if (isNumeric(value)) {
    return parseFloat(value);
  }

  // For strings, return length or 1 for counting
  return typeof value === 'string' ? value.length : 1;
};

const getFieldType = (data, field) => {
  if (!data.length || !field) return 'string';

  const sample = data.slice(0, 10).map(item => item[field]).filter(val => val !== null && val !== undefined);
  if (!sample.length) return 'string';

  const dateCount = sample.filter(val => isDateLike(String(val))).length;
  const numericCount = sample.filter(val => isNumeric(val)).length;

  if (dateCount > sample.length * 0.7) return 'date';
  if (numericCount > sample.length * 0.7) return 'number';
  return 'string';
};

const renderBarChart = (widget, data) => {
  const { chart_config = {} } = widget;
  const { xAxisField, yAxisField, yAxisLabelMode = 'value' } = chart_config;

  if (!data.length) return <div className="text-center p-4">No data to display.</div>;
  if (!xAxisField) {
    return <div className="text-center p-4 text-sm text-gray-500">Please configure the X-axis field in the widget settings.</div>;
  }

  const yFieldType = yAxisField ? getFieldType(data, yAxisField) : 'count';

  const aggregated = data.reduce((acc, item) => {
    const key = String(item[xAxisField] || 'Unknown');

    if (!acc[key]) {
      acc[key] = { name: key, value: 0, count: 0, yValues: new Set() };
    }

    const yValue = yAxisField ? item[yAxisField] : null;

    if (yAxisField) {
      if (yFieldType === 'number') {
        acc[key].value += parseFloat(yValue) || 0;
      } else {
        acc[key].value += 1;
      }
      if (yValue !== null && yValue !== undefined) {
          acc[key].yValues.add(yValue);
      }
    } else {
      acc[key].value += 1; // count records
    }

    acc[key].count += 1;
    return acc;
  }, {});

  let chartData = Object.values(aggregated)
    .map(item => {
      const isSingleValue = item.yValues.size === 1;
      return {
        name: item.name,
        value: item.value,
        displayValue: formatValue(item.value),
        yAxisValueLabel: isSingleValue ? [...item.yValues][0] : null
      };
    })
    .slice(0, 25);

  const firstXValue = chartData[0]?.name;
  if (firstXValue && (isNumeric(firstXValue) || isDateLike(firstXValue))) {
    chartData.sort((a, b) => {
      const aVal = isNumeric(a.name) ? parseFloat(a.name) : new Date(a.name).getTime();
      const bVal = isNumeric(b.name) ? parseFloat(b.name) : new Date(b.name).getTime();
      return aVal - bVal;
    });
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        {chart_config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          interval={0}
          angle={chartData.length > 10 ? -45 : 0}
          textAnchor={chartData.length > 10 ? 'end' : 'middle'}
          height={chartData.length > 10 ? 60 : 30}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => formatValue(value)}
        />
        {chart_config.showTooltip !== false && (
          <RechartsTooltip
            formatter={(value, name, props) => {
                const payload = props.payload;
                let seriesName;

                if (yAxisLabelMode === 'value' && payload.yAxisValueLabel) {
                    seriesName = payload.yAxisValueLabel;
                } else if (!yAxisField) {
                    seriesName = 'Record Count';
                } else if (yFieldType === 'number') {
                    seriesName = `Sum of ${yAxisField}`;
                } else {
                    seriesName = `Count of ${yAxisField}`;
                }
                return [payload.displayValue, seriesName];
            }}
            labelFormatter={(label) => `${xAxisField}: ${label}`}
          />
        )}
        {chart_config.showLegend !== false && <Legend wrapperStyle={{fontSize: "12px"}}/>}
        <Bar dataKey="value" name={yAxisField} fill={chart_config.primaryColor || chartColors[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const renderLineChart = (widget, data) => {
  const { chart_config = {} } = widget;
  const { xAxisField, yAxisField, yAxisLabelMode = 'value' } = chart_config;

  if (!data.length) return <div className="text-center p-4">No data to display.</div>;
  if (!xAxisField) {
    return <div className="text-center p-4 text-sm text-gray-500">Please configure the X-axis field in the widget settings.</div>;
  }

  const xFieldType = getFieldType(data, xAxisField);
  const yFieldType = yAxisField ? getFieldType(data, yAxisField) : 'count';

  const aggregated = data.reduce((acc, item) => {
    const xValue = item[xAxisField];
    if (xValue === null || xValue === undefined) return acc;

    let key;
    let dateObj = null;

    if (xFieldType === 'date') {
        dateObj = new Date(xValue);
        if(isNaN(dateObj.getTime())) return acc;
        key = dateObj.toLocaleDateString();
    } else {
        key = String(xValue);
    }

    if (!acc[key]) {
      acc[key] = { name: key, value: 0, count: 0, date: dateObj, yValues: new Set() };
    }

    const yValue = yAxisField ? item[yAxisField] : null;

    if (yAxisField) {
        if (yFieldType === 'number') {
            acc[key].value += parseFloat(yValue) || 0;
        } else {
            acc[key].value += 1; // For non-numeric, we count
        }
        if (yValue !== null && yValue !== undefined) {
            acc[key].yValues.add(yValue);
        }
    } else {
        acc[key].value += 1; // count records
    }
    acc[key].count += 1;
    return acc;
  }, {});

  let chartData = Object.values(aggregated)
      .map(item => {
        const isSingleValue = item.yValues.size === 1;
        return {
          name: item.name,
          value: item.value,
          date: item.date,
          displayValue: formatValue(item.value),
          yAxisValueLabel: isSingleValue ? [...item.yValues][0] : null
        };
      });

  if (xFieldType === 'date') {
    chartData.sort((a, b) => a.date - b.date);
  } else if (chartData[0] && isNumeric(chartData[0].name)) {
    chartData.sort((a, b) => parseFloat(a.name) - parseFloat(b.name));
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        {chart_config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          angle={chartData.length > 15 ? -45 : 0}
          textAnchor={chartData.length > 15 ? 'end' : 'middle'}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => formatValue(value)}
        />
        <RechartsTooltip
          formatter={(value, name, props) => {
              const payload = props.payload;
              let seriesName;

              if (yAxisLabelMode === 'value' && payload.yAxisValueLabel) {
                  seriesName = payload.yAxisValueLabel;
              } else if (!yAxisField) {
                  seriesName = 'Record Count';
              } else if (yFieldType === 'number') {
                  seriesName = `Sum of ${yAxisField}`;
              } else {
                  seriesName = `Count of ${yAxisField}`;
              }
              return [payload.displayValue, seriesName];
          }}
          labelFormatter={(label) => `${xAxisField}: ${label}`}
        />
        <Line
          type={chart_config.smoothLine ? "monotone" : "linear"}
          dataKey="value"
          name={yAxisField}
          stroke={chart_config.primaryColor || chartColors[1]}
          strokeWidth={2}
          dot={chart_config.showPoints !== false}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

const renderPieChart = (widget, data) => {
  const { chart_config = {} } = widget;
  const { xAxisField, yAxisField } = chart_config;

  if (!data.length) return <div className="text-center p-4">No data to display.</div>;
  if (!xAxisField) {
    return <div className="text-center p-4 text-sm text-gray-500">Please configure the 'Category Field' in the widget settings.</div>;
  }

  const yFieldType = yAxisField ? getFieldType(data, yAxisField) : 'count';

  const chartData = data.reduce((acc, item) => {
    const key = String(item[xAxisField] || 'Unknown');
    if (!acc[key]) {
      acc[key] = { name: key, value: 0 };
    }

    if (yAxisField) {
      if (yFieldType === 'number') {
        acc[key].value += parseFloat(item[yAxisField]) || 0;
      } else {
        acc[key].value += 1;
      }
    } else {
      acc[key].value += 1;
    }
    return acc;
  }, {});

  const formattedData = Object.values(chartData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(item => ({
      ...item,
      displayValue: formatValue(item.value)
    }));

  const renderLabel = ({ name, percent }) => {
    if (!chart_config.showLabels) return null;
    if (chart_config.showPercentage) {
      return `${(percent * 100).toFixed(0)}%`;
    }
    return formattedData.length <= 5 ? name : '';
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie
          data={formattedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius="70%"
          innerRadius={`${chart_config.innerRadius || 0}%`}
          fill="#8884d8"
          dataKey="value"
          paddingAngle={2}
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <RechartsTooltip
          formatter={(value, name, props) => {
              let tooltipLabel;
              if (!yAxisField) {
                  tooltipLabel = 'Record Count';
              } else if (yFieldType === 'number') {
                  tooltipLabel = `Sum of ${props.name}`;
              } else {
                  tooltipLabel = `Count of ${props.name}`;
              }
              return [props.payload.displayValue, props.name];
          }}
        />
        {chart_config.showLegend !== false && (
          <Legend
            wrapperStyle={{fontSize: "12px"}}
            formatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

  const renderList = (widget, data) => {
    const { display_options = {}, selected_fields = [] } = widget;
    const { maxItems = 10, showNumbers = false } = display_options;

    // Prioritize new listFields, fallback to first 2 selected_fields for old widgets
    const fieldsToDisplay = display_options.listFields && display_options.listFields.length > 0
      ? display_options.listFields
      : selected_fields.slice(0, 2);

    if (!data.length) {
        return <div className="text-center p-4 text-sm text-gray-500">No data to display.</div>;
    }

    if (fieldsToDisplay.length === 0) {
        return <div className="text-center p-4 text-sm text-gray-500">No fields selected for this list. Please edit the widget to add fields.</div>;
    }

    return (
      <div className="space-y-2 p-4 overflow-y-auto h-full">
        {data.slice(0, maxItems).map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-md border">
            <div className="flex items-start space-x-3">
              {showNumbers && <span className="text-sm text-gray-400 mt-0.5">{index + 1}.</span>}
              <div className="flex-1">
                  {fieldsToDisplay.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                          {fieldsToDisplay.map(field => (
                              <div key={field} className="flex justify-between items-center">
                                  <span className="font-medium capitalize text-gray-500">{field.replace(/_/g, ' ')}:</span>
                                  <span className="truncate ml-2 text-right" title={item[field]}>
                                      {item[field] !== null && item[field] !== undefined ? String(item[field]) : '-'}
                                  </span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTable = (widget, data) => {
    const { display_options = {}, selected_fields = [] } = widget;
    if (!data.length || !selected_fields.length) return <div className="text-center p-4">No data to display.</div>;

    const { maxRows = 10, showBorder = true, alternateRows = true } = display_options;
    const displayFields = selected_fields.slice(0, 5); // Max 5 columns for clarity

    return (
      <div className="overflow-auto h-full p-1">
        <table className={`w-full text-sm ${showBorder ? 'border-collapse' : ''}`}>
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr className="border-b">
              {displayFields.map(field => (
                <th key={field} className="text-left p-2 font-semibold capitalize text-gray-600">
                  {field.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, maxRows).map((item, index) => (
              <tr key={index} className={`${alternateRows && index % 2 !== 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`}>
                {displayFields.map(field => (
                  <td key={field} className="p-2 border-b border-gray-100 truncate max-w-[150px]">
                    {item[field] !== null && item[field] !== undefined ? String(item[field]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Main render logic
  if (view === 'list') {
    return (
      // Dashboard List View JSX
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <Button onClick={() => setShowNewDashboardModal(true)}><Plus className="h-4 w-4 mr-2" />New Dashboard</Button>
        </div>
        {showNewDashboardModal && (
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">Create New Dashboard<Button size="sm" variant="ghost" onClick={() => setShowNewDashboardModal(false)}><X className="h-4 w-4" /></Button></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Dashboard Name *</label><input type="text" value={newDashboardForm.dashboard_name} onChange={(e) => setNewDashboardForm(p => ({ ...p, dashboard_name: e.target.value }))} className="w-full px-3 py-2 border rounded-md" placeholder="e.g., Sales Overview"/></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={newDashboardForm.description} onChange={(e) => setNewDashboardForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border rounded-md" rows="2" placeholder="A brief description of this dashboard"/></div>
              <div><label className="block text-sm font-medium mb-1">Grid Columns</label><Select value={newDashboardForm.grid_columns.toString()} onValueChange={(v) => setNewDashboardForm(p => ({ ...p, grid_columns: parseInt(v) }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[6, 8, 12, 16, 24].map(c => <SelectItem key={c} value={c.toString()}>{c} columns</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center space-x-2"><input type="checkbox" id="is_public_new" checked={newDashboardForm.is_public} onChange={(e) => setNewDashboardForm(p => ({ ...p, is_public: e.target.checked }))} /><label htmlFor="is_public_new" className="text-sm">Make dashboard public</label></div>
              <div className="flex justify-end space-x-2"><Button variant="outline" onClick={() => setShowNewDashboardModal(false)}>Cancel</Button><Button onClick={createDashboard} disabled={!newDashboardForm.dashboard_name.trim()}>Create</Button></div>
            </CardContent>
          </Card>
        )}
        {dashboards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map(d => (
              <Card key={d.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate">{d.dashboard_name}</CardTitle>
                  <CardDescription className="truncate">{d.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="flex items-center justify-between text-sm text-gray-500"><span>{d.widget_count || 0} widgets</span><span>By {d.created_by_name}</span></div>
                  <div className="flex items-center justify-between mt-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${d.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{d.is_public ? 'Public' : 'Private'}</span>
                    <div className="flex items-center space-x-2">
                       {d.can_edit ? (<Button size="sm" variant="ghost" onClick={() => deleteDashboard(d.id)}><Trash2 className="h-4 w-4 text-red-500"/></Button>) : null}
                       <Button size="sm" onClick={() => loadDashboard(d.id)}>Open</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
           <Card><CardContent className="text-center py-12"><Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h3>No Dashboards Found</h3><p className="text-gray-500">Create a dashboard to get started.</p></CardContent></Card>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin mr-2" />Loading Dashboard...</div>;
  if (!currentDashboard) return <div className="text-center py-12"><p>Dashboard not found.</p><Button onClick={() => setView('list')} className="mt-4">Back to List</Button></div>;

  // Dashboard Detail View JSX
  return (
    <TooltipProvider>
    <div className="space-y-6">
       {/* Dashboard Header */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => { setView('list'); setCurrentDashboard(null); }}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-2xl font-semibold">{currentDashboard.dashboard_name}</h2>
            <p className="text-gray-500">{currentDashboard.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={refreshAllWidgets}><RefreshCw className="h-4 w-4 mr-2"/>Refresh All</Button>
          
          {editMode && currentDashboard.can_edit && (
            <Button size="sm" onClick={() => setShowAddWidgetModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          )}

          {currentDashboard.can_edit && <Button size="sm" onClick={() => setEditMode(!editMode)}>{editMode ? <><Save className="h-4 w-4 mr-2" />Done</> : <><Edit2 className="h-4 w-4 mr-2" />Edit Layout</>}</Button>}
           <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentDashboard.can_edit && <DropdownMenuItem onSelect={openEditDashboardModal}><Settings className="h-4 w-4 mr-2"/>Dashboard Settings</DropdownMenuItem>}
              <DropdownMenuItem onSelect={exportDashboard}><Download className="h-4 w-4 mr-2"/>Export as JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modals */}
      {showEditDashboardModal && (
        <Card className="border-2 border-blue-200">
            <CardHeader><CardTitle className="flex items-center justify-between">Dashboard Settings<Button size="sm" variant="ghost" onClick={() => setShowEditDashboardModal(false)}><X className="h-4 w-4" /></Button></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Dashboard Name *</label><input type="text" value={editDashboardForm.dashboard_name} onChange={(e) => setEditDashboardForm(p => ({ ...p, dashboard_name: e.target.value }))} className="w-full px-3 py-2 border rounded-md"/></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={editDashboardForm.description} onChange={(e) => setEditDashboardForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border rounded-md" rows="2"/></div>
              <div><label className="block text-sm font-medium mb-1">Grid Columns</label><Select value={editDashboardForm.grid_columns.toString()} onValueChange={(v) => setEditDashboardForm(p => ({ ...p, grid_columns: parseInt(v) }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[6, 8, 12, 16, 24].map(c => <SelectItem key={c} value={c.toString()}>{c} columns</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center space-x-2"><input type="checkbox" id="is_public_edit" checked={editDashboardForm.is_public} onChange={(e) => setEditDashboardForm(p => ({ ...p, is_public: e.target.checked }))}/><label htmlFor="is_public_edit" className="text-sm">Make dashboard public</label></div>
              <div className="flex justify-end space-x-2"><Button variant="outline" onClick={() => setShowEditDashboardModal(false)}>Cancel</Button><Button onClick={updateDashboard} disabled={!editDashboardForm.dashboard_name.trim()}>Save Changes</Button></div>
            </CardContent>
        </Card>
      )}

      {editingWidget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-start p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl mt-8">
            <DashboardWidgetEditor
              widget={editingWidget}
              onSave={updateWidget}
              onCancel={() => setEditingWidget(null)}
              availableFields={editingWidget.selected_fields || []}
            />
          </div>
        </div>
      )}

      {showAddWidgetModal && (
        <Card className="border-2 border-blue-200">
          <CardHeader><CardTitle className="flex justify-between">Add Widget<Button size="sm" variant="ghost" onClick={() => setShowAddWidgetModal(false)}><X className="h-4 w-4"/></Button></CardTitle></CardHeader>
          <CardContent className="space-y-4">
             <div>
                <label className="block text-sm font-medium mb-1">Select Saved Report *</label>
                <Select value={newWidgetForm.saved_report_id} onValueChange={v => setNewWidgetForm(p => ({...p, saved_report_id:v, widget_title: savedReports.find(r=>r.id.toString()===v)?.report_name || ''}))}><SelectTrigger><SelectValue placeholder="Choose a report"/></SelectTrigger><SelectContent>{savedReports.map(r=><SelectItem key={r.id} value={r.id.toString()}>{r.report_name} ({r.report_type})</SelectItem>)}</SelectContent></Select>
             </div>
             <div><label className="block text-sm font-medium mb-1">Widget Title</label><input type="text" value={newWidgetForm.widget_title} onChange={e=>setNewWidgetForm(p=>({...p, widget_title:e.target.value}))} className="w-full px-3 py-2 border rounded-md"/></div>
             <div>
                <label className="block text-sm font-medium mb-1">Widget Type</label>
                <div className="grid grid-cols-3 gap-2">{widgetTypes.map(t=><button key={t.value} onClick={()=>setNewWidgetForm(p=>({...p, widget_type:t.value}))} className={`p-2 border rounded-lg flex flex-col items-center ${newWidgetForm.widget_type===t.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}><t.icon className="h-5 w-5 mb-1"/>{t.label}</button>)}</div>
             </div>
             <div className="flex justify-end space-x-2"><Button variant="outline" onClick={()=>setShowAddWidgetModal(false)}>Cancel</Button><Button onClick={addWidget} disabled={!newWidgetForm.saved_report_id}>Add Widget</Button></div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Grid */}
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: currentDashboard.grid_columns || 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={30}
            isDraggable={editMode}
            isResizable={editMode}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            compactType="vertical"
        >
            {currentDashboard.widgets.map(widget => (
                <div key={widget.id.toString()} className="flex">
                    <Card className="w-full flex flex-col relative overflow-hidden">
                        <CardHeader className="flex-row items-center justify-between py-2 px-4 border-b flex-item">
                            <CardTitle className="text-base font-medium truncate" title={widget.widget_title}>
                                {widget.widget_title}
                            </CardTitle>
                            <div className="flex items-center space-x-1 ml-auto">
                                {editMode && (
                                    <div className="drag-handle p-1">
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Move className="h-4 w-4 text-gray-400" />
                                            </TooltipTrigger>
                                            <TooltipContent>Drag to Move</TooltipContent>
                                        </Tooltip>
                                    </div>
                                )}
                                {/* Auto-refresh indicator */}
                                {widget.display_options?.autoRefresh && !editMode && (
                                  <Tooltip>
                                    <TooltipTrigger><RefreshCw className="h-3 w-3 text-gray-400 animate-spin-slow"/></TooltipTrigger>
                                    <TooltipContent>Auto-refreshing</TooltipContent>
                                  </Tooltip>
                                )}
                                {/* Dropdown Menu for actions */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => loadWidgetData(widget)}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</DropdownMenuItem>
                                        {currentDashboard.can_edit && <DropdownMenuItem onSelect={() => setEditingWidget(widget)}><Settings className="h-4 w-4 mr-2"/>Edit Widget</DropdownMenuItem>}
                                        {currentDashboard.can_edit && <DropdownMenuItem onSelect={() => duplicateWidget(widget)}><Copy className="h-4 w-4 mr-2"/>Duplicate</DropdownMenuItem>}
                                        {currentDashboard.can_edit && <DropdownMenuItem onSelect={() => deleteWidget(widget.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50"><Trash2 className="h-4 w-4 mr-2"/>Delete</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-grow relative">
                            {renderWidgetContent(widget)}
                        </CardContent>
                    </Card>
                </div>
            ))}
        </ResponsiveGridLayout>

       {currentDashboard.widgets.length === 0 && !editMode && (
          <Card>
            <CardContent className="text-center py-12">
              <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium">This Dashboard is Empty</h3>
              {currentDashboard.can_edit ? (
                <>
                  <p className="text-gray-500 mb-4">Click "Edit Layout" to start adding widgets.</p>
                  <Button onClick={() => setEditMode(true)}><Edit2 className="h-4 w-4 mr-2" />Edit Layout</Button>
                </>
              ) : (
                <p className="text-gray-500">No widgets have been added to this dashboard.</p>
              )}
            </CardContent>
          </Card>
        )}
    </div>
    </TooltipProvider>
  );
};

export default DashboardTab;