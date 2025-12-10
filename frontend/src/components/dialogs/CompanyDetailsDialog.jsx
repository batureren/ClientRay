import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Upload, X, Building2 } from 'lucide-react'
import api from '@/services/api'

const CompanyDetailsDialog = ({ open, onOpenChange, onSaved }) => {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    email: '',
    phone: '',
    website: '',
    tax_id: ''
  })
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  useEffect(() => {
    if (open) {
      fetchCompanyDetails()
    }
  }, [open])

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true)
      const response = await api.get('/company-detail')
      
      // Safely set form data with fallbacks
      setFormData({
        company_name: response.data.company_name || '',
        address_line1: response.data.address_line1 || '',
        address_line2: response.data.address_line2 || '',
        city: response.data.city || '',
        state: response.data.state || '',
        zip_code: response.data.zip_code || '',
        country: response.data.country || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        website: response.data.website || '',
        tax_id: response.data.tax_id || ''
      })
      setLogoUrl(response.data.logo_url || null)
    } catch (error) {
      console.error('Error fetching company details:', error)
      if (error.response?.status !== 404) {
        console.error('Unexpected error:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        console.error('File size must be less than 5MB')
        return
      }
      setLogoFile(file)
      setLogoUrl(URL.createObjectURL(file))
    }
  }

  const handleRemoveLogo = async () => {
    try {
      if (logoFile) {
        setLogoFile(null)
        setLogoUrl(null)
      } else if (logoUrl) {
        await api.delete('/company-detail/logo')
        setLogoUrl(null)
        console.log('Logo removed successfully')
      }
    } catch (error) {
      console.error('Error removing logo:', error)
      setError('Failed to remove logo')
    }
  }

  const handleSubmit = async () => {
    try {
      if (!formData.company_name) {
        setError('Company Name is required.')
        return
      }

      setLoading(true)
      setError(null)

      // Save company details
      await api.post('/company-detail', formData)

      // Upload logo if there's a new file
      if (logoFile) {
        const logoFormData = new FormData()
        logoFormData.append('logo', logoFile)
        
        setUploading(true)
        await api.post('/company-detail/logo', logoFormData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        setUploading(false)
      }

      console.log('Company details saved successfully')
      if (onSaved) onSaved()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving company details:', error)
      const errorMessage = error.response?.data?.error || 'Failed to save company details'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details for Invoices
          </DialogTitle>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      className="w-32 h-32 object-contain border rounded-lg bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 200x100px or similar ratio. Max 5MB.
                  Formats: JPG, PNG, GIF, SVG
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Your Company Name"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="123 Business Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="Suite 100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP/Postal Code</Label>
              <Input
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                placeholder="12345"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="United States"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@yourcompany.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://www.yourcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID / EIN</Label>
            <Input
              id="tax_id"
              name="tax_id"
              value={formData.tax_id}
              onChange={handleChange}
              placeholder="12-3456789"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || uploading}>
            {loading || uploading ? 'Saving...' : 'Save Details'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CompanyDetailsDialog