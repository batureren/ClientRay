// components/dialogs/ConvertLeadDialog.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import api from '@/services/api';

const ConvertLeadDialog = ({ open, onOpenChange, selectedLead, onLeadConverted }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [accountForm, setAccountForm] = useState({
    account_name: '', account_type: 'prospect', industry: '', description: ''
  });

  useEffect(() => {
    // Reset form when dialog opens or lead changes
    if (open && selectedLead) {
      setAccountForm({
        account_name: selectedLead.company || `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim(),
        account_type: 'prospect',
        industry: '',
        description: ''
      });
    }
  }, [open, selectedLead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    
    setIsLoading(true);
    try {
      const convertData = {
        ...accountForm,
        primary_contact_first_name: selectedLead.first_name,
        primary_contact_last_name: selectedLead.last_name,
        primary_contact_email: selectedLead.email,
        primary_contact_phone: selectedLead.phone,
        billing_address_line1: selectedLead.address_line1,
        billing_city: selectedLead.city,
        billing_state: selectedLead.state,
        billing_postal_code: selectedLead.postal_code,
        billing_country: selectedLead.country,
        website: selectedLead.website
      };
      await api.post(`/leads/${selectedLead.id}/convert`, convertData);
      onLeadConverted();
    } catch (error) {
      console.error('Error converting lead:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const accountTypes = ['prospect', 'customer', 'partner', 'vendor'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('convertLeadDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('convertLeadDialog.description', { name: `${selectedLead?.first_name} ${selectedLead?.last_name}` })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="account_name">{t('convertLeadDialog.labels.accountName')}</Label>
            <Input
              id="account_name"
              value={accountForm.account_name}
              onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_type">{t('convertLeadDialog.labels.accountType')}</Label>
              <Select value={accountForm.account_type} onValueChange={(value) => setAccountForm({...accountForm, account_type: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accountTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {t(`convertLeadDialog.accountTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="industry">{t('convertLeadDialog.labels.industry')}</Label>
              <Input
                id="industry"
                value={accountForm.industry}
                onChange={(e) => setAccountForm({...accountForm, industry: e.target.value})}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">{t('convertLeadDialog.labels.description')}</Label>
            <Textarea
              id="description"
              value={accountForm.description}
              onChange={(e) => setAccountForm({...accountForm, description: e.target.value})}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('convertLeadDialog.buttons.converting') : t('convertLeadDialog.buttons.convert')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertLeadDialog;