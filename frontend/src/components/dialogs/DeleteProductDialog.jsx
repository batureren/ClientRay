// components/dialogs/DeleteProductDialog.jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'

const DeleteProductDialog = ({ open, onOpenChange, product, onDeleteConfirmed, isLoading }) => {
  if (!product) return null

  const handleDelete = async () => {
    await onDeleteConfirmed(product.id)
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the product from the database.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete the product:{' '}
            <strong>{product.product_name}</strong>?
          </p>
          <p className="text-sm text-gray-600 mt-1 font-mono">
            SKU: {product.product_code}
          </p>
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
            {isLoading ? 'Deleting...' : 'Delete Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteProductDialog