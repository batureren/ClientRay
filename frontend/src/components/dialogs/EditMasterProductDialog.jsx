// components/dialogs/EditMasterProductDialog.jsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import ProductBasicInfo from '../products/ProductBasicInfo'
import ProductPricing from '../products/ProductPricing'
import ProductInventory from '../products/ProductInventory'
import ProductDetails from '../products/ProductDetails'
import ProductStatus from '../products/ProductStatus'
import api from '@/services/api';

const EditMasterProductDialog = ({ open, onOpenChange, product, onProductUpdated, categories = [] }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    if (product) {
      setFormData({
        product_code: product.product_code || '',
        product_name: product.product_name || '',
        product_category: product.product_category || '',
        list_price: product.list_price || '',
        cost_price: product.cost_price || '',
        currency: product.currency || 'USD',
        description: product.description || '',
        specifications: product.specifications || '',
        stock_quantity: product.stock_quantity || '',
        reorder_point: product.reorder_point || '',
        is_active: product.is_active === 1      
      })
    }
  }, [product])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNumberInput = (field, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.product_code.trim() || !formData.product_name.trim()) {
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        ...formData,
        list_price: parseFloat(formData.list_price) || 0,
        cost_price: parseFloat(formData.cost_price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        reorder_point: parseInt(formData.reorder_point) || 0
      };
      
      await api.put(`/products/${product.id}`, payload)
      onProductUpdated()
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Master Product</DialogTitle>
          <DialogDescription>
            Editing: {product?.product_name} (Code: {product?.product_code})
          </DialogDescription>
        </DialogHeader>
        
        <form id="edit-product-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto space-y-6 pr-4">
          <ProductBasicInfo 
            formData={formData}
            handleInputChange={handleInputChange}
            categories={categories}
          />
          <ProductPricing 
            formData={formData}
            handleNumberInput={handleNumberInput}
          />
          <ProductInventory
            formData={formData}
            handleNumberInput={handleNumberInput}
          />
          <ProductDetails
            formData={formData}
            handleInputChange={handleInputChange}
          />
          <ProductStatus
            formData={formData}
            handleInputChange={handleInputChange}
          />

          {product && (
            <div className="bg-muted p-3 rounded text-sm mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>Created: {new Date(product.created_at).toLocaleString()}</div>
                <div>Updated: {new Date(product.updated_at).toLocaleString()}</div>
              </div>
            </div>
          )}
        </form>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-product-form" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditMasterProductDialog