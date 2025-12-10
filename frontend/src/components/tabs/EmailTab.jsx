import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Send, 
  Edit3, 
  Trash2, 
  Users, 
  Building, 
  Calendar,
  BarChart3,
  FileText,
  Eye,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

import EmailCampaignBuilder from '../email/EmailCampaignBuiler';
import EmailTemplateModal from '../email/EmailTemplateModal';
import TemplatePreviewModal from '../email/TemplatePreviewModal';
import api from '@/services/api';

const EmailTab = ({ canEdit, canDelete }) => {
  const [activeSubTab, setActiveSubTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [error, setError] = useState(null);
  const [previewingTemplate, setPreviewingTemplate] = useState(null);

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get('/mailing/campaigns');
      setCampaigns(response.data.data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const response = await api.get('/mailing/templates');
      setTemplates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates');
    }
  };

  // Fetch email service status
  const fetchEmailStatus = async () => {
    try {
      const status = await api.get('/email/status');
      setEmailStatus(status.data);
    } catch (error) {
      console.error('Error fetching email status:', error);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
    fetchEmailStatus();
  }, []);

  // Save campaign (create or update)
  const saveCampaign = async (campaignData, sendNow = false) => {
    try {
      setLoading(true);
      let response;
      
      if (editingCampaign) {
        response = await api.put(`/mailing/campaigns/${editingCampaign.id}`, campaignData);
      } else {
        response = await api.post('/mailing/campaigns', campaignData);
      }

      if (sendNow && response.data.data) {
        await sendCampaign(response.data.data.id);
      }

      await fetchCampaigns();
      setShowCampaignModal(false);
      setEditingCampaign(null);
    } catch (error) {
      console.error('Error saving campaign:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send campaign
  const sendCampaign = async (campaignId) => {
    try {
      setLoading(true);
      await api.post(`/mailing/campaigns/${campaignId}/send`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
      setError('Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await api.delete(`/mailing/campaigns/${campaignId}`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setError('Failed to delete campaign');
    }
  };

  // Save template
  const saveTemplate = async (templateData) => {
    try {
      setLoading(true);
      if (editingTemplate) {
        await api.put(`/mailing/templates/${editingTemplate.id}`, templateData);
      } else {
        await api.post('/mailing/templates', templateData);
      }
      await fetchTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const deleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await api.delete(`/mailing/templates/${templateId}`);
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setError('Failed to delete template');
    }
  };

  // Get status color and icon
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'sending':
        return { color: 'bg-blue-100 text-blue-800', icon: Clock };
      case 'failed':
        return { color: 'bg-red-100 text-red-800', icon: AlertCircle };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: FileText };
    }
  };

  const CampaignList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Campaigns</h3>
          {emailStatus && (
            <p className="text-sm text-gray-600">
              Current provider: <span className="font-medium">{emailStatus.provider}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/email-setup'}
            className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Email Settings
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingCampaign(null);
                setShowCampaignModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {campaigns.map((campaign) => {
          const statusDisplay = getStatusDisplay(campaign.status);
          const StatusIcon = statusDisplay.icon;
          const isActive = campaign.status === 'sending';
          
          return (
            <div key={campaign.id} className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{campaign.subject}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className={`px-2 py-1 rounded flex items-center gap-1 ${statusDisplay.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {campaign.status}
                      {isActive && <Zap className="h-3 w-3 ml-1 text-blue-600" />}
                    </span>
                    <span className="flex items-center gap-1">
                      {campaign.recipient_type === 'leads' ? <Users className="h-3 w-3" /> : <Building className="h-3 w-3" />}
                      {campaign.recipient_type}
                    </span>
                    <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                    {campaign.sent_count && (
                      <span>{campaign.sent_count} sent</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="View Analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCampaign(campaign);
                          setShowCampaignModal(true);
                        }}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => sendCampaign(campaign.id)}
                          disabled={loading}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                          title="Send Campaign"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {campaign.scheduled_at && (
                <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
        
        {campaigns.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No email campaigns yet</p>
            <p className="text-sm">Create your first campaign to start sending targeted emails</p>
          </div>
        )}
      </div>
    </div>
  );

  const TemplateList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Email Templates</h3>
        {canEdit && (
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                <div className="text-xs text-gray-500 mt-2">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                  {template.used_count && (
                    <span className="ml-4">Used in {template.used_count} campaigns</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewingTemplate(template)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowTemplateModal(true);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {templates.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No email templates yet</p>
            <p className="text-sm">Create templates to reuse email content across campaigns</p>
          </div>
        )}
      </div>
    </div>
  );

  const CampaignAnalytics = ({ campaign }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Campaign Analytics: {campaign.name}</h3>
        <button
          onClick={() => setSelectedCampaign(null)}
          className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded hover:bg-gray-100"
        >
          ← Back to Campaigns
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{campaign.sent_count || 0}</div>
          <div className="text-sm text-gray-600">Emails Sent</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{campaign.delivered_count || 0}</div>
          <div className="text-sm text-gray-600">
            Delivered ({campaign.sent_count ? ((campaign.delivered_count || 0) / campaign.sent_count * 100).toFixed(1) : 0}%)
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-purple-600">{campaign.opened_count || 0}</div>
          <div className="text-sm text-gray-600">
            Opened ({campaign.delivered_count ? ((campaign.opened_count || 0) / campaign.delivered_count * 100).toFixed(1) : 0}%)
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-orange-600">{campaign.clicked_count || 0}</div>
          <div className="text-sm text-gray-600">
            Clicked ({campaign.opened_count ? ((campaign.clicked_count || 0) / campaign.opened_count * 100).toFixed(1) : 0}%)
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium mb-4">Campaign Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Status:</span>
            <div className="font-medium">{campaign.status}</div>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>
            <div className="font-medium">{new Date(campaign.created_at).toLocaleDateString()}</div>
          </div>
          <div>
            <span className="text-gray-500">Recipient Type:</span>
            <div className="font-medium">{campaign.recipient_type}</div>
          </div>
          {campaign.scheduled_at && (
            <div>
              <span className="text-gray-500">Scheduled:</span>
              <div className="font-medium">{new Date(campaign.scheduled_at).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSubTab('campaigns')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeSubTab === 'campaigns'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Mail className="h-4 w-4 inline mr-2" />
            Campaigns
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeSubTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Templates
          </button>
        </nav>
      </div>

      {/* Content */}
      {selectedCampaign ? (
        <CampaignAnalytics campaign={selectedCampaign} />
      ) : activeSubTab === 'campaigns' ? (
        <CampaignList />
      ) : (
        <TemplateList />
      )}

      {/* Modals */}
      {showCampaignModal && (
        <EmailCampaignBuilder
          isOpen={showCampaignModal}
          onClose={() => {
            setShowCampaignModal(false);
            setEditingCampaign(null);
          }}
          onSave={saveCampaign}
          templates={templates}
          
          campaign={editingCampaign}
        />
      )}

      {showTemplateModal && (
        <EmailTemplateModal
          isOpen={showTemplateModal}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSave={saveTemplate}
          template={editingTemplate}
          
        />
      )}

      {previewingTemplate && (
        <TemplatePreviewModal
          isOpen={!!previewingTemplate}
          onClose={() => setPreviewingTemplate(null)}
          template={previewingTemplate}
        />
      )}
    </div>
  );
};

export default EmailTab;