// components/dialogs/DeleteAccountDialog.jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'

const DeleteAccountDialog = ({ open, onOpenChange, account, onDeleteConfirmed, isLoading }) => {
  if (!account) return null

  const handleDelete = async () => {
    try {
      await onDeleteConfirmed(account.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This action will permanently delete the Account and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete{' '}
            <strong>{account.account_name}</strong>?
          </p>
          {account.primary_contact_email && (
            <p className="text-sm text-gray-600 mt-1">
              Email: {account.primary_contact_email}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteAccountDialog