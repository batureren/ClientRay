// components/dialogs/CreateProductDialog.jsx
import { useState } from 'react'
import api from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import ProductBasicInfo from '../products/ProductBasicInfo'
import ProductPricing from '../products/ProductPricing'
import ProductInventory from '../products/ProductInventory'
import ProductDetails from '../products/ProductDetails'
import ProductStatus from '../products/ProductStatus'

const CreateProductDialog = ({ open, onOpenChange, onProductCreated, categories = [] }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [productForm, setProductForm] = useState({
    product_code: '', 
    product_name: '', 
    product_category: '', 
    list_price: '',
    cost_price: '', 
    currency: 'USD',
    description: '', 
    specifications: '', 
    stock_quantity: '',
    reorder_point: '',
    is_active: true
  })
  
  const defaultCategories = [
    'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports & Outdoors',
    'Health & Beauty', 'Automotive', 'Office Supplies', 'Food & Beverages', 'Toys & Games', 'Other'
  ]

  const allCategories = [...new Set([...categories, ...defaultCategories])]

  const handleInputChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }))
  }

  const handleNumberInput = (field, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setProductForm(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!productForm.product_code.trim() || !productForm.product_name.trim()) {
      alert('Please fill in required fields: Product Code and Product Name.')
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        ...productForm,
        product_code: productForm.product_code.trim(),
        product_name: productForm.product_name.trim(),
        list_price: parseFloat(productForm.list_price) || 0,
        cost_price: parseFloat(productForm.cost_price) || 0,
        stock_quantity: parseInt(productForm.stock_quantity) || 0,
        reorder_point: parseInt(productForm.reorder_point) || 0,
        description: productForm.description.trim() || null,
        specifications: productForm.specifications.trim() || null
      };

      await api.post('/products', payload)
      
      setProductForm({
        product_code: '', product_name: '', product_category: '', list_price: '',
        cost_price: '', currency: 'USD', description: '', specifications: '',
        stock_quantity: '', reorder_point: '', is_active: true
      });

      onProductCreated()
    } catch (error) {
      console.error('Error creating product:', error)
      const errorMessage = error.response?.data?.error || 'Failed to create product. Check for duplicate SKU or other errors.'
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>Add a new product to your catalog. Fields marked with * are required.</DialogDescription>
        </DialogHeader>
        
        <form id="create-product-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto space-y-6 pr-4">
          <ProductBasicInfo 
            formData={productForm}
            handleInputChange={handleInputChange}
            categories={allCategories}
          />
          <ProductPricing 
            formData={productForm}
            handleNumberInput={handleNumberInput}
          />
          <ProductInventory
            formData={productForm}
            handleNumberInput={handleNumberInput}
          />
          <ProductDetails
            formData={productForm}
            handleInputChange={handleInputChange}
          />
          <ProductStatus
            formData={productForm}
            handleInputChange={handleInputChange}
          />
        </form>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="create-product-form" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Creating...' : 'Create Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateProductDialog