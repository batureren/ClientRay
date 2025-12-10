import { useState, useEffect, useMemo } from 'react' // Import useMemo
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import api from '@/services/api';

const AssignProductDialog = ({ open, onOpenChange, selectedAccount, products, onProductAssigned}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({
    product_id: '', 
    quantity: 1, 
    unit_price: '', 
    discount_percentage: 0,
    status: 'quoted',
    purchase_date: '',
    notes: ''
  })

  // 1. Memoize the list of available products so it's not recalculated on every render
  const availableProducts = useMemo(() => {
    if (!products) return []
    // 2. Filter for products that are BOTH active AND have stock greater than 0
    return products.filter(p => p.is_active && p.stock_quantity > 0)
  }, [products])

  useEffect(() => {
    if (!open) {
      setAssignmentForm({
        product_id: '', quantity: 1, unit_price: '', discount_percentage: 0, status: 'quoted', purchase_date: '', notes: ''
      })
    }
  }, [open])

const handleSubmit = async (e) => {
  e.preventDefault()
  if (!selectedAccount || !assignmentForm.product_id) return
  
  const selectedProduct = availableProducts.find(p => p.id.toString() === assignmentForm.product_id);
  if (selectedProduct && parseInt(assignmentForm.quantity) > selectedProduct.stock_quantity) {
    alert(`Cannot assign quantity of ${assignmentForm.quantity}. Only ${selectedProduct.stock_quantity} remaining in stock.`);
    return;
  }

  setIsLoading(true)
  try {
    await api.post(`/accounts/${selectedAccount.id}/products`, {
      ...assignmentForm,
      quantity: parseInt(assignmentForm.quantity) || 1,
      unit_price: parseFloat(assignmentForm.unit_price) || 0,
      discount_percentage: parseFloat(assignmentForm.discount_percentage) || 0
    })
    
    onOpenChange(false)
    onProductAssigned()
    
  } catch (error) {
    console.error('Error assigning product:', error)
    const errorMessage = error.message || 'Failed to assign product. Please try again.'
    alert(errorMessage)
  } finally {
    setIsLoading(false)
  }
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Product to Account</DialogTitle>
          <DialogDescription>
            Assign a product to {selectedAccount?.account_name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product_select">Product *</Label>
            <Select 
              value={assignmentForm.product_id} 
              onValueChange={(value) => {
                const selected = products.find(p => p.id.toString() === value)
                setAssignmentForm((prev) => ({
                  ...prev,
                  product_id: value,
                  unit_price: selected?.list_price?.toString() || ''
                }))
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {/* 3. Use the new availableProducts list to render the options */}
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.product_name} ({product.product_code}) - Stock: {product.stock_quantity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* ... The rest of your form remains the same ... */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" type="number" min="1" value={assignmentForm.quantity} onChange={(e) => setAssignmentForm({...assignmentForm, quantity: e.target.value})} required />
            </div>
            <div>
              <Label htmlFor="unit_price">Unit Price ($)</Label>
              <Input id="unit_price" type="number" step="0.01" min="0" value={assignmentForm.unit_price} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, unit_price: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount_percentage">Discount (%)</Label>
              <Input id="discount_percentage" type="number" step="0.01" min="0" max="100" value={assignmentForm.discount_percentage} onChange={(e) => setAssignmentForm({...assignmentForm, discount_percentage: e.target.value})} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={assignmentForm.status} onValueChange={(value) => setAssignmentForm({...assignmentForm, status: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              value={assignmentForm.purchase_date}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, purchase_date: e.target.value })}
              placeholder="Select date when purchased/paid"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={assignmentForm.notes} onChange={(e) => setAssignmentForm({...assignmentForm, notes: e.target.value})} placeholder="Optional notes..." />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !assignmentForm.product_id}>
              {isLoading ? 'Assigning...' : 'Assign Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AssignProductDialog