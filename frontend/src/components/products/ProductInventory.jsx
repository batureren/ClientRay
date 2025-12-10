// components/products/ProductInventory.jsx
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

const ProductInventory = ({ formData, handleNumberInput }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Inventory</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stock_quantity">Current Stock</Label>
          <Input
            id="stock_quantity"
            value={formData.stock_quantity}
            onChange={(e) => handleNumberInput('stock_quantity', e.target.value)}
            placeholder="0"
            type="number"
          />
        </div>
        <div>
          <Label htmlFor="reorder_point">Reorder Point</Label>
          <Input
            id="reorder_point"
            value={formData.reorder_point}
            onChange={(e) => handleNumberInput('reorder_point', e.target.value)}
            placeholder="0"
            type="number"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Alert when stock falls below this level.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProductInventory