// components/products/ProductPricing.jsx
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

const ProductPricing = ({ formData, handleNumberInput }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Pricing</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="list_price">List Price</Label>
          <Input
            id="list_price"
            value={formData.list_price}
            onChange={(e) => handleNumberInput('list_price', e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
          />
        </div>
        <div>
          <Label htmlFor="cost_price">Cost Price</Label>
          <Input
            id="cost_price"
            value={formData.cost_price}
            onChange={(e) => handleNumberInput('cost_price', e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
          />
        </div>
      </div>
    </div>
  )
}

export default ProductPricing