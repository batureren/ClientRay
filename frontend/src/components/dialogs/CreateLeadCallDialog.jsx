// components/dialogs/CreateLeadCallDialog.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Phone, Clock, MessageSquare } from 'lucide-react';

const CreateLeadCallDialog = ({ open, onOpenChange, lead, onCallLogged }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    category: 'Informational',
    notes: '',
    call_duration: '',
    call_outcome: 'Successful',
    call_date: '',
    call_time: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().slice(0, 5);
      setFormData(prev => ({ ...prev, call_date: date, call_time: time }));
    } else {
      setFormData({ category: 'Informational', notes: '', call_duration: '', call_outcome: 'Successful', call_date: '', call_time: '' });
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.call_date || !formData.call_time) {
      alert(t('createLeadCallDialog.errors.dateTimeRequired'));
      return;
    }
    setIsLoading(true);
    try {
      const callDateTime = `${formData.call_date} ${formData.call_time}:00`;
      const callData = {
        lead_id: lead.id,
        category: formData.category,
        notes: formData.notes.trim() || null,
        call_duration: formData.call_duration ? parseInt(formData.call_duration) : null,
        call_outcome: formData.call_outcome,
        call_date: callDateTime
      };
      await api.post('/calls', callData);
      onCallLogged();
    } catch (error) {
      console.error('Error logging call:', error);
      alert(t('createLeadCallDialog.errors.submitFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const categories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support'];
  const outcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Phone className="h-5 w-5" />{t('createLeadCallDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createLeadCallDialog.description.base', { name: `${lead?.first_name} ${lead?.last_name}` })}
            {lead?.company && ` ${t('createLeadCallDialog.description.atCompany', { company: lead.company })}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">{t('createLeadCallDialog.labels.category')}</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger><SelectValue placeholder={t('createLeadCallDialog.placeholders.selectCategory')} /></SelectTrigger>
              <SelectContent>
                {categories.map(category => ( <SelectItem key={category} value={category}>{t(`profile.categories.${category.toLowerCase()}`, { defaultValue: category })}</SelectItem> ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="call_date">{t('createLeadCallDialog.labels.date')}</Label>
              <Input id="call_date" type="date" value={formData.call_date} onChange={(e) => setFormData(prev => ({ ...prev, call_date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="call_time">{t('createLeadCallDialog.labels.time')}</Label>
              <Input id="call_time" type="time" value={formData.call_time} onChange={(e) => setFormData(prev => ({ ...prev, call_time: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="call_outcome">{t('createLeadCallDialog.labels.outcome')}</Label>
            <Select value={formData.call_outcome} onValueChange={(value) => setFormData(prev => ({ ...prev, call_outcome: value }))}>
              <SelectTrigger><SelectValue placeholder={t('createLeadCallDialog.placeholders.selectOutcome')} /></SelectTrigger>
              <SelectContent>
                {outcomes.map(outcome => {
                   const outcomeKey = outcome.replace(' ', '_').toLowerCase();
                   return ( <SelectItem key={outcome} value={outcome}>{t(`profile.callOutcomes.${outcomeKey}`, { defaultValue: outcome })}</SelectItem> );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="call_duration" className="flex items-center gap-2"><Clock className="h-4 w-4" />{t('createLeadCallDialog.labels.duration')}</Label>
            <Input id="call_duration" type="number" min="1" max="999" placeholder={t('createLeadCallDialog.placeholders.optional')} value={formData.call_duration} onChange={(e) => setFormData(prev => ({ ...prev, call_duration: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />{t('createLeadCallDialog.labels.notes')}</Label>
            <Textarea id="notes" placeholder={t('createLeadCallDialog.placeholders.notes')} value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? t('createLeadCallDialog.buttons.logging') : t('createLeadCallDialog.buttons.logCall')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateLeadCallDialog;