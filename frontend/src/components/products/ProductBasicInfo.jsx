// components/products/ProductBasicInfo.jsx
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'

const ProductBasicInfo = ({ formData, handleInputChange, categories = [] }) => {
  const allCategories = [...new Set([...categories, ...(formData.product_category ? [formData.product_category] : [])])]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="product_code">Product Code (SKU) *</Label>
          <Input
            id="product_code"
            value={formData.product_code}
            onChange={(e) => handleInputChange('product_code', e.target.value)}
            placeholder="e.g., PROD-001"
            required
          />
        </div>
        <div>
          <Label htmlFor="product_name">Product Name *</Label>
          <Input
            id="product_name"
            value={formData.product_name}
            onChange={(e) => handleInputChange('product_name', e.target.value)}
            placeholder="Enter product name"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="product_category">Category</Label>
          <Select 
            value={formData.product_category} 
            onValueChange={(value) => handleInputChange('product_category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select or type a category" />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="mt-2"
            placeholder="Or type a new category"
            value={formData.product_category || ''}
            onChange={(e) => handleInputChange('product_category', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select 
            value={formData.currency} 
            onValueChange={(value) => handleInputChange('currency', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'TRY'].map((curr) => (
                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export default ProductBasicInfo