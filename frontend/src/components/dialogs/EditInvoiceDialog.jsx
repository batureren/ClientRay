// EditInvoiceDialog.jsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Plus, Trash2, User, Edit2 } from 'lucide-react'
import api from '@/services/api'

export const EditInvoiceDialog = ({ open, onOpenChange, invoice, onInvoiceUpdated, user }) => {
  const [formData, setFormData] = useState({})
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (invoice && open) {
      setFormData({
        issue_date: invoice.issue_date.split('T')[0],
        due_date: invoice.due_date.split('T')[0],
        tax_rate: invoice.tax_rate || 0,
        discount_amount: invoice.discount_amount || 0,
        status: invoice.status,
        notes: invoice.notes || '',
        terms: invoice.terms || ''
      })
      // Ensure items have currency field
      const itemsWithCurrency = (invoice.items || []).map(item => ({
        ...item,
        currency: item.currency || 'USD'
      }))
      setItems(itemsWithCurrency)
      fetchProducts()
    }
  }, [invoice, open])

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products')
      setProducts(response.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const getUserDisplayName = () => {
    if (!user) return '';
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    return user.name || user.username || '';
  }

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId))
    if (product) {
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        product_code: product.product_code,
        product_name: product.product_name,
        description: product.description || '',
        unit_price: product.list_price || 0,
        currency: product.currency || 'USD'
      }
      setItems(newItems)
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, {
      product_id: null,
      product_code: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_rate: 0,
      currency: 'USD'
    }])
  }

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const calculateItemTotal = (item) => {
    const subtotal = item.quantity * item.unit_price
    const discountAmount = (subtotal * (item.discount_percent || 0)) / 100
    const taxableAmount = subtotal - discountAmount
    const taxAmount = (taxableAmount * (item.tax_rate || 0)) / 100
    return taxableAmount + taxAmount
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (items.some(item => !item.product_name || item.quantity <= 0 || item.unit_price < 0)) {
      alert('Please fill in all item details correctly')
      return
    }

    setLoading(true)
    try {
      await api.put(`/invoices/${invoice.id}`, {
        ...formData,
        items: items.map(item => ({
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          discount_percent: parseFloat(item.discount_percent || 0),
          tax_rate: parseFloat(item.tax_rate || 0),
          currency: item.currency || 'USD'
        }))
      })
      
      onInvoiceUpdated()
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice {invoice?.invoice_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata: Creator and Current Editor */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
             <div className="space-y-1">
               <Label className="text-xs text-muted-foreground">Originally Created By</Label>
               <div className="flex items-center text-sm font-medium">
                  <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {invoice?.created_by_name || 'Unknown'}
               </div>
             </div>
             {user && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Currently Editing As</Label>
                  <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      {getUserDisplayName()}
                  </div>
                </div>
             )}
          </div>

          {/* Dates and Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Invoice Items</Label>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Product</Label>
                      <select
                        value={item.product_id || ''}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                      >
                        <option value="">Select a product or enter manually</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.product_code} - {product.product_name} ({product.currency || 'USD'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>Product Name</Label>
                      <Input
                        value={item.product_name}
                        onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label>Product Code</Label>
                      <Input
                        value={item.product_code}
                        onChange={(e) => handleItemChange(index, 'product_code', e.target.value)}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label>Currency</Label>
                      <select
                        value={item.currency || 'USD'}
                        onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="TRY">TRY</option>
                        <option value="JPY">JPY</option>
                        <option value="CNY">CNY</option>
                      </select>
                    </div>

                    <div>
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.discount_percent}
                        onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.tax_rate}
                        onChange={(e) => handleItemChange(index, 'tax_rate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="text-right font-medium">
                    Item Total: {calculateItemTotal(item).toFixed(2)} {item.currency || 'USD'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes and Terms */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// DeleteInvoiceDialog.jsx
export const DeleteInvoiceDialog = ({ open, onOpenChange, invoice, onDeleteConfirmed, isLoading }) => {
  const handleDelete = () => {
    if (invoice) {
      onDeleteConfirmed(invoice.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete invoice <strong>{invoice?.invoice_number}</strong>?
          </p>
          
          {invoice && (
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity:</span>
                <span className="font-medium">{invoice.entity_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  ${parseFloat(invoice.total_amount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{invoice.status}</span>
              </div>
            </div>
          )}

          <div className="bg-red-50 border border-red-200 p-3 rounded-md">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. The invoice and all its items will be permanently deleted.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default { EditInvoiceDialog, DeleteInvoiceDialog }