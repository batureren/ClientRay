import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Plus, Trash2, Search, User } from 'lucide-react'
import api from '@/services/api'

const CreateInvoiceDialog = ({ open, onOpenChange, onInvoiceCreated, user }) => {
  const [formData, setFormData] = useState({
    entity_type: 'lead',
    entity_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: 0,
    discount_amount: 0,
    notes: '',
    terms: 'Payment is due within 30 days'
  })

  const [items, setItems] = useState([
    { product_id: null, product_code: '', product_name: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_rate: 0, currency: 'USD' }
  ])

  const [entities, setEntities] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [entitySearch, setEntitySearch] = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [showEntityDropdown, setShowEntityDropdown] = useState(false)

  // Helper to get display name
  const getUserDisplayName = () => {
    if (!user) return 'Unknown User';
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    return user.name || user.username || 'Unknown User';
  }

  useEffect(() => {
    if (open) {
      fetchProducts()
    }
  }, [open])

  useEffect(() => {
    if (formData.entity_type && entitySearch) {
      const timer = setTimeout(() => {
        fetchEntities()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [entitySearch, formData.entity_type])

  const fetchEntities = async () => {
    try {
      const endpoint = formData.entity_type === 'lead' ? '/leads' : '/accounts'
      const response = await api.get(endpoint, {
        params: { search: entitySearch, limit: 10 }
      })
      setEntities(response.data.data || [])
      setShowEntityDropdown(true)
    } catch (error) {
      console.error('Error fetching entities:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products')
      setProducts(response.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleEntitySelect = (entity) => {
    setFormData({ ...formData, entity_id: entity.id })
    setSelectedEntity(entity)
    setEntitySearch(formData.entity_type === 'lead' ? entity.name : entity.account_name)
    setShowEntityDropdown(false)
    setEntities([])
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
    
    if (!formData.entity_id) {
      alert('Please select an entity')
      return
    }

    if (items.some(item => !item.product_name || item.quantity <= 0 || item.unit_price < 0)) {
      alert('Please fill in all item details correctly')
      return
    }

    setLoading(true)
    try {
      await api.post('/invoices', {
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
      
      onInvoiceCreated()
      resetForm()
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Failed to create invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      entity_type: 'lead',
      entity_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tax_rate: 0,
      discount_amount: 0,
      notes: '',
      terms: 'Payment is due within 30 days'
    })
    setItems([{
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
    setEntitySearch('')
    setSelectedEntity(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Info: User & Entity Type */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Created By</Label>
              <div className="flex items-center h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 mr-2" />
                {getUserDisplayName()}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <select
                value={formData.entity_type}
                onChange={(e) => {
                  setFormData({ ...formData, entity_type: e.target.value, entity_id: '' })
                  setSelectedEntity(null)
                  setEntitySearch('')
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="lead">Lead</option>
                <option value="account">Account</option>
              </select>
            </div>
          </div>

          {/* Entity Selection & Dates */}
          <div className="grid grid-cols-3 gap-4">
             <div className="space-y-2">
              <Label>Select {formData.entity_type === 'lead' ? 'Lead' : 'Account'}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${formData.entity_type}...`}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  onFocus={() => {
                    if (entities.length > 0) setShowEntityDropdown(true)
                  }}
                  className="pl-10"
                />
                {showEntityDropdown && entities.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {entities.map(entity => (
                      <button
                        key={entity.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleEntitySelect(entity)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm dark:hover:bg-gray-700"
                      >
                        {formData.entity_type === 'lead'
                            ? `${entity.first_name} ${entity.last_name}`
                            : entity.account_name}
                        {(entity.email || entity.primary_contact_email) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {entity.email ? entity.email : entity.primary_contact_email}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedEntity && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  ✓ Selected: {formData.entity_type === 'lead' ? selectedEntity.name : selectedEntity.account_name}
                </div>
              )}
            </div>

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
                placeholder="Add any additional notes..."
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
              {loading ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateInvoiceDialog