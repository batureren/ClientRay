// frontend/pages/ApiDocumentationPage.jsx

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Code, Copy, Check, Search, Filter, Globe, Lock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

export default function ApiDocumentationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [copiedRoute, setCopiedRoute] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);

  useEffect(() => {
    fetchApiRoutes();
  }, []);

  useEffect(() => {
    filterRoutes();
  }, [searchTerm, methodFilter, routes]);

  const fetchApiRoutes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api-routes');
      if (response.data.success) {
        setRoutes(response.data.routes || []);
        setFilteredRoutes(response.data.routes || []);
      }
    } catch (err) {
      console.error('Error fetching API routes:', err);
    }
    setLoading(false);
  };

  const filterRoutes = () => {
    let filtered = routes;

    if (searchTerm) {
      filtered = filtered.filter(route =>
        route.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        route.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (methodFilter !== 'ALL') {
      filtered = filtered.filter(route => route.method === methodFilter);
    }

    setFilteredRoutes(filtered);
  };

  const copyToClipboard = (text, routeId) => {
    navigator.clipboard.writeText(text);
    setCopiedRoute(routeId);
    setTimeout(() => setCopiedRoute(null), 2000);
  };

  const getMethodColor = (method) => {
    const colors = {
      GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[method] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const groupedRoutes = filteredRoutes.reduce((acc, route) => {
    const category = route.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(route);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600 dark:text-gray-300">
              {t('api.loading', 'Loading API routes...')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              {t('api.backToSettings', 'Settings')}
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {t('api.title', 'API Documentation')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('api.subtitle', 'Available REST API endpoints for external integrations')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Globe className="w-4 h-4" />
            <span>{filteredRoutes.length} {t('api.endpoints', 'endpoints')}</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">{t('api.infoTitle', 'API Information')}</p>
              <p className="mt-2"><strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">{import.meta.env.VITE_BASE_URL || 'https://api.yourdomain.com'}</code></p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('api.searchPlaceholder', 'Search endpoints...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">{t('api.allMethods', 'All Methods')}</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Routes List */}
        <div className="space-y-6">
          {Object.keys(groupedRoutes).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('api.noRoutes', 'No Routes Found')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('api.noRoutesDescription', 'Try adjusting your search or filters.')}
              </p>
            </div>
          ) : (
            Object.entries(groupedRoutes).map(([category, categoryRoutes]) => (
              <div key={category}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  {category}
                </h2>
                <div className="space-y-2">
                  {categoryRoutes.map((route, index) => (
                    <div
                      key={`${route.method}-${route.path}-${index}`}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        onClick={() => setExpandedRoute(expandedRoute === `${route.method}-${route.path}` ? null : `${route.method}-${route.path}`)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${getMethodColor(route.method)}`}>
                            {route.method}
                          </span>
                          <code className="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100">
                            {route.path}
                          </code>
                          {route.auth_required && (
                            <Lock className="w-4 h-4 text-gray-400" title={t('api.authRequired', 'Authentication Required')} />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${route.method} ${route.path}`, `${route.method}-${route.path}`);
                            }}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            title={t('api.copy', 'Copy')}
                          >
                            {copiedRoute === `${route.method}-${route.path}` ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {route.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-20">
                            {route.description}
                          </p>
                        )}
                      </div>

                      {expandedRoute === `${route.method}-${route.path}` && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                        {route.parameters && route.parameters.length > 0 && (
                            <div className="mb-4">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {t('api.parameters', 'Parameters')}
                              </h4>
                              <div className="space-y-2">
                                {route.parameters.map((param, idx) => (
                                  <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                                        {param.name}
                                      </code>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {param.type}
                                      </span>
                                      {param.required && (
                                        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">
                                          required
                                        </span>
                                      )}
                                    </div>
                                    {param.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {param.description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {route.request_body && (
                            <div className="mb-4">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {t('api.requestBody', 'Request Body')}
                              </h4>
                              <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                {JSON.stringify(route.request_body, null, 2)}
                              </pre>
                            </div>
                          )}

                          {route.response_example && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {t('api.responseExample', 'Response Example')}
                              </h4>
                              <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                {JSON.stringify(route.response_example, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}