import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Save,
  Eye,
  Edit,
  Trash2,
  User,
  Globe,
  Lock,
  Calendar,
  Search,
  X,
  AlertCircle
} from 'lucide-react'
import api from '@/services/api';

const SavedReportsManager = ({ 
  reportType, 
  currentFilters, 
  currentSelectedFields, 
  onLoadReport,
  onClose 
}) => {
  const [savedReports, setSavedReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [editingReport, setEditingReport] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBy, setFilterBy] = useState('all')
  const [error, setError] = useState(null)
  
  // Save form state
  const [saveForm, setSaveForm] = useState({
    report_name: '',
    description: '',
    is_public: true
  })

  useEffect(() => {
    loadSavedReports()
  }, [reportType, filterBy])

  const loadSavedReports = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Construct the endpoint based on filter
      let endpoint = '/saved-reports'
      if (filterBy === 'my') {
        endpoint = '/saved-reports/my/reports'
      }
      
      // Always include the type parameter
      const params = new URLSearchParams({ type: reportType })
      const fullUrl = `${endpoint}?${params}`
      const response = await api.get(fullUrl)
      // Handle different response structures
      let reportsData = []
      
      if (response.data && response.data.data) {
        reportsData = Array.isArray(response.data.data) ? response.data.data : []
      } else if (Array.isArray(response.data)) {
        reportsData = response.data
      } else if (response.data && Array.isArray(response.data.reports)) {
        reportsData = response.data.reports
      }
      setSavedReports(reportsData)
      
    } catch (error) {
      setError(`Failed to load saved reports: ${error.response?.data?.error || error.message}`)
      setSavedReports([])
    }
    
    setLoading(false)
  }

  const handleSaveReport = async (e) => {
    e.preventDefault()
    
    if (!saveForm.report_name.trim()) {
      alert('Please enter a report name')
      return
    }

    if (!currentFilters || currentFilters.length === 0) {
      alert('Please add at least one filter before saving')
      return
    }

    try {
      setLoading(true)
      
      const reportData = {
        report_name: saveForm.report_name.trim(),
        report_type: reportType,
        filters: currentFilters,
        selected_fields: currentSelectedFields,
        is_public: saveForm.is_public,
        description: saveForm.description.trim() || null
      }

      if (editingReport) {
        await api.put(`/saved-reports/${editingReport.id}`, reportData)
      } else {
        await api.post('/saved-reports', reportData)
      }

      // Reset form and reload reports
      setSaveForm({ report_name: '', description: '', is_public: true })
      setShowSaveForm(false)
      setEditingReport(null)
      await loadSavedReports()
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving report')
    }
    setLoading(false)
  }

  const handleLoadReport = (report) => {
    onLoadReport(report)
    onClose()
  }

  const handleEditReport = (report) => {
    setEditingReport(report)
    setSaveForm({
      report_name: report.report_name,
      description: report.description || '',
      is_public: Boolean(report.is_public) // Convert to boolean
    })
    setShowSaveForm(true)
  }

  const handleDeleteReport = async (reportId, reportName) => {
    if (!confirm(`Are you sure you want to delete "${reportName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setLoading(true)
      await api.delete(`/saved-reports/${reportId}`)
      await loadSavedReports()
      alert('Report deleted successfully!')
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting report')
    }
    setLoading(false)
  }

  const filteredReports = savedReports.filter(report => {
    const searchLower = searchTerm.toLowerCase()
    return (
      report.report_name?.toLowerCase().includes(searchLower) ||
      (report.description && report.description.toLowerCase().includes(searchLower)) ||
      report.created_by_name?.toLowerCase().includes(searchLower)
    )
  })

  const canSaveCurrentState = currentFilters && currentFilters.length > 0 && currentSelectedFields && currentSelectedFields.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Saved Reports Manager</h3>
          <p className="text-sm text-gray-600">
            Save, share, and manage your custom reports
          </p>
        </div>
        <div className="flex gap-2">
          {canSaveCurrentState && (
            <Button
              onClick={() => {
                setEditingReport(null)
                setSaveForm({ report_name: '', description: '', is_public: true })
                setShowSaveForm(true)
              }}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Current
            </Button>
          )}
          <Button onClick={onClose} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadSavedReports}
                className="ml-4"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Form */}
      {showSaveForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Save className="h-5 w-5 mr-2" />
              {editingReport ? 'Edit Report' : 'Save New Report'}
            </CardTitle>
            <CardDescription>
              {editingReport 
                ? 'Update your saved report settings'
                : 'Save your current filters and field selection for future use'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={saveForm.report_name}
                  onChange={(e) => setSaveForm({...saveForm, report_name: e.target.value})}
                  placeholder="Enter a descriptive name for this report"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm({...saveForm, description: e.target.value})}
                  placeholder="Brief description of what this report shows..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={saveForm.is_public}
                  onChange={(e) => setSaveForm({...saveForm, is_public: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <label htmlFor="is_public" className="text-sm font-medium text-gray-700 flex items-center">
                  {saveForm.is_public ? <Globe className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                  Make this report public (visible to all users)
                </label>
              </div>

              {/* Current Report Summary */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Report Settings:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Type:</span> {reportType === 'leads' ? 'Leads' : 'Accounts'} Report
                  </div>
                  <div>
                    <span className="font-medium">Filters:</span> {currentFilters?.length || 0} active
                  </div>
                  <div>
                    <span className="font-medium">Fields:</span> {currentSelectedFields?.length || 0} selected
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingReport ? 'Update Report' : 'Save Report'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowSaveForm(false)
                    setEditingReport(null)
                    setSaveForm({ report_name: '', description: '', is_public: true })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reports by name, description, or creator..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
<div className="flex gap-2">
  <select
    value={filterBy}
    onChange={(e) => setFilterBy(e.target.value)}
    className="
      px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
      bg-white text-gray-900 border-gray-300
      dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600
      dark:focus:ring-blue-400
    "
  >
    <option value="all">All Reports</option>
    <option value="my">My Reports</option>
    <option value="public">Public Reports</option>
  </select>
</div>

          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Saved Reports ({savedReports.length})</span>
            {loading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading saved reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <Save className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {savedReports.length === 0 ? 'No saved reports found' : 'No reports match your search'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms or filter settings'
                  : savedReports.length === 0 
                    ? 'Create your first saved report by applying filters and clicking "Save Current"'
                    : 'No reports found for the current filter'
                }
              </p>
              {searchTerm ? (
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear Search
                </Button>
              ) : savedReports.length === 0 && (
                <Button variant="outline" onClick={loadSavedReports}>
                  Refresh
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map(report => (
<div
  key={report.id}
  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors
             dark:border-gray-700 dark:hover:bg-gray-800"
>
  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 truncate dark:text-gray-100">
            {report.report_name}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-1 bg-gray-100 rounded dark:bg-gray-700 dark:text-gray-200">
              {report.report_type === 'leads' 
  ? 'Leads' 
  : report.report_type === 'accounts' 
    ? 'Accounts' 
    : 'Calls'}
            </span>
            <span className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              {report.is_public ? (
                <>
                  <Globe className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
                  Private
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {report.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2 dark:text-gray-300">
          {report.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center">
          <User className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
          {report.created_by_name || 'Unknown'}
        </span>
        <span className="flex items-center">
          <Calendar className="h-3 w-3 mr-1 text-gray-500 dark:text-gray-400" />
          {report.created_at
            ? new Date(report.created_at).toLocaleDateString()
            : 'Unknown'}
        </span>
        <span>
          {Array.isArray(report.filters) ? report.filters.length : 0} filters,{' '}
          {Array.isArray(report.selected_fields) ? report.selected_fields.length : 0}{' '}
          fields
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLoadReport(report)}
        className="dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <Eye className="h-4 w-4 mr-1" />
        Load
      </Button>

      {report.can_edit ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEditReport(report)}
            className="dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeleteReport(report.id, report.report_name)}
            className="dark:bg-red-700 dark:hover:bg-red-800"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ) : null}
    </div>
  </div>
</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SavedReportsManager