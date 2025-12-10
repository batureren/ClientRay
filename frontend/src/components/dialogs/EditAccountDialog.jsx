// components/dialogs/EditAccountDialog.jsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import api from '@/services/api';

const EditAccountDialog = ({ open, onOpenChange, account, onAccountUpdated }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [customFields, setCustomFields] = useState([])
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    account_type: 'customer',
    industry: '',
    annual_revenue: '',
    employee_count: '',
    primary_contact_first_name: '',
    primary_contact_last_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_address_line1: '',
    billing_city: '',
    billing_state: '',
    billing_postal_code: '',
    billing_country: '',
    website: '',
    description: '',
    custom_fields: {}
  })

  const populateForm = (accountData, fields) => {
    const initialCustomFields = {};
    fields.forEach(field => {
      const accountCustomValue = accountData.custom_fields?.find(cf => cf.field_name === field.field_name);
      
      // Handle different field types for initial values
      if (field.field_type === 'BOOLEAN') {
        initialCustomFields[field.field_name] = accountCustomValue?.value ?? false;
      } else if (field.field_type === 'MULTISELECT') {
        // Parse MULTISELECT values - they should be stored as JSON arrays
        let multiSelectValue = [];
        if (accountCustomValue?.value) {
          try {
            multiSelectValue = typeof accountCustomValue.value === 'string' 
              ? JSON.parse(accountCustomValue.value) 
              : accountCustomValue.value;
          } catch (e) {
            console.warn(`Failed to parse multiselect value for ${field.field_name}:`, accountCustomValue.value);
            multiSelectValue = [];
          }
        }
        initialCustomFields[field.field_name] = Array.isArray(multiSelectValue) ? multiSelectValue : [];
      } else {
        initialCustomFields[field.field_name] = accountCustomValue?.value ?? '';
      }
    });

    setAccountForm({
      account_name: accountData.account_name || '',
      account_type: accountData.account_type || 'customer',
      industry: accountData.industry || '',
      annual_revenue: accountData.annual_revenue || '',
      employee_count: accountData.employee_count || '',
      primary_contact_first_name: accountData.primary_contact_first_name || '',
      primary_contact_last_name: accountData.primary_contact_last_name || '',
      primary_contact_email: accountData.primary_contact_email || '',
      primary_contact_phone: accountData.primary_contact_phone || '',
      billing_address_line1: accountData.billing_address_line1 || '',
      billing_city: accountData.billing_city || '',
      billing_state: accountData.billing_state || '',
      billing_postal_code: accountData.billing_postal_code || '',
      billing_country: accountData.billing_country || '',
      website: accountData.website || '',
      description: accountData.description || '',
      custom_fields: initialCustomFields
    })
  }

  useEffect(() => {
    if (account) {
      const fetchCustomFieldsAndPopulate = async () => {
        try {
          const response = await api.get('/custom-fields');
          const accountFields = response.data.filter(field => field.module === 'accounts');
          setCustomFields(accountFields);

          populateForm(account, accountFields);
        } catch (error) {
          console.error("Failed to fetch custom fields for accounts:", error);
          populateForm(account, []);
        }
      };
      fetchCustomFieldsAndPopulate();
    }
  }, [account])

  // Handler for standard form fields
  const handleChange = (key, value) => {
    setAccountForm(prev => ({ ...prev, [key]: value }));
  };

  // Handler specifically for custom fields
  const handleCustomFieldChange = (fieldName, value) => {
    setAccountForm(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldName]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!account?.id) return
    setIsLoading(true)
    try {
      await api.put(`/accounts/${account.id}`, accountForm)
      onAccountUpdated()
    } catch (error) {
      console.error('Error updating account:', error)
    }
    setIsLoading(false)
  }

  // Helper function to render the correct input component based on field type
  const renderCustomField = (field, disabled = false) => {
    const value = accountForm.custom_fields ? accountForm.custom_fields[field.field_name] : '';

    switch (field.field_type) {
      case 'TEXT':
        return <Input id={field.field_name} value={value} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled}/>;
      case 'TEXTAREA':
        return <Textarea id={field.field_name} value={value} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled}/>;
      case 'NUMBER':
        return <Input id={field.field_name} type="number" value={value} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled}/>;
      case 'DATE':{
        const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
        return <Input id={field.field_name} type="date" value={dateValue} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} required={field.is_required} disabled={disabled}/>;
        }
      case 'BOOLEAN':
        return (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id={field.field_name} checked={value == 1} onCheckedChange={checked => handleCustomFieldChange(field.field_name, checked)} disabled={disabled} />
            <label htmlFor={field.field_name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {field.field_label} {field.is_required ? '*' : ''}
            </label>
          </div>
        );
      case 'SELECT':
        return (
          <select
            id={field.field_name}
            value={value || ''}
            onChange={e => handleCustomFieldChange(field.field_name, e.target.value)}
            required={field.is_required}
            disabled={disabled}
            className="border rounded p-2 w-full"
          >
            <option value="">Seçiniz</option>
            {field.options?.map((opt, idx) => (
              <option key={idx} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        );

      case 'RADIO':
        return (
          <div className="space-y-2">
            {field.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.field_name}
                  value={opt.value || opt}
                  checked={value === (opt.value || opt)}
                  onChange={e => handleCustomFieldChange(field.field_name, e.target.value)}
                  disabled={disabled}
                  required={field.is_required}
                />
                <span>{opt.label || opt}</span>
              </label>
            ))}
          </div>
        );

      case 'MULTISELECT': {
        const selectedValues = Array.isArray(value) ? value : [];
        
        const handleMultiSelectChange = (optionValue, isChecked) => {
          let newValues;
          if (isChecked) {
            newValues = [...selectedValues, optionValue];
          } else {
            newValues = selectedValues.filter(v => v !== optionValue);
          }
          handleCustomFieldChange(field.field_name, newValues);
        };

        return (
          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
            {field.options?.map((opt, idx) => {
              const optionValue = opt.value || opt;
              const optionLabel = opt.label || opt;
              const isSelected = selectedValues.includes(optionValue);
              
              return (
                <label key={idx} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleMultiSelectChange(optionValue, checked)}
                    disabled={disabled}
                  />
                  <span className="text-sm">{optionLabel}</span>
                </label>
              );
            })}
            {selectedValues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Selected: {selectedValues.join(', ')}
                </p>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>Update the account's details and save your changes. Fields marked with * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
          {/* Account Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                value={accountForm.account_name}
                onChange={(e) => handleChange('account_name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                value={accountForm.account_type}
                onValueChange={(value) => handleChange('account_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={accountForm.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                placeholder="e.g., Technology, Healthcare, Finance"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={accountForm.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="annual_revenue">Annual Revenue</Label>
              <Input
                id="annual_revenue"
                type="number"
                value={accountForm.annual_revenue}
                onChange={(e) => handleChange('annual_revenue', e.target.value)}
                placeholder="e.g., 1000000"
              />
            </div>
            <div>
              <Label htmlFor="employee_count">Employee Count</Label>
              <Input
                id="employee_count"
                type="number"
                value={accountForm.employee_count}
                onChange={(e) => handleChange('employee_count', e.target.value)}
                placeholder="e.g., 50"
              />
            </div>
          </div>

          {/* Primary Contact */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Primary Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_contact_first_name">First Name</Label>
                <Input
                  id="primary_contact_first_name"
                  value={accountForm.primary_contact_first_name}
                  onChange={(e) => handleChange('primary_contact_first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="primary_contact_last_name">Last Name</Label>
                <Input
                  id="primary_contact_last_name"
                  value={accountForm.primary_contact_last_name}
                  onChange={(e) => handleChange('primary_contact_last_name', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_contact_email">Email</Label>
                <Input
                  id="primary_contact_email"
                  type="email"
                  value={accountForm.primary_contact_email}
                  onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="primary_contact_phone">Phone</Label>
                <Input
                  id="primary_contact_phone"
                  value={accountForm.primary_contact_phone}
                  onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Billing Address</h3>
            <div>
              <Label htmlFor="billing_address_line1">Address Line 1</Label>
              <Input
                id="billing_address_line1"
                value={accountForm.billing_address_line1}
                onChange={(e) => handleChange('billing_address_line1', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billing_city">City</Label>
                <Input
                  id="billing_city"
                  value={accountForm.billing_city}
                  onChange={(e) => handleChange('billing_city', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="billing_state">State/Province</Label>
                <Input
                  id="billing_state"
                  value={accountForm.billing_state}
                  onChange={(e) => handleChange('billing_state', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billing_postal_code">Postal Code</Label>
                <Input
                  id="billing_postal_code"
                  value={accountForm.billing_postal_code}
                  onChange={(e) => handleChange('billing_postal_code', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="billing_country">Country</Label>
                <Input
                  id="billing_country"
                  value={accountForm.billing_country}
                  onChange={(e) => handleChange('billing_country', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={accountForm.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              placeholder="Additional notes about this account..."
            />
          </div>

          {/* --- Dynamic Custom Fields Section --- */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">Additional Information</h4>
              {customFields.map(field => (
                field.field_type === 'BOOLEAN' ? (
                  <div key={field.id}>{renderCustomField(field)}</div>
                ) : (
                  <div key={field.id}>
                    <Label htmlFor={field.field_name}>
                      {field.field_label} {field.is_required ? '*' : ''}
                    </Label>
                    {renderCustomField(field)}
                  </div>
                )
              ))}
            </div>
          )}
          {/* --- End of Custom Fields --- */}

          <DialogFooter className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditAccountDialog