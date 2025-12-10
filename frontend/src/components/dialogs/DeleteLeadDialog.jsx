// components/dialogs/DeleteLeadDialog.jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'

const DeleteLeadDialog = ({ open, onOpenChange, lead, onDeleteConfirmed, isLoading }) => {
  if (!lead) return null

  const handleDelete = async () => {
    try {
      await onDeleteConfirmed(lead.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Lead</DialogTitle>
          <DialogDescription>
            This action will permanently delete the lead and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete{' '}
            <strong>{lead.first_name} {lead.last_name}</strong>?
          </p>
          {lead.email && (
            <p className="text-sm text-gray-600 mt-1">
              Email: {lead.email}
            </p>
          )}
          {lead.company && (
            <p className="text-sm text-gray-600">
              Company: {lead.company}
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
            {isLoading ? 'Deleting...' : 'Delete Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteLeadDialog