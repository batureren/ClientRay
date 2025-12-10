import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Plus, MoreHorizontal, Edit, Trash2, Search, Package, Grid, List } from 'lucide-react'
import CreateProductDialog from '../dialogs/CreateProductDialog'
import EditMasterProductDialog from '../dialogs/EditMasterProductDialog'
import DeleteProductDialog from '../dialogs/DeleteProductDialog'
import api from '@/services/api'

const ProductsTab = ({ products, onRefresh }) => {
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState('table')

  const categories = useMemo(() => {
    if (!products) return []
    const cats = [...new Set(products.map(p => p.product_category).filter(Boolean))]
    return cats.sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    
    return products.filter(product => {
      const matchesSearch = searchTerm === '' || 
        product.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || 
        product.product_category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const handleProductCreated = () => {
    setShowProductDialog(false)
    onRefresh()
  }

  const handleProductUpdated = () => {
    setShowEditDialog(false)
    setSelectedProduct(null)
    onRefresh()
  }

  const handleEdit = (product) => {
    setSelectedProduct(product)
    setShowEditDialog(true)
  }

  const handleDeleteClick = (product) => {
    setSelectedProduct(product)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirmed = async (productId) => {
    setIsDeleting(true)
    try {
      await api.delete(`/products/${productId}`)
      onRefresh()
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete the product. Please try again.')
    } finally {
      setIsDeleting(false)
      setSelectedProduct(null)
    }
  }

  const getPriceDisplay = (price, currency = 'USD') => {
    if (!price && price !== 0) return 'N/A'
    const symbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', TRY: '₺' }
    const symbol = symbols[currency] || currency
    return `${symbol}${parseFloat(price).toFixed(2)}`
  }

  const getStockStatus = (stock, reorderPoint = 0) => {
    if (stock === 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800' }
    if (reorderPoint > 0 && stock <= reorderPoint) return { text: `${stock} (Reorder)`, color: 'bg-yellow-100 text-yellow-800' }
    if (stock <= 10) return { text: `${stock} (Low)`, color: 'bg-orange-100 text-orange-800' }
    return { text: stock.toString(), color: 'bg-green-100 text-green-800' }
  }

  const ProductCard = ({ product }) => {
    const stockStatus = getStockStatus(product.stock_quantity, product.reorder_point)
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg leading-tight">{product.product_name}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">{product.product_code}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(product)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteClick(product)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 flex-grow flex flex-col justify-between">
            <div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {product.product_category && (
                    <Badge variant="secondary">{product.product_category}</Badge>
                    )}
                    <Badge className={`${stockStatus.color}`}>
                    {stockStatus.text}
                    </Badge>
                    <Badge className={`${product.is_active !== 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {product.is_active !== 0 ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
                {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {product.description}
                    </p>
                )}
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Price:</span>
                    <span className="font-medium">{getPriceDisplay(product.list_price, product.currency)}</span>
                </div>
                {product.cost_price > 0 && (
                    <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost:</span>
                    <span>{getPriceDisplay(product.cost_price, product.currency)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Stock:</span>
                    <span>{product.stock_quantity || 0}</span>
                </div>
            </div>
        </CardContent>
      </Card>
    )
  }

  const CategorySection = ({ category, products }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">{category}</h3>
        <Badge variant="outline">{products.length} products</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Products Management</h2>
          <p className="text-muted-foreground">
            {filteredProducts.length} of {products?.length || 0} products
          </p>
        </div>
        <Button onClick={() => setShowProductDialog(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, code, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
<select
  value={selectedCategory}
  onChange={(e) => setSelectedCategory(e.target.value)}
  className="
    flex h-10 w-full items-center justify-between rounded-md border border-input 
    bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground 
    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 
    disabled:cursor-not-allowed disabled:opacity-50

    dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400
    dark:ring-offset-gray-900
  "
>
  <option value="all">All Categories</option>
  {categories.map(category => (
    <option key={category} value={category}>{category}</option>
  ))}
</select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsContent value="products">
          {viewMode === 'table' ? (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="hidden md:table-cell">Stock</TableHead>
                        <TableHead className="hidden lg:table-cell">Status</TableHead>
                        <TableHead className="w-[50px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const stockStatus = getStockStatus(product.stock_quantity, product.reorder_point)
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">
                              {product.product_code}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-medium">{product.product_name}</div>
                                <div className="sm:hidden text-xs text-muted-foreground">
                                  {product.product_category}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {product.product_category || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {getPriceDisplay(product.list_price, product.currency)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge className={stockStatus.color} variant="outline">
                                {stockStatus.text}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge className={`${product.is_active !== 0 ? 'text-green-700' : 'text-red-700'}`} variant="outline">
                                {product.is_active !== 0 ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(product)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(product)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {filteredProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {searchTerm || selectedCategory !== 'all' 
                              ? 'No products match your search criteria.' 
                              : 'No products found. Click "Add Product" to get started.'
                            }
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-4" />
                    <h3 className="text-lg font-semibold">No Products Found</h3>
                    <p>
                        {searchTerm || selectedCategory !== 'all' 
                        ? 'Try adjusting your search or filter criteria.' 
                        : 'Click "Add Product" to create your first one.'
                        }
                    </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateProductDialog 
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onProductCreated={handleProductCreated}
        categories={categories}
        
      />

      <EditMasterProductDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        product={selectedProduct}
        onProductUpdated={handleProductUpdated}
        
        categories={categories}
      />

      <DeleteProductDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        product={selectedProduct}
        onDeleteConfirmed={handleDeleteConfirmed}
        isLoading={isDeleting}
      />
    </div>
  )
}

export default ProductsTab