// components/dialogs/CreateAccountCallDialog.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { PhoneCall, Calendar, User, MessageSquare, Clock, Tag } from 'lucide-react';
import api from '@/services/api';

const CreateAccountCallDialog = ({ open, onOpenChange, account, onCallCreated }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    category: '',
    call_outcome: 'Successful',
    call_date: '',
    call_duration: '',
    contact_person: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      
      setFormData({
        category: '',
        call_outcome: 'Successful',
        call_date: localDateTime,
        contact_person: account?.primary_contact_first_name && account?.primary_contact_last_name 
          ? `${account.primary_contact_first_name} ${account.primary_contact_last_name}`
          : '',
        call_duration: '',
        notes: ''
      });
      setErrors({});
    }
  }, [open, account]);

  const categories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support', 'Meeting', 'Negotiation'];
  const outcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected', 'Meeting Scheduled'];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.category) newErrors.category = t('createAccountCallDialog.errors.categoryRequired');
    if (!formData.call_date) newErrors.call_date = t('createAccountCallDialog.errors.dateRequired');
    if (formData.call_duration && (isNaN(formData.call_duration) || parseInt(formData.call_duration) < 0)) {
      newErrors.call_duration = t('createAccountCallDialog.errors.durationInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const callData = {
        account_id: account.id,
        category: formData.category,
        call_outcome: formData.call_outcome,
        call_date: formData.call_date,
        call_duration: formData.call_duration ? parseInt(formData.call_duration) : null,
        contact_person: formData.contact_person || null,
        notes: formData.notes || null
      };
      const response = await api.post('/account-calls', callData);
      onCallCreated?.(response.data.call);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating account call:', error);
      setErrors({ submit: t('createAccountCallDialog.errors.submitFailed') });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" />{t('createAccountCallDialog.title')}</DialogTitle>
          <DialogDescription>{t('createAccountCallDialog.description', { name: account?.account_name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category" className="flex items-center gap-2"><Tag className="h-4 w-4" />{t('createAccountCallDialog.labels.category')}</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger><SelectValue placeholder={t('createAccountCallDialog.placeholders.selectCategory')} /></SelectTrigger>
              <SelectContent>
                {categories.map((category) => ( <SelectItem key={category} value={category}>{t(`profile.categories.${category.toLowerCase()}`, { defaultValue: category })}</SelectItem> ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-red-600">{errors.category}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="call_outcome">{t('createAccountCallDialog.labels.outcome')}</Label>
            <Select value={formData.call_outcome} onValueChange={(value) => handleInputChange('call_outcome', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {outcomes.map((outcome) => {
                  const outcomeKey = outcome.replace(' ', '_').toLowerCase();
                  return ( <SelectItem key={outcome} value={outcome}>{t(`profile.callOutcomes.${outcomeKey}`, { defaultValue: outcome })}</SelectItem> );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="call_date" className="flex items-center gap-2"><Calendar className="h-4 w-4" />{t('createAccountCallDialog.labels.dateTime')}</Label>
            <Input id="call_date" type="datetime-local" value={formData.call_date} onChange={(e) => handleInputChange('call_date', e.target.value)} className={errors.call_date ? 'border-red-500' : ''} />
            {errors.call_date && <p className="text-sm text-red-600">{errors.call_date}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person" className="flex items-center gap-2"><User className="h-4 w-4" />{t('createAccountCallDialog.labels.contactPerson')}</Label>
            <Input id="contact_person" value={formData.contact_person} onChange={(e) => handleInputChange('contact_person', e.target.value)} placeholder={t('createAccountCallDialog.placeholders.contactPerson')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="call_duration" className="flex items-center gap-2"><Clock className="h-4 w-4" />{t('createAccountCallDialog.labels.duration')}</Label>
            <Input id="call_duration" type="number" min="0" value={formData.call_duration} onChange={(e) => handleInputChange('call_duration', e.target.value)} placeholder={t('createAccountCallDialog.placeholders.optional')} className={errors.call_duration ? 'border-red-500' : ''} />
            {errors.call_duration && <p className="text-sm text-red-600">{errors.call_duration}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />{t('createAccountCallDialog.labels.notes')}</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder={t('createAccountCallDialog.placeholders.notes')} rows={3} />
          </div>
          {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t('createAccountCallDialog.buttons.logging') : t('createAccountCallDialog.buttons.logCall')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateAccountCallDialog;