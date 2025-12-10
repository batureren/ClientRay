import { useState, useEffect } from 'react'
import { usePackages } from '../context/PackagesContext'
import { useNavigate } from 'react-router-dom'
import {
  Settings,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  TestTube,
  Activity,
  Package,
  Zap,
  Calendar
} from 'lucide-react'

const PackageIcon = ({ packageName, className = "w-8 h-8" }) => {
  const icons = {
    calendly: Calendar,
    default: Package
  }

  const Icon = icons[packageName] || icons.default
  return <Icon className={className} />
}

const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    inactive: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
    error: { color: 'bg-red-100 text-red-800', icon: XCircle },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock }
  }

  const config = statusConfig[status] || statusConfig.inactive
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  )
}

const PackageCard = ({ package: pkg, onEdit, onToggle, onTest }) => {
  const [testing, setTesting] = useState(false)
  const handleTest = async () => {
    setTesting(true)
    try {
      await onTest(pkg.name)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <PackageIcon packageName={pkg.name} className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">{pkg.display_name}</h3>
              <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
              <div className="flex items-center space-x-2 mt-2">
                <StatusBadge status={pkg.status} />
                <span className="text-xs text-gray-500">v{pkg.version}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleTest()}
              disabled={testing || !pkg.is_enabled}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Test Connection"
            >
              <TestTube className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => onEdit(pkg)}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit Package"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => onToggle(pkg.name, !pkg.is_enabled)}
              className="flex items-center"
              title={pkg.is_enabled ? 'Disable Package' : 'Enable Package'}
            >
              {pkg.is_enabled ? (
                <ToggleRight className="w-8 h-8 text-green-600" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {pkg.error_message && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-800">{pkg.error_message}</p>
            </div>
          </div>
        )}

        {pkg.last_sync && (
          <div className="mt-4 text-xs text-gray-500">
            Last synced: {new Date(pkg.last_sync).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

const PackageEditor = ({ package: pkg, onSave, onCancel, onTest }) => {
  const [formData, setFormData] = useState({
    is_enabled: pkg?.is_enabled || false,
    config: pkg?.config || {},
    api_config: pkg?.api_config || {}
  });
  const [showApiKeys, setShowApiKeys] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (pkg) {
      setFormData({
        is_enabled: pkg.is_enabled || false,
        config: typeof pkg.config === 'string' ? JSON.parse(pkg.config) : (pkg.config || {}),
        api_config: typeof pkg.api_config === 'string' ? JSON.parse(pkg.api_config) : (pkg.api_config || {})
      });
      setTestResult(null);
    }
  }, [pkg]);

  const handleConfigChange = (section, key, value) => {
    setFormData(prev => {
      if (section) {
        return { ...prev, [section]: { ...prev[section], [key]: value } };
      }
      return { ...prev, [key]: value };
    });
  };

  const toggleShowApiKey = (key) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(pkg.name, formData);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await onSave(pkg.name, formData);
      const result = await onTest(pkg.name);
      setTestResult(result);

      // Auto-populate organization_uri if returned from test
      if (result.success && result.data?.organizationUri) {
        setFormData(prev => ({
          ...prev,
          api_config: {
            ...prev.api_config,
            organization_uri: result.data.organizationUri
          }
        }));
      }
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };
  
const handleCreateWebhook = async () => {
  setTesting(true);
  setTestResult(null);
  try {
    const response = await fetch(`/api/packages/calendly/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_uri: formData.api_config.organization_uri,
        url: `${window.location.origin}/api/packages/calendly/webhook-receiver`
      })
    });
    
    const result = await response.json();

    if (!response.ok) {
      // Check for the specific error from the backend response
      const errorMessage = result.error || (result.details && result.details[0] ? `${result.title}: ${result.details[0].message}` : 'Failed to create webhook');
      throw new Error(errorMessage);
    }

    setFormData(prev => ({
      ...prev,
      api_config: {
        ...prev.api_config,
        webhook_id: result.webhook.uri,
        webhook_url: result.webhook.callback_url,
        webhook_signing_key: result.signing_key
      }
    }));
    setTestResult({ success: true, message: "Webhook created successfully! Click 'Save Changes' to persist." });

  } catch (error) {
    console.error("Create webhook failed:", error);
    setTestResult({ success: false, message: error.message });
  } finally {
    setTesting(false);
  }
}

  const renderApiConfigField = (key, value, isSecret = false, button = null) => {
    return (
      <div key={key} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 capitalize">
          {key.replace(/_/g, ' ')}
        </label>
        <div className="relative flex items-center space-x-2">
          <input
            type={isSecret && !showApiKeys[key] ? 'password' : 'text'}
            value={value || ''}
            onChange={(e) => handleConfigChange('api_config', key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`Enter ${key.replace(/_/g, ' ')}`}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => toggleShowApiKey(key)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              style={{ right: button ? 'calc(5rem + 10px)' : '0.75rem' }}
            >
              {showApiKeys[key] ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
            </button>
          )}
          {button}
        </div>
      </div>
    );
  };

  const getApiConfigFields = () => {
    return ['access_token', 'webhook_url', 'organization_uri', 'webhook_signing_key'];
  };

  const getConfigFields = () => {
    return ['timeout', 'retries', 'webhook_enabled', 'default_user_uri'];
  };

  const handleFetchUserInfo = async () => {
    if (!formData.api_config.access_token) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("https://api.calendly.com/users/me", {
        headers: {
          Authorization: `Bearer ${formData.api_config.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendly API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const userUri = data?.resource?.uri;
      const organizationUri = data?.resource?.current_organization;

      if (userUri) {
        setFormData(prev => ({
          ...prev,
          config: {
            ...prev.config,
            default_user_uri: userUri,
          },
          api_config: {
            ...prev.api_config,
            organization_uri: organizationUri || prev.api_config.organization_uri,
          },
        }));
      }

      setTestResult({ success: true, message: "User info fetched successfully" });
    } catch (error) {
      console.error("Fetch Calendly user info failed:", error);
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };


  if (!pkg) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <PackageIcon packageName={pkg.name} />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{pkg.display_name}</h2>
                <p className="text-sm text-gray-500">{pkg.description}</p>
              </div>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Enable Package</h3>
              <p className="text-sm text-gray-500">Turn this package on or off</p>
            </div>
            <button onClick={() => handleConfigChange(null, 'is_enabled', !formData.is_enabled)} className="flex items-center">
              {formData.is_enabled ? <ToggleRight className="w-8 h-8 text-green-600" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">API Configuration</h3>
            <div className="grid grid-cols-1 gap-4">
              {getApiConfigFields().map(field => {
                const isSecret = ['access_token', 'webhook_signing_key'].includes(field);
                let fieldButton = null;

                if (field === 'access_token') {
                  fieldButton = (
                    <button
                      type="button"
                      onClick={handleFetchUserInfo}
                      disabled={testing || !formData.api_config.access_token}
                      className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md disabled:opacity-50 flex-shrink-0"
                    >
                      {testing ? 'Fetching...' : 'Fetch User ID'}
                    </button>
                  );
} else if (field === 'webhook_url') {
  fieldButton = (
    <div className="flex space-x-2">
      {formData.api_config.webhook_url ? (
        null
      ) : (
        <button
          type="button"
          onClick={handleCreateWebhook}
          disabled={testing || !formData.api_config.access_token || !formData.api_config.organization_uri}
          className="px-3 py-2 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md disabled:opacity-50 flex-shrink-0"
        >
          {testing ? 'Creating...' : 'Create Webhook'}
        </button>
      )}
    </div>
  );
}
                return renderApiConfigField(field, formData.api_config[field], isSecret, fieldButton);
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">General Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
{getConfigFields().map(field => (
  <div key={field} className="space-y-2">
    <label className="block text-sm font-medium text-gray-700 capitalize">
      {field.replace(/_/g, ' ')}
    </label>

    {typeof formData.config[field] === 'boolean' ? (
      <button
        onClick={() => handleConfigChange('config', field, !formData.config[field])}
        className="flex items-center"
      >
        {formData.config[field] ? (
          <ToggleRight className="w-6 h-6 text-green-600" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-gray-400" />
        )}
      </button>
    ) : field === 'webhook_enabled' ? (
      <div className="space-y-2">
        <div className='flex gap-1'>
        <label className="block text-sm font-medium text-gray-700">
          {formData.api_config.webhook_url && (
            <span
              className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                formData.config[field] !== false
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {formData.config[field] !== false ? 'Active' : 'Disabled'}
            </span>
          )}
        </label>
        <button
          onClick={() => handleConfigChange('config', field, !formData.config[field])}
          className="flex items-center"
        >
          {formData.config[field] !== false ? (
            <ToggleRight className="w-6 h-6 text-green-600" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-gray-400" />
          )}
        </button>
        </div>

        {formData.config[field] === false && formData.api_config.webhook_url && (
          <p className="text-xs text-amber-600">
            🔇 Webhook is configured but disabled. Calendly will still send events, but they will be ignored by your server.
          </p>
        )}
        {formData.config[field] !== false && formData.api_config.webhook_url && (
          <p className="text-xs text-green-600">
            ✅ Webhook is active and processing events.
          </p>
        )}
      </div>
    ) : (
      <input
        type={typeof formData.config[field] === 'number' ? 'number' : 'text'}
        value={formData.config[field] || ''}
        onChange={(e) =>
          handleConfigChange(
            'config',
            field,
            typeof formData.config[field] === 'number'
              ? parseInt(e.target.value)
              : e.target.value
          )
        }
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    )}
  </div>
))}

            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-md ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start">
                {testResult.success ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-2" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2" />}
                <div>
                  <h4 className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </h4>
                  <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>{testResult.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onCancel} disabled={saving || testing} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50">Cancel</button>
          <button onClick={handleTestConnection} disabled={saving || testing} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md disabled:opacity-50 flex items-center">
            <TestTube className="w-4 h-4 mr-1" />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button onClick={handleSave} disabled={saving || testing} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PackagesPage() {
  const { packages, loading, error, updatePackage, testPackage, getPackageStats, fetchPackage, refresh } = usePackages()
  const [editingPackage, setEditingPackage] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const navigate = useNavigate()
  const stats = getPackageStats()

  const handleEditPackage = async (pkg) => {
    try {
      const fullPackage = await fetchPackage(pkg.name)
      setEditingPackage(fullPackage)
    } catch (error) {
      console.error('Error fetching package details:', error)
    }
  }

  const handleSavePackage = async (name, data) => {
    try {
      await updatePackage(name, data)
      setEditingPackage(null)
    } catch (error) {
      console.error('Error saving package:', error)
    }
  }

  const handleTogglePackage = async (name, enabled) => {
    try {
      await updatePackage(name, { is_enabled: enabled })
    } catch (error) {
      console.error('Error toggling package:', error)
    }
  }

  const filteredPackages = packages.filter(pkg => categoryFilter === 'all' || pkg.category === categoryFilter)
  const categories = [...new Set(packages.map(pkg => pkg.category))]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Loading packages...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
        <div>
          <XCircle className="w-12 h-12 text-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Error: {error}</p>
          <button onClick={refresh} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div>
        <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Settings
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Package Management</h1>
      </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center"><Package className="w-8 h-8 text-blue-600" /><div className="ml-4"><h3 className="text-lg font-semibold text-gray-900">{stats.total}</h3><p className="text-sm text-gray-600">Total Packages</p></div></div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center"><Zap className="w-8 h-8 text-green-600" /><div className="ml-4"><h3 className="text-lg font-semibold text-gray-900">{stats.enabled}</h3><p className="text-sm text-gray-600">Active Packages</p></div></div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center"><CheckCircle className="w-8 h-8 text-blue-600" /><div className="ml-4"><h3 className="text-lg font-semibold text-gray-900">{stats.byStatus.active}</h3><p className="text-sm text-gray-600">Healthy</p></div></div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center"><AlertTriangle className="w-8 h-8 text-red-600" /><div className="ml-4"><h3 className="text-lg font-semibold text-gray-900">{stats.byStatus.error}</h3><p className="text-sm text-gray-600">With Errors</p></div></div>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-8">
            <button onClick={() => setCategoryFilter('all')} className={`py-2 px-1 border-b-2 font-medium text-sm ${categoryFilter === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>All ({packages.length})</button>
            {categories.map(category => (<button key={category} onClick={() => setCategoryFilter(category)} className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${categoryFilter === category ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{category} ({packages.filter(p => p.category === category).length})</button>))}
          </nav></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPackages.map(pkg => (
            <PackageCard key={pkg.id} package={pkg} onEdit={handleEditPackage} onToggle={handleTogglePackage} onTest={testPackage} />
          ))}
        </div>

        {filteredPackages.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="mt-4 text-gray-600">{categoryFilter === 'all' ? 'No packages found' : `No packages found in ${categoryFilter} category`}</p>
          </div>
        )}
      </div>

      {editingPackage && (
        <PackageEditor
          package={editingPackage}
          onSave={handleSavePackage}
          onCancel={() => setEditingPackage(null)}
          onTest={testPackage}
        />
      )}
    </div>
  )
}