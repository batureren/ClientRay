// components/dialogs/EditProductDialog.jsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import api from '@/services/api';

const EditProductDialog = ({ 
  open, 
  onOpenChange, 
  selectedAccount, 
  productAssignment, 
  products, 
  onProductUpdated
}) => {
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: 1,
    unit_price: '',
    discount_percentage: 0,
    status: 'quoted',
    purchase_date: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form when productAssignment changes
  useEffect(() => {
    if (productAssignment) {
      setFormData({
        product_id: productAssignment.product_id,
        quantity: productAssignment.quantity || 1,
        unit_price: productAssignment.unit_price || '',
        discount_percentage: productAssignment.discount_percentage || 0,
        status: productAssignment.status || 'quoted',
      purchase_date: productAssignment.purchase_date 
        ? new Date(productAssignment.purchase_date).toISOString().split('T')[0]
        : '',
        notes: productAssignment.notes || ''
      })
    }
  }, [productAssignment])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedAccount || !productAssignment) {
      alert('Missing account or product assignment information')
      return
    }

    setIsSubmitting(true)
    try {
      await api.put(`/accounts/${selectedAccount.id}/products/${productAssignment.id}`, {
        product_id: formData.product_id,
        quantity: parseInt(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        discount_percentage: parseFloat(formData.discount_percentage),
        status: formData.status,
        purchase_date: formData.purchase_date || null,
        notes: formData.notes
      })

        onProductUpdated()
        onOpenChange(false)
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product. Check the console for more details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateTotal = () => {
    const quantity = parseFloat(formData.quantity) || 0
    const unitPrice = parseFloat(formData.unit_price) || 0
    const discount = parseFloat(formData.discount_percentage) || 0
    const total = quantity * unitPrice * (1 - discount / 100)
    return total.toFixed(2)
  }

  const selectedProduct = products?.find(p => p.id === parseInt(formData.product_id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Product Assignment</DialogTitle>
          <DialogDescription>
            Update the product assignment for {selectedAccount?.account_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product">Product</Label>
            <Select 
              value={formData.product_id.toString()} 
              onValueChange={(value) => {
                const product = products.find(p => p.id === parseInt(value))
                setFormData({
                  ...formData,
                  product_id: parseInt(value),
                  unit_price: product?.list_price || ''
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.product_name} ({product.product_code}) - ${product.list_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm">
                <div><strong>Category:</strong> {selectedProduct.product_category}</div>
                <div><strong>List Price:</strong> ${selectedProduct.list_price}</div>
                {selectedProduct.description && (
                  <div><strong>Description:</strong> {selectedProduct.description}</div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit_price">Unit Price ($)</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="purchase_date">Purchase/Payment Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              placeholder="Select date when purchased/paid"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-md">
            <div className="text-sm font-medium">
              Total Amount: ${calculateTotal()}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditProductDialog