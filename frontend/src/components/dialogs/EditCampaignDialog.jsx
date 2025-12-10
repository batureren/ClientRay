import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Edit, UserPlus, UserX } from 'lucide-react';
import api from '@/services/api';

const EditCampaignDialog = ({ open, onOpenChange, campaign, onCampaignUpdated }) => {
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    goal_type: '',
    goal_value: '',
    goal_currency: 'USD',
    start_date: null,
    end_date: null,
    is_open_campaign: false,
    status: '',
    auto_join: true 
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const currencies = [
    { value: 'USD', label: 'USD ($)', symbol: '$' },
    { value: 'EUR', label: 'EUR (€)', symbol: '€' },
    { value: 'GBP', label: 'GBP (£)', symbol: '£' },
    { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
    { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
    { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
    { value: 'TRY', label: 'TRY (₺)', symbol: '₺' }
  ];

  const leadGoalTypes = [
    { value: 'conversion', label: t('campaignsTab.goalType.conversion') },
    { value: 'new_added', label: t('campaignsTab.goalType.newAdded') },
  ];

  const accountGoalTypes = [
    { value: 'sales', label: t('campaignsTab.goalType.sales') },
    { value: 'meetings', label: t('campaignsTab.goalType.meetings') }
  ];
  
  const statusOptions = [
    { value: 'active', label: t('campaignsTab.status.active') },
    { value: 'inactive', label: t('campaignsTab.status.inactive') },
    { value: 'completed', label: t('campaignsTab.status.completed') },
    { value: 'paused', label: t('campaignsTab.status.paused') }
  ];

  const getAvailableGoalTypes = () => {
    return campaign?.campaign_type === 'lead' ? leadGoalTypes : accountGoalTypes;
  };

  const shouldShowCurrency = () => {
    return campaign?.campaign_type === 'account' && formData.goal_type === 'sales';
  };

  useEffect(() => {
    if (open && campaign) {
      // Helper function to format date for input
      const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try {
          const date = new Date(dateString);
          return date.toISOString().split('T')[0];
        } catch (error) {
          console.error('Error formatting date:', error);
          return '';
        }
      };

      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        goal_type: campaign.goal_type || '',
        goal_value: campaign.goal_value?.toString() || '',
        goal_currency: campaign.goal_currency || 'USD',
        start_date: formatDateForInput(campaign.start_date),
        end_date: formatDateForInput(campaign.end_date),
        is_open_campaign: campaign.is_open_campaign || false,
        status: campaign.status || 'active',
        auto_join: campaign.auto_join !== undefined ? campaign.auto_join : true
      });
      setErrors({});
    }
  }, [open, campaign]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('campaignDialog.validation.nameRequired');
    }

    if (!formData.goal_type) {
      newErrors.goal_type = t('campaignDialog.validation.goalTypeRequired');
    }

    if (formData.goal_value && isNaN(formData.goal_value)) {
      newErrors.goal_value = t('campaignDialog.validation.goalValueInvalid');
    }

    if (shouldShowCurrency() && !formData.goal_currency) {
      newErrors.goal_currency = 'Currency is required for sales campaigns';
    }

    if (!formData.is_open_campaign) {
      if (!formData.start_date) {
        newErrors.start_date = t('campaignDialog.validation.startDateRequired');
      }
      if (!formData.end_date) {
        newErrors.end_date = t('campaignDialog.validation.endDateRequired');
      }
      if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
        newErrors.end_date = t('campaignDialog.validation.endDateAfterStart');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        goal_value: formData.goal_value ? formData.goal_value : null,
        goal_currency: shouldShowCurrency() ? formData.goal_currency : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date && !formData.is_open_campaign ? formData.end_date : null
      };

      await api.put(`/campaigns/${campaign.id}`, payload);
      onCampaignUpdated();
    } catch (error) {
      console.error('Error updating campaign:', error);
      setErrors({ submit: error.response?.data?.error || t('campaignDialog.errors.updateFailed') });
    }
    setLoading(false);
  };

  const handleOpenCampaignChange = (checked) => {
    handleInputChange('is_open_campaign', checked);
    if (checked) {
      handleInputChange('end_date', null);
    }
  };

  const getCurrencySymbol = () => {
    const currency = currencies.find(c => c.value === formData.goal_currency);
    return currency ? currency.symbol : '$';
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t('editCampaignDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('editCampaignDialog.description', { name: campaign.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campaign Name */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="name">{t('createCampaignDialog.fields.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={t('createCampaignDialog.placeholders.name')}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">{t('createCampaignDialog.fields.description')}</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={(e) => handleInputChange('description', e.target.value)} 
                placeholder={t('createCampaignDialog.placeholders.description')} 
                rows={3} 
              />
            </div>

            {/* Goal Type */}
            <div className="space-y-2">
              <Label>{t('createCampaignDialog.fields.goalType')} *</Label>
              <Select value={formData.goal_type} onValueChange={(value) => handleInputChange('goal_type', value)}>
                <SelectTrigger className={errors.goal_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('createCampaignDialog.placeholders.goalType')} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableGoalTypes().map((goalType) => (
                    <SelectItem key={goalType.value} value={goalType.value}>
                      {goalType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.goal_type && <p className="text-sm text-red-600">{errors.goal_type}</p>}
            </div>

            {/* Goal Value */}
            <div className="space-y-2">
              <Label htmlFor="goal_value">
                {t('createCampaignDialog.fields.goalValue')}
                {shouldShowCurrency() && ` (${getCurrencySymbol()})`}
              </Label>
              <Input 
                id="goal_value" 
                type="number" 
                min="0" 
                step="0.01" 
                value={formData.goal_value} 
                onChange={(e) => handleInputChange('goal_value', e.target.value)} 
                placeholder={shouldShowCurrency() ? `0.00 ${getCurrencySymbol()}` : t('createCampaignDialog.placeholders.goalValue')} 
                className={errors.goal_value ? 'border-red-500' : ''} 
              />
              {errors.goal_value && <p className="text-sm text-red-600">{errors.goal_value}</p>}
            </div>

            {/* Currency Picker - only for sales campaigns */}
            {shouldShowCurrency() && (
              <div className="space-y-2">
                <Label>{t('createCampaignDialog.fields.currency')} *</Label>
                <Select 
                  value={formData.goal_currency} 
                  onValueChange={(value) => handleInputChange('goal_currency', value)}
                >
                  <SelectTrigger className={errors.goal_currency ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.goal_currency && <p className="text-sm text-red-600">{errors.goal_currency}</p>}
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>{t('campaignDetails.overview.status')}</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('createCampaignDialog.placeholders.status')} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto Join Toggle */}
            <div className="md:col-span-2 flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
              <Switch
                id="auto_join"
                checked={formData.auto_join}
                onCheckedChange={(checked) => handleInputChange('auto_join', checked)}
              />
              <div className="flex items-center gap-2">
                {formData.auto_join ? (
                  <UserPlus className="h-4 w-4 text-green-600" />
                ) : (
                  <UserX className="h-4 w-4 text-orange-600" />
                )}
                <Label htmlFor="auto_join" className="flex-1 cursor-pointer">
                  <span className="font-medium">
                    {formData.auto_join ? 'Auto-join enabled' : 'Manual join only'}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formData.auto_join 
                      ? 'Leads/accounts will automatically join this campaign when they meet the criteria'
                      : 'Participants must be manually added to this campaign'
                    }
                  </span>
                </Label>
              </div>
            </div>

            {/* Open Campaign Toggle */}
            <div className="md:col-span-2 flex items-center space-x-2">
              <Switch
                id="is_open_campaign"
                checked={formData.is_open_campaign}
                onCheckedChange={handleOpenCampaignChange}
              />
              <Label htmlFor="is_open_campaign" className="flex-1">
                {t('createCampaignDialog.fields.openCampaign')}
                <span className="block text-sm text-muted-foreground">
                  {t('createCampaignDialog.fields.openCampaignHelp')}
                </span>
              </Label>
            </div>

            {/* Date Range (only if not open campaign) */}
            {!formData.is_open_campaign && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start_date">{t('createCampaignDialog.fields.startDate')} *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date || ""}
                    onChange={(e) => handleInputChange("start_date", e.target.value)}
                    className={errors.start_date ? "border-red-500" : ""}
                    required
                  />
                  {errors.start_date && <p className="text-sm text-red-600">{errors.start_date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t('createCampaignDialog.fields.endDate')} *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ""}
                    onChange={(e) => handleInputChange("end_date", e.target.value)}
                    className={errors.end_date ? "border-red-500" : ""}
                    required
                  />
                  {errors.end_date && <p className="text-sm text-red-600">{errors.end_date}</p>}
                </div>
              </>
            )}
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t('common.loading') : t('editCampaignDialog.buttons.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditCampaignDialog;