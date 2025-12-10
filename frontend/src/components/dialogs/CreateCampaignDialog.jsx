// components/dialogs/CreateCampaignDialog.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Target, Users, Building, UserPlus, UserX } from 'lucide-react';
import { format } from 'date-fns';
import api from '@/services/api';

const CreateCampaignDialog = ({ open, onOpenChange, onCampaignCreated }) => {
  const { t } = useTranslation();
  
const [formData, setFormData] = useState({
  name: '',
  description: '',
  campaign_type: null,
  goal_type: null,
  goal_value: '',
  goal_currency: 'USD',
  start_date: null,
  end_date: null,
  is_open_campaign: false,
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
    // { value: 'status_change', label: t('campaignsTab.goalType.statusChange') }
  ];

  const accountGoalTypes = [
    { value: 'sales', label: t('campaignsTab.goalType.sales') },
    // { value: 'revenue', label: t('campaignsTab.goalType.revenue') },
    { value: 'meetings', label: t('campaignsTab.goalType.meetings') }
  ];

  const getAvailableGoalTypes = () => {
    return formData.campaign_type === 'lead' ? leadGoalTypes : accountGoalTypes;
  };

  const shouldShowCurrency = () => {
    return formData.campaign_type === 'account' && formData.goal_type === 'sales';
  };

useEffect(() => {
  if (open) {
    setFormData({
      name: '',
      description: '',
      campaign_type: null,
      goal_type: null,
      goal_value: '',
      goal_currency: 'USD',
      start_date: null,
      end_date: null,
      is_open_campaign: false,
      auto_join: true
    });
    setErrors({});
  }
}, [open]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCampaignTypeChange = (value) => {
    setFormData(prev => ({
      ...prev,
      campaign_type: value,
      goal_type: '',
      goal_currency: 'USD'
    }));
    if (errors.campaign_type) {
      setErrors(prev => ({ ...prev, campaign_type: null }));
    }
  };

  const handleGoalTypeChange = (value) => {
    setFormData(prev => ({
      ...prev,
      goal_type: value,
      goal_currency: value === 'sales' ? prev.goal_currency : 'USD'
    }));
    if (errors.goal_type) {
      setErrors(prev => ({ ...prev, goal_type: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('createCampaignDialog.validation.nameRequired');
    }

    if (!formData.campaign_type) {
      newErrors.campaign_type = t('createCampaignDialog.validation.typeRequired');
    }

    if (!formData.goal_type) {
      newErrors.goal_type = t('createCampaignDialog.validation.goalTypeRequired');
    }

    if (formData.goal_value && isNaN(formData.goal_value)) {
      newErrors.goal_value = t('createCampaignDialog.validation.goalValueInvalid');
    }

    if (shouldShowCurrency() && !formData.goal_currency) {
      newErrors.goal_currency = 'Currency is required for sales campaigns';
    }

    if (!formData.is_open_campaign) {
      if (!formData.start_date) {
        newErrors.start_date = t('createCampaignDialog.validation.startDateRequired');
      }
      if (!formData.end_date) {
        newErrors.end_date = t('createCampaignDialog.validation.endDateRequired');
      }
      if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
        newErrors.end_date = t('createCampaignDialog.validation.endDateAfterStart');
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
        start_date: formData.start_date ? format(formData.start_date, 'yyyy-MM-dd') : null,
        end_date: formData.end_date && !formData.is_open_campaign ? format(formData.end_date, 'yyyy-MM-dd') : null
      };

      await api.post('/campaigns', payload);
      onCampaignCreated();
    } catch (error) {
      console.error('Error creating campaign:', error);
      setErrors({ submit: error.response?.data?.error || t('createCampaignDialog.errors.createFailed') });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('createCampaignDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('createCampaignDialog.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Campaign Type */}
            <div className="space-y-2">
              <Label>{t('createCampaignDialog.fields.type')} *</Label>
              <Select value={formData.campaign_type} onValueChange={handleCampaignTypeChange}>
                <SelectTrigger className={errors.campaign_type ? 'border-red-500' : ''}>
                <SelectValue placeholder={t('createCampaignDialog.placeholders.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('campaignsTab.type.lead')}
                    </div>
                  </SelectItem>
                  <SelectItem value="account">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {t('campaignsTab.type.account')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.campaign_type && <p className="text-sm text-red-600">{errors.campaign_type}</p>}
            </div>

            {/* Goal Type */}
            <div className="space-y-2">
              <Label>{t('createCampaignDialog.fields.goalType')} *</Label>
              <Select 
                value={formData.goal_type} 
                onValueChange={handleGoalTypeChange}
                disabled={!formData.campaign_type}
              >
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
            <Button type="submit" disabled={loading}>
              {loading ? t('createCampaignDialog.buttons.creating') : t('createCampaignDialog.buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;