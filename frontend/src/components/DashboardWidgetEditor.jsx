// components/DashboardWidgetEditor.jsx
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Save, Settings, Palette, Layout, BarChart, Type } from 'lucide-react'

const DashboardWidgetEditor = ({
  widget,
  onSave,
  onCancel,
  availableFields = []
}) => {
  const [editForm, setEditForm] = useState({
    widget_title: '',
    widget_type: 'table',
    width: 6,
    height: 4,
    chart_config: {},
    display_options: {}
  })

  useEffect(() => {
    if (widget) {
      setEditForm({
        widget_title: widget.widget_title || '',
        widget_type: widget.widget_type || 'table',
        width: widget.width || 6,
        height: widget.height || 4,
        chart_config: widget.chart_config || {},
        display_options: widget.display_options || {}
      })
    }
  }, [widget])

  // Enhanced helper functions
const getFieldType = (fieldName) => {
  if (!fieldName || typeof fieldName !== "string") return "unknown";

  const name = fieldName.toLowerCase();

  const patterns = {
    date: ["date", "time", "created", "updated", "modified", "timestamp"],
    number: [
      "count",
      "amount",
      "total",
      "revenue",
      "price",
      "cost",
      "value",
      "quantity",
      "number",
    ],
    id: ["id"], // IDs handled separately
    text: [
      "name",
      "title",
      "description",
      "email",
      "industry",
      "text",
      "content",
      "message",
      "phone",
      "company",
      "type",
      "category",
      "status",
      "label",
      "tag",
      "group",
    ],
  };

  if (patterns.date.some((kw) => name.includes(kw))) return "date";
  if (patterns.number.some((kw) => name.includes(kw))) return "number";
  if (patterns.id.some((kw) => name.includes(kw))) return "id";
  if (patterns.text.some((kw) => name.includes(kw))) return "text";

  return "unknown";
};


  const getFieldRecommendations = (fields, chartType) => {
    const fieldTypes = fields.map(field => ({
      field,
      type: getFieldType(field),
      isId: getFieldType(field) === 'id',
      isName: getFieldType(field) === 'text',
      isDate: getFieldType(field) === 'date',
      isNumeric: getFieldType(field) === 'number'
    }));

    const recommendations = {
      xAxisField: null,
      yAxisField: null
    };

    switch (chartType) {
      case 'bar_chart':
      case 'pie_chart':
        // X-axis: prefer text/categorical fields (names, titles, status, etc.)
        recommendations.xAxisField = fieldTypes.find(f => f.isName) || 
                                    fieldTypes.find(f => f.type === 'text') ||
                                    fieldTypes.find(f => !f.isId && !f.isDate && !f.isNumeric);
        
        // Y-axis: prefer numeric fields (but not IDs)
        recommendations.yAxisField = fieldTypes.find(f => f.isNumeric) ||
                                    fieldTypes.find(f => f.type === 'number');
        break;
        
      case 'line_chart':
        // X-axis: prefer date fields for time series, then text fields
        recommendations.xAxisField = fieldTypes.find(f => f.isDate) ||
                                    fieldTypes.find(f => f.isNumeric && !f.isId) ||
                                    fieldTypes.find(f => f.isName);
        
        // Y-axis: prefer numeric fields
        recommendations.yAxisField = fieldTypes.find(f => f.isNumeric) ||
                                    fieldTypes.find(f => f.type === 'number');
        break;
    }

    return {
      xAxisField: recommendations.xAxisField?.field || '',
      yAxisField: recommendations.yAxisField?.field || ''
    };
  };

  const handleSave = () => {
    onSave({
      ...editForm,
      chart_config: editForm.chart_config,
      display_options: editForm.display_options
    })
  }

  const updateChartConfig = (key, value) => {
    setEditForm(prev => ({
      ...prev,
      chart_config: {
        ...prev.chart_config,
        [key]: value
      }
    }))
  }

  const updateDisplayOptions = (key, value) => {
    setEditForm(prev => ({
      ...prev,
      display_options: {
        ...prev.display_options,
        [key]: value
      }
    }))
  }

  const widgetTypes = [
    { value: 'table', label: 'Data Table' },
    { value: 'bar_chart', label: 'Bar Chart' },
    { value: 'line_chart', label: 'Line Chart' },
    { value: 'pie_chart', label: 'Pie Chart' },
    { value: 'metric_card', label: 'Metric Card' },
    { value: 'list', label: 'Simple List' },
    { value: 'text_field', label: 'Text Display' } 
  ]

  const chartColors = [
    { value: '#3B82F6', label: 'Blue' },
    { value: '#EF4444', label: 'Red' },
    { value: '#10B981', label: 'Green' },
    { value: '#F59E0B', label: 'Amber' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#06B6D4', label: 'Cyan' },
    { value: '#84CC16', label: 'Lime' },
    { value: '#F97316', label: 'Orange' }
  ]

  // Helper function to make field names more readable in the UI
  const formatFieldName = (field) => {
    if (typeof field !== 'string') return '';
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Helper for rendering the intelligent preview text
  const renderChartPreview = () => {
    const xAxisField = editForm.chart_config.xAxisField;
    const yAxisField = editForm.chart_config.yAxisField;

    if (!xAxisField && !yAxisField) {
      return null;
    }

    const yAxisFieldType = yAxisField ? getFieldType(yAxisField) : 'count';

    let yAxisDescription;
    if (!yAxisField || yAxisField === 'COUNT_RECORDS') {
      yAxisDescription = <strong>Record Count</strong>;
    } else if (yAxisFieldType === 'number') {
      yAxisDescription = <>Sum of <strong>{formatFieldName(yAxisField)}</strong></>;
    } else {
      yAxisDescription = <>Count of <strong>{formatFieldName(yAxisField)}</strong></>;
    }

    return (
      <div className="text-xs text-gray-600 p-2 bg-blue-50 rounded border-l-2 border-blue-200">
        <strong>Preview:</strong><br />
        {editForm.widget_type === 'pie_chart' ? (
          <>
            Categories from <strong>{formatFieldName(xAxisField)}</strong>
            <br />
            Slice sizes from {yAxisDescription}
          </>
        ) : (
          <>
            X-axis: <strong>{formatFieldName(xAxisField)}</strong><br />
            Y-axis: {yAxisDescription}
          </>
        )}
      </div>
    );
  };
  
  const yAxisField = editForm.chart_config.yAxisField;
  const yAxisFieldType = yAxisField ? getFieldType(yAxisField) : 'count';
  const showLabelModeOption = yAxisFieldType !== 'number';

  const handleListFieldChange = (field, isChecked) => {
    const currentFields = editForm.display_options.listFields || [];
    let newFields;
    if (isChecked) {
      newFields = [...currentFields, field];
    } else {
      newFields = currentFields.filter(f => f !== field);
    }
    updateDisplayOptions('listFields', newFields);
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Edit Widget</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Customize your widget appearance and behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center">
            <Layout className="h-4 w-4 mr-2" />
            Basic Settings
          </h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">Widget Title</label>
            <input
              type="text"
              value={editForm.widget_title}
              onChange={(e) => setEditForm(prev => ({
                ...prev,
                widget_title: e.target.value
              }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter widget title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Widget Type</label>
            <Select
              value={editForm.widget_type}
              onValueChange={(value) => setEditForm(prev => ({
                ...prev,
                widget_type: value
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widgetTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Width (columns)</label>
              <Select
                value={editForm.width.toString()}
                onValueChange={(value) => setEditForm(prev => ({
                  ...prev,
                  width: parseInt(value)
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(12)].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1} column{i === 0 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Height (rows)</label>
              <Select
                value={editForm.height.toString()}
                onValueChange={(value) => setEditForm(prev => ({
                  ...prev,
                  height: parseInt(value)
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(8)].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1} row{i === 0 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Chart-specific Settings */}
        {['bar_chart', 'line_chart', 'pie_chart'].includes(editForm.widget_type) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Palette className="h-4 w-4 mr-2" />
              Chart Settings
            </h3>

            {/* Enhanced Data Mapping Section */}
            <div className="p-3 bg-gray-50 rounded-md border space-y-3">
              <h4 className="text-md font-medium flex items-center">
                <BarChart className="h-4 w-4 mr-2" />
                Data Mapping
                {availableFields.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto text-xs h-6"
                    onClick={() => {
                      const recommendations = getFieldRecommendations(availableFields, editForm.widget_type);
                      if (recommendations.xAxisField) {
                        updateChartConfig('xAxisField', recommendations.xAxisField);
                      }
                      if (recommendations.yAxisField) {
                        updateChartConfig('yAxisField', recommendations.yAxisField);
                      }
                    }}
                  >
                    Auto-select
                  </Button>
                )}
              </h4>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {editForm.widget_type === 'pie_chart' ? 'Category Field (Slices)' : 'X-Axis Field (Category)'}
                  <span className="text-xs text-gray-500 ml-1">
                    {editForm.widget_type === 'line_chart' && '(dates work best for time series)'}
                  </span>
                </label>
                <Select
                  value={editForm.chart_config.xAxisField || ''}
                  onValueChange={(value) => updateChartConfig('xAxisField', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => {
                      const fieldType = getFieldType(field);
                      const typeIcon = fieldType === 'date' ? '📅' : 
                                      fieldType === 'number' ? '🔢' : 
                                      fieldType === 'text' ? '📝' : 
                                      fieldType === 'id' ? '🔑' : '❓';
                      
                      return (
                        <SelectItem key={field} value={field}>
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center">
                              <span className="mr-2">{typeIcon}</span>
                              {formatFieldName(field)}
                            </span>
                            <span className="text-xs text-gray-400 capitalize ml-2">
                              {fieldType === 'id' ? 'ID' : fieldType}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {editForm.widget_type === 'pie_chart' ? 'Value Field (Slice Size)' : 'Y-Axis Field (Value)'}
                  <span className="text-xs text-gray-500 ml-1">
                    (numeric fields recommended)
                  </span>
                </label>
                <Select
                  value={editForm.chart_config.yAxisField || 'COUNT_RECORDS'}
                  onValueChange={(value) => updateChartConfig('yAxisField', value === 'COUNT_RECORDS' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a value field or leave empty to count records" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNT_RECORDS">
                      <div className="flex items-center text-gray-600">
                        <span className="mr-2">📊</span>
                        Count Records (no field needed)
                      </div>
                    </SelectItem>
                    {availableFields.map(field => {
                      const fieldType = getFieldType(field);
                      const typeIcon = fieldType === 'date' ? '📅' : 
                                      fieldType === 'number' ? '🔢' : 
                                      fieldType === 'text' ? '📝' : 
                                      fieldType === 'id' ? '🔑' : '❓';
                      const isRecommended = fieldType === 'number';
                      
                      return (
                        <SelectItem key={field} value={field}>
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center">
                              <span className="mr-2">{typeIcon}</span>
                              {formatFieldName(field)}
                              {isRecommended && (
                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">
                                  recommended
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-400 capitalize ml-2">
                              {fieldType === 'id' ? 'ID' : fieldType}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {showLabelModeOption && (
                <div className="pt-3 border-t mt-3">
                  <label className="block text-sm font-medium mb-2">Tooltip Label Display</label>
                  <div className="flex space-x-6">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="labelModeValue"
                        name="yAxisLabelMode"
                        value="value"
                        checked={editForm.chart_config.yAxisLabelMode === 'value' || !editForm.chart_config.yAxisLabelMode} // Default to 'value'
                        onChange={() => updateChartConfig('yAxisLabelMode', 'value')}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="labelModeValue" className="ml-2 text-sm text-gray-700">
                        Show Value (e.g., "New")
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="labelModeFieldName"
                        name="yAxisLabelMode"
                        value="fieldName"
                        checked={editForm.chart_config.yAxisLabelMode === 'fieldName'}
                        onChange={() => updateChartConfig('yAxisLabelMode', 'fieldName')}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="labelModeFieldName" className="ml-2 text-sm text-gray-700">
                        Show Field Name (e.g., "Status")
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Controls the label shown in the chart's tooltip when counting records.</p>
                </div>
              )}

              {/* Field preview */}
              {(editForm.chart_config.xAxisField || editForm.chart_config.yAxisField) && (
                  <div className="pt-2">
                      {renderChartPreview()}
                  </div>
              )}
            </div>

            {/* Tips section */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <h4 className="text-sm font-medium text-amber-800 mb-2">💡 Tips for better charts:</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                {editForm.widget_type === 'line_chart' && (
                  <li>• Use date fields for X-axis to create time series charts</li>
                )}
                {editForm.widget_type === 'bar_chart' && (
                  <li>• Use categorical fields (names, types, status) for X-axis</li>
                )}
                {editForm.widget_type === 'pie_chart' && (
                  <li>• Category field should have distinct values (not IDs)</li>
                )}
                <li>• For Y-axis, numeric fields work best (avoid text fields)</li>
                <li>• Date fields will show as counts when used for Y-axis</li>
                <li>• Leave Y-axis empty to count records by category</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Primary Color</label>
              <div className="grid grid-cols-4 gap-2">
                {chartColors.map(color => (
                  <button
                    key={color.value}
                    onClick={() => updateChartConfig('primaryColor', color.value)}
                    className={`w-full h-10 rounded-md border-2 ${
                      editForm.chart_config.primaryColor === color.value
                        ? 'border-gray-800'
                        : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {editForm.widget_type === 'bar_chart' && (
              <>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={editForm.chart_config.showGrid !== false}
                    onChange={(e) => updateChartConfig('showGrid', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showGrid" className="text-sm">
                    Show grid lines
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showLegend"
                    checked={editForm.chart_config.showLegend !== false}
                    onChange={(e) => updateChartConfig('showLegend', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showLegend" className="text-sm">
                    Show legend
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showTooltip"
                    checked={editForm.chart_config.showTooltip !== false}
                    onChange={(e) => updateChartConfig('showTooltip', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showTooltip" className="text-sm">
                    Show tooltips
                  </label>
                </div>
              </>
            )}

            {editForm.widget_type === 'line_chart' && (
              <>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={editForm.chart_config.showGrid !== false}
                    onChange={(e) => updateChartConfig('showGrid', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showGrid" className="text-sm">
                    Show grid lines
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showPoints"
                    checked={editForm.chart_config.showPoints !== false}
                    onChange={(e) => updateChartConfig('showPoints', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showPoints" className="text-sm">
                    Show data points
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="smoothLine"
                    checked={editForm.chart_config.smoothLine === true}
                    onChange={(e) => updateChartConfig('smoothLine', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="smoothLine" className="text-sm">
                    Smooth curve
                  </label>
                </div>
              </>
            )}

            {editForm.widget_type === 'pie_chart' && (
              <>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showLabels"
                    checked={editForm.chart_config.showLabels !== false}
                    onChange={(e) => updateChartConfig('showLabels', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showLabels" className="text-sm">
                    Show data labels
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showPercentage"
                    checked={editForm.chart_config.showPercentage !== false}
                    onChange={(e) => updateChartConfig('showPercentage', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showPercentage" className="text-sm">
                    Show percentages
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showLegend"
                    checked={editForm.chart_config.showLegend !== false}
                    onChange={(e) => updateChartConfig('showLegend', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showLegend" className="text-sm">
                    Show legend
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Inner Radius</label>
                  <Select
                    value={(editForm.chart_config.innerRadius || 0).toString()}
                    onValueChange={(value) => updateChartConfig('innerRadius', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Solid Pie (0%)</SelectItem>
                      <SelectItem value="20">Small Donut (20%)</SelectItem>
                      <SelectItem value="40">Medium Donut (40%)</SelectItem>
                      <SelectItem value="60">Large Donut (60%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Display Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Display Options
          </h3>

          {editForm.widget_type === 'table' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Rows to Display</label>
                <Select
                  value={(editForm.display_options.maxRows || 10).toString()}
                  onValueChange={(value) => updateDisplayOptions('maxRows', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 rows</SelectItem>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="20">20 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showBorder"
                  checked={editForm.display_options.showBorder !== false}
                  onChange={(e) => updateDisplayOptions('showBorder', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="showBorder" className="text-sm">
                  Show table borders
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="alternateRows"
                  checked={editForm.display_options.alternateRows !== false}
                  onChange={(e) => updateDisplayOptions('alternateRows', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="alternateRows" className="text-sm">
                  Alternate row colors
                </label>
              </div>
            </>
          )}

          {editForm.widget_type === 'list' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Items to Display</label>
                <Select
                  value={(editForm.display_options.maxItems || 10).toString()}
                  onValueChange={(value) => updateDisplayOptions('maxItems', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 items</SelectItem>
                    <SelectItem value="10">10 items</SelectItem>
                    <SelectItem value="15">15 items</SelectItem>
                    <SelectItem value="20">20 items</SelectItem>
                    <SelectItem value="50">50 items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showNumbers"
                  checked={editForm.display_options.showNumbers === true}
                  onChange={(e) => updateDisplayOptions('showNumbers', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="showNumbers" className="text-sm">
                  Show item numbers
                </label>
              </div>
              
              {/* --- NEW LIST FIELD SELECTOR --- */}
              <div className="pt-2">
                  <label className="block text-sm font-medium mb-2">Fields to Display in List</label>
                  <div className="p-3 bg-gray-50 rounded-md border max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                          {availableFields.map(field => (
                              <div key={field} className="flex items-center">
                                  <input
                                      type="checkbox"
                                      id={`list-field-${field}`}
                                      checked={(editForm.display_options.listFields || []).includes(field)}
                                      onChange={(e) => handleListFieldChange(field, e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <label htmlFor={`list-field-${field}`} className="ml-2 text-sm text-gray-700">
                                      {formatFieldName(field)}
                                  </label>
                              </div>
                          ))}
                      </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">The first selected field will be the title. Others will be shown below it.</p>
              </div>
            </>
          )}

          {editForm.widget_type === 'metric_card' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Metric Type</label>
                <Select
                  value={editForm.display_options.metricType || 'count'}
                  onValueChange={(value) => updateDisplayOptions('metricType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count Records</SelectItem>
                    <SelectItem value="sum">Sum Values</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {editForm.display_options.metricType !== 'count' && availableFields.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Field for Calculation</label>
                  <Select
                    value={editForm.display_options.metricField || 'NONE_SELECTED'}
                    onValueChange={(value) => updateDisplayOptions('metricField', value === 'NONE_SELECTED' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_SELECTED">Select a field</SelectItem>
                      {availableFields.map(field => {
                        const fieldType = getFieldType(field);
                        const typeIcon = fieldType === 'date' ? '📅' : 
                                        fieldType === 'number' ? '🔢' : 
                                        fieldType === 'text' ? '📝' : 
                                        fieldType === 'id' ? '🔑' : '❓';
                        const isRecommended = fieldType === 'number';
                        
                        return (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center justify-between w-full">
                              <span className="flex items-center">
                                <span className="mr-2">{typeIcon}</span>
                                {formatFieldName(field)}
                                {isRecommended && (
                                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">
                                    recommended
                                  </span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  {editForm.display_options.metricField && getFieldType(editForm.display_options.metricField) === 'date' && (
                    <div className="mt-1 text-xs text-amber-600">
                      ⚠️ Date fields will be counted, not calculated mathematically
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showIcon"
                  checked={editForm.display_options.showIcon !== false}
                  onChange={(e) => updateDisplayOptions('showIcon', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="showIcon" className="text-sm">
                  Show metric icon
                </label>
              </div>
            </>
          )}

          {editForm.widget_type === 'text_field' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center">
                <Type className="h-4 w-4 mr-2" />
                Text Display Settings
              </h3>

              <div className="p-3 bg-gray-50 rounded-md border space-y-3">
                <h4 className="text-md font-medium">Field Selection</h4>
                <div>
                  <label className="block text-sm font-medium mb-2">Text Field to Display</label>
                  <Select
                    value={editForm.display_options.textField || 'NONE_SELECTED'}
                    onValueChange={(value) => updateDisplayOptions('textField', value === 'NONE_SELECTED' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field to display" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_SELECTED">Select field to display</SelectItem>
                      {availableFields.map(field => (
                        <SelectItem key={field} value={field}>
                          {formatFieldName(field)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Font Size</label>
                <Select
                  value={editForm.display_options.fontSize || 'large'}
                  onValueChange={(value) => updateDisplayOptions('fontSize', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="xlarge">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Text Alignment</label>
                <Select
                  value={editForm.display_options.textAlign || 'center'}
                  onValueChange={(value) => updateDisplayOptions('textAlign', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Text Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: '#1f2937', label: 'Dark Gray' },
                    { value: '#3B82F6', label: 'Blue' },
                    { value: '#EF4444', label: 'Red' },
                    { value: '#10B981', label: 'Green' },
                    { value: '#F59E0B', label: 'Amber' },
                    { value: '#8B5CF6', label: 'Purple' },
                    { value: '#6B7280', label: 'Gray' },
                    { value: '#000000', label: 'Black' }
                  ].map(color => (
                    <button
                      key={color.value}
                      onClick={() => updateDisplayOptions('textColor', color.value)}
                      className={`w-full h-10 rounded-md border-2 ${
                        editForm.display_options.textColor === color.value
                          ? 'border-gray-800'
                          : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showLabel"
                  checked={editForm.display_options.showLabel !== false}
                  onChange={(e) => updateDisplayOptions('showLabel', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="showLabel" className="text-sm">
                  Show field name label
                </label>
              </div>
            </div>
          )}

          {/* Common display options for all widgets */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showTitle"
              checked={editForm.display_options.showTitle !== false}
              onChange={(e) => updateDisplayOptions('showTitle', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="showTitle" className="text-sm">
              Show widget title
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={editForm.display_options.autoRefresh === true}
              onChange={(e) => updateDisplayOptions('autoRefresh', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="autoRefresh" className="text-sm">
              Auto-refresh data
            </label>
          </div>

          {editForm.display_options.autoRefresh && (
            <div>
              <label className="block text-sm font-medium mb-2">Refresh Interval</label>
              <Select
                value={(editForm.display_options.refreshInterval || 300).toString()}
                onValueChange={(value) => updateDisplayOptions('refreshInterval', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!editForm.widget_title.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardWidgetEditor