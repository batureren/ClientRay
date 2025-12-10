// frontend/pages/EmailProviderSettings.jsx

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Check, 
  AlertCircle, 
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowLeft,
  Server
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'
import api from '@/services/api';

const EmailProviderSettings = () => {
  const navigate = useNavigate()
  const [currentProvider, setCurrentProvider] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState(null);

  const providers = {
    gmail: {
      name: 'Gmail SMTP',
      icon: <Mail className="h-5 w-5" />,
      description: 'Perfect for getting started',
      pros: ['Easy setup', 'Free 500 emails/day', 'Reliable delivery'],
      cons: ['Daily limits', 'Requires app password'],
      dailyLimit: '500 emails',
      setup: 'SMTP credentials',
      color: 'bg-gray-500'
    },
    sendgrid: {
      name: 'SendGrid',
      icon: <Zap className="h-5 w-5" />,
      description: 'Professional email service',
      pros: ['Great deliverability', 'Analytics', 'High limits'],
      cons: ['Paid service', 'API complexity'],
      dailyLimit: '40,000+ emails',
      setup: 'API key required',
      color: 'bg-blue-500'
    },
    aws_ses: {
      name: 'Amazon SES',
      icon: <Shield className="h-5 w-5" />,
      description: 'Enterprise-grade email',
      pros: ['Very cheap', 'Scalable', 'AWS integration'],
      cons: ['Initial limits', 'AWS complexity'],
      dailyLimit: 'Starts at 200',
      setup: 'AWS credentials',
      color: 'bg-orange-500'
    },
    smtp: {
      name: 'Custom SMTP',
      icon: <Server className="h-5 w-5" />,
      description: 'Use your domain server',
      pros: ['Your domain', 'Full control', 'No third-party'],
      cons: ['Deliverability issues', 'Setup complexity'],
      dailyLimit: 'Server dependent',
      setup: 'SMTP credentials',
      color: 'bg-gray-500'
    }
  };
  
  const fetchProviderStatus = async () => {
    setStatusLoading(true);
    setError(null);
    setStatus(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await api.get('/email/status', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseData = response.data || response;
      
      if (responseData && responseData.provider) {
        setStatus(responseData);
        setCurrentProvider(responseData.provider);
      } else {
        setError('Invalid response format from status API');
      }
    } catch (error) {
      console.error('Error fetching provider status:', error);
      
      if (error.name === 'AbortError') {
        setError('Request timed out - the email service might be starting up or unresponsive.');
      } else {
        setError(error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to fetch status');
      }
    } finally {
      setStatusLoading(false);
    }
  };

  // Fetch status on component mount
  useEffect(() => {
    fetchProviderStatus();
  }, []);
  
  const switchProvider = async (provider) => {
    if (provider === currentProvider) return;

    setCurrentProvider(provider);
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
        await api.post('/email/switch-provider', { provider });
    } catch (error) {
        console.error('Switch provider error:', error);
        setError(error.response?.data?.message || error.response?.data?.error || 'Failed to switch provider');
    } finally {
        await fetchProviderStatus();
        setLoading(false);
    }
  };

  const handleRefreshStatus = () => {
    fetchProviderStatus();
  };
  
  // Determine if the current provider is configured based on the new API response
  const isConfigured = status?.connectionTest?.success === true;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Settings
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Provider Settings</h1>
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Service Status</h3>
            <button
              onClick={handleRefreshStatus}
              disabled={statusLoading || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
              Refresh & Test
            </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-medium">Status Error</div>
                <div className="text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {statusLoading && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 text-blue-800">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div>
                <div className="font-medium">Loading Status</div>
                <div className="text-sm">Fetching email service status...</div>
              </div>
            </div>
          </div>
        )}

        {/* Status Details */}
        {status && !statusLoading && (
          <div className="space-y-4">
            {/* Connection Test Result */}
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              isConfigured
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {isConfigured ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">
                  {providers[currentProvider]?.name || 'Current Provider'}: {isConfigured ? 'Connection Successful' : 'Connection Failed'}
                </div>
                <div className="text-sm">{status.connectionTest?.message}</div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Provider Selection */}
      <div className="bg-white rounded-lg border p-6 mt-6">
        <h4 className="font-semibold mb-4">Choose Email Provider</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(providers).map(([key, provider]) => {
            const isSelected = currentProvider === key;
            const isProviderConfigured = isSelected && isConfigured;
            const needsConfig = isSelected && !isConfigured;
            
            return (
              <div
                key={key}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected
                    ? needsConfig
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => switchProvider(key)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${provider.color} text-white`}>
                    {provider.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-gray-600">{provider.description}</div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2">
                      {isProviderConfigured ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="h-5 w-5" />
                          <span className="text-xs font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-xs font-medium">Setup Required</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">Daily Limit:</div>
                    <div className="font-medium">{provider.dailyLimit}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Setup:</div>
                    <div className="font-medium">{provider.setup}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {provider.pros.slice(0, 2).map((pro, index) => (
                      <span key={index} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {pro}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Setup Instructions */}
      {currentProvider && (
              <div className="bg-white rounded-lg border p-6 mt-6">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex justify-between items-center font-semibold"
        >
          <span>Setup Instructions for {providers[currentProvider]?.name || '...'}</span>
          {showConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {showConfig && currentProvider && (
          <div className="mt-4">
            {currentProvider === 'gmail' && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="font-medium text-yellow-800 mb-2">Gmail App Password Setup:</div>
                  <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                    <li>Go to your Google Account settings</li>
                    <li>Security → 2-Step Verification (must be enabled)</li>
                    <li>App passwords → Generate new password</li>
                    <li>Choose "Mail" and "Other" → Enter "Your CRM"</li>
                    <li>Copy the 16-character password to your .env file</li>
                  </ol>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Environment variables needed:</strong>
                  <code className="block bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                    GMAIL_USER=your-email@gmail.com<br/>
                    GMAIL_APP_PASSWORD=your-16-char-password
                  </code>
                </div>
              </div>
            )}

            {currentProvider === 'sendgrid' && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="font-medium text-blue-800 mb-2">SendGrid API Setup:</div>
                  <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                    <li>Create a SendGrid account</li>
                    <li>Go to Settings → API Keys</li>
                    <li>Create API Key with "Full Access" or required permissions</li>
                    <li>Copy the API Key and add it to your environment variables</li>
                  </ol>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Environment variables needed:</strong>
                  <code className="block bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                    SENDGRID_API_KEY=your-api-key
                  </code>
                </div>
              </div>
            )}

            {currentProvider === 'smtp' && (
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="font-medium text-gray-800 mb-2">Custom SMTP Setup:</div>
                  <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                    <li>Get SMTP credentials from your hosting provider</li>
                    <li>Note down Host, Port, Username, and Password</li>
                    <li>Decide if SSL/TLS is required</li>
                    <li>Add credentials to your environment variables</li>
                  </ol>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Environment variables needed:</strong>
                  <code className="block bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                    SMTP_HOST=smtp.yourdomain.com<br/>
                    SMTP_PORT=465<br/>
                    SMTP_USER=your-username<br/>
                    SMTP_PASS=your-password<br/>
                    SMTP_SECURE=true
                  </code>
                </div>
              </div>
            )}

            {currentProvider === 'aws_ses' && (
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="font-medium text-orange-800 mb-2">Amazon SES Setup:</div>
                  <ol className="list-decimal list-inside text-sm text-orange-700 space-y-1">
                    <li>Log in to AWS Management Console</li>
                    <li>Go to Amazon SES service</li>
                    <li>Verify your sending domain or email</li>
                    <li>Get AWS Access Key and Secret Key</li>
                    <li>Set region and credentials in environment variables</li>
                  </ol>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Environment variables needed:</strong>
                  <code className="block bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                    AWS_REGION=us-east-1<br/>
                    AWS_ACCESS_KEY_ID=your-access-key<br/>
                    AWS_SECRET_ACCESS_KEY=your-secret-key
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

    </div>
  );
};

export default EmailProviderSettings;