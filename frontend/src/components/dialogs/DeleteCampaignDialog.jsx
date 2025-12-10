// components/dialogs/DeleteCampaignDialog.jsx
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { AlertTriangle } from 'lucide-react';

const DeleteCampaignDialog = ({ open, onOpenChange, campaign, onDeleteConfirmed, isLoading }) => {
  const { t } = useTranslation();

  const handleConfirm = () => {
    if (campaign) {
      onDeleteConfirmed(campaign.id);
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {t('deleteCampaignDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('deleteCampaignDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800 mb-2">
              <strong>{t('deleteCampaignDialog.campaignName')}:</strong> {campaign.name}
            </p>
            <p className="text-sm text-red-600">
              {t('deleteCampaignDialog.warning')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? t('common.loading') : t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteCampaignDialog;