//components/email/EmailCampaignBuilder.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Building, Filter, Calendar, Send } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import api from '@/services/api';

const EmailCampaignBuilder = ({ 
  isOpen, 
  onClose, 
  onSave, 
  templates, 
  campaign = null 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    template_id: '',
    recipient_type: 'leads',
    recipient_filter: {},
    scheduled_at: '',
    status: 'draft'
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [activeStep, setActiveStep] = useState(1);
  const [savedReports, setSavedReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState('');

  // Memoize the stringified filter to use as a stable dependency
  const recipientFilterString = useMemo(() => JSON.stringify(formData.recipient_filter), [formData.recipient_filter]);

useEffect(() => {
  if (campaign) {
    const filter = typeof campaign.recipient_filter === 'string'
      ? JSON.parse(campaign.recipient_filter)
      : campaign.recipient_filter;

    setFormData({
      ...campaign,
      recipient_filter: filter || {}
    });
  } else {
      // Reset form on open or when campaign is cleared
      setFormData({
        name: '',
        subject: '',
        content: '',
        template_id: '',
        recipient_type: 'leads',
        recipient_filter: {},
        scheduled_at: '',
        status: 'draft'
      });
      setSelectedReportId('');
      setSelectedTemplate(null);
      setRecipientCount(0);
      setActiveStep(1);
    }
  }, [campaign, isOpen]);

  useEffect(() => {
    if (formData.recipient_type && isOpen) {
      const estimateRecipients = async () => {
        try {
          const endpoint = formData.recipient_type === 'leads' ? '/leads' : '/accounts';
          const filterJsonString = recipientFilterString === '{}' ? '[]' : recipientFilterString;

          const params = new URLSearchParams();
          if (filterJsonString !== '[]') {
            params.append('filters', filterJsonString);
          }

          const url = `${endpoint}/count?${params.toString()}`;
          const response = await api.get(url); // Pass the fully constructed URL
          setRecipientCount(response.data.count || 0);
        } catch (error) {
          console.error('Error estimating recipients:', error);
          setRecipientCount(0);
        }
      };
      estimateRecipients();
    }
  }, [formData.recipient_type, recipientFilterString, isOpen]);

  // Fetch saved reports when step 2 is active or recipient type changes
  useEffect(() => {
    const fetchSavedReports = async () => {
      if (activeStep === 2 && formData.recipient_type) {
        try {
          const response = await api.get(`/saved-reports?type=${formData.recipient_type}`);
          setSavedReports(response.data || []);
        } catch (error) {
          console.error('Error fetching saved reports:', error);
          setSavedReports([]);
        }
      }
    };
    fetchSavedReports();
  }, [activeStep, formData.recipient_type]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      template_id: template.id,
      subject: template.subject,
      content: template.content
    }));
  };

  const handleRecipientTypeChange = (type) => {
    setFormData(prev => ({
        ...prev,
        recipient_type: type,
        recipient_filter: {}
    }));
    setSelectedReportId(''); 
    setSavedReports([]);
  };

  const handleReportSelect = (reportId) => {
    setSelectedReportId(reportId);
    if (!reportId) {
      setFormData(prev => ({ ...prev, recipient_filter: {} }));
    } else {
      const selectedReport = savedReports.find(report => report.id.toString() === reportId);
      if (selectedReport) {
        setFormData(prev => ({ ...prev, recipient_filter: selectedReport.filters }));
      }
    }
  };

  const handleSave = async (sendNow = false) => {
    const campaignData = {
      ...formData,
      status: sendNow ? 'sending' : 'draft'
    };
    
    try {
      await onSave(campaignData, sendNow);
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {campaign ? 'Edit Campaign' : 'Create Email Campaign'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          {/* Step Progress */}
          <div className="flex items-center mb-6">
            <div className={`flex items-center ${activeStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                activeStep >= 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Campaign Details</span>
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-4"></div>
            <div className={`flex items-center ${activeStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                activeStep >= 2 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Recipients</span>
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-4"></div>
            <div className={`flex items-center ${activeStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                activeStep >= 3 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Content</span>
            </div>
          </div>

          {/* Step 1: Campaign Details */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email subject line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Send (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Recipients */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleRecipientTypeChange('leads')}
                    className={`p-4 border rounded-lg flex items-center gap-3 ${
                      formData.recipient_type === 'leads'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Users className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">Leads</div>
                      <div className="text-sm text-gray-500">Send to potential customers</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRecipientTypeChange('accounts')}
                    className={`p-4 border rounded-lg flex items-center gap-3 ${
                      formData.recipient_type === 'accounts'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Building className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">Accounts</div>
                      <div className="text-sm text-gray-500">Send to existing customers</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recipient Filters (now dynamic) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Saved Report (Optional)
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedReportId}
                    onChange={(e) => handleReportSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All {formData.recipient_type}</option>
                    {savedReports.map((report) => (
                      <option key={report.id} value={report.id}>
                        {report.report_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Estimated Recipients</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{recipientCount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Based on the selected filter.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Content */}
          {activeStep === 3 && (
            <div className="space-y-4">
              {templates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose Template (Optional)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-3 border rounded-lg cursor-pointer hover:border-blue-300 ${
                          selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{template.subject}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Content *
                </label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Email Compliance Reminder
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Include an unsubscribe link in every email using {'{{unsubscribe_link}}'}.</li>
                        <li>Ensure you have permission to email these contacts.</li>
                        <li>Follow CAN-SPAM and GDPR regulations.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex space-x-3">
            {activeStep > 1 && (
              <button
                onClick={() => setActiveStep(prev => prev - 1)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Previous
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            
            {activeStep < 3 ? (
              <button
                onClick={() => setActiveStep(prev => prev + 1)}
                disabled={
                  (activeStep === 1 && (!formData.name || !formData.subject)) ||
                  (activeStep === 2 && !formData.recipient_type)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={!formData.name || !formData.subject || !formData.content}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={!formData.name || !formData.subject || !formData.content}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailCampaignBuilder;