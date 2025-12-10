// components/products/ProductStatus.jsx
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'

const ProductStatus = ({ formData, handleInputChange }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold border-b pb-2">Status</h3>
      <div>
        <Label htmlFor="is_active">Product Status</Label>
        <Select 
          value={String(formData.is_active)} 
          onValueChange={(value) => handleInputChange('is_active', value === 'true')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-green-600">Active</SelectItem>
            <SelectItem value="false" className="text-red-600">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default ProductStatus