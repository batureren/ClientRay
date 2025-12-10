// components/products/ProductDetails.jsx
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'

const ProductDetails = ({ formData, handleInputChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Product Details</h3>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Enter a detailed product description"
          rows={4}
        />
      </div>
      <div>
        <Label htmlFor="specifications">Specifications</Label>
        <Textarea
          id="specifications"
          value={formData.specifications}
          onChange={(e) => handleInputChange('specifications', e.target.value)}
          placeholder="Enter technical specifications, dimensions, materials, etc."
          rows={4}
        />
      </div>
    </div>
  )
}

export default ProductDetails