// components/dialogs/CreateLeadDialog.jsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Calculator, X } from 'lucide-react';
import api from '@/services/api';

// Lead Status Progress Component
const LeadStatusProgress = ({ currentStatus, onStatusChange, disabled = false }) => {
  const { t } = useTranslation();
  const statusSteps = [
    { key: 'new', label: t('createLeadDialog.status.new'), bgColor: 'bg-blue-500', textColor: 'text-white' },
    { key: 'contacted', label: t('createLeadDialog.status.contacted'), bgColor: 'bg-green-500', textColor: 'text-white' },
    { key: 'qualified', label: t('createLeadDialog.status.qualified'), bgColor: 'bg-green-600', textColor: 'text-white' },
    { key: 'lost', label: t('createLeadDialog.status.lost'), bgColor: 'bg-red-500', textColor: 'text-white' }
  ];

  const currentIndex = statusSteps.findIndex(step => step.key === currentStatus);

  const getStepClasses = (step, index) => {
    const isCompleted = index < currentIndex;
    const isCurrent = index === currentIndex;
    const isLost = currentStatus === 'lost' && step.key === 'lost';
    const isInactive = currentStatus === 'lost' && step.key !== 'lost';

    let bgClass = 'bg-gray-300';
    let textClass = 'text-gray-600';

    if (isLost) {
      bgClass = step.bgColor;
      textClass = step.textColor;
    } else if (isCurrent) {
      bgClass = step.bgColor;
      textClass = step.textColor;
    } else if (isCompleted) {
      bgClass = 'bg-green-500';
      textClass = 'text-white';
    } else if (isInactive) {
      bgClass = 'bg-gray-200';
      textClass = 'text-gray-400';
    }

    const baseClasses = `relative flex items-center justify-center px-4 py-2 text-sm font-medium transition-all duration-200 ${bgClass} ${textClass}`;

    if (disabled) {
      return `${baseClasses} cursor-not-allowed opacity-70`;
    }

    return `${baseClasses} cursor-pointer hover:opacity-90 ${
      !isCurrent ? 'hover:shadow-md' : ''
    }`;
  };

  const handleStepClick = (stepKey) => {
    if (disabled || stepKey === currentStatus) return;
    onStatusChange(stepKey);
  };

  return (
    <div className="w-full">
      {/* Desktop: Horizontal arrow layout */}
      <ul className="hidden sm:flex items-center">
        {statusSteps.map((step, index) => (
          <li
            key={step.key}
            className={`relative ${index === 0 ? 'rounded-l-lg' : ''} ${
              index === statusSteps.length - 1 ? 'rounded-r-lg' : ''
            }`}
            style={{ clipPath: index === statusSteps.length - 1 ? 'none' : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)' }}
          >
            <div
              className={getStepClasses(step, index)}
              onClick={() => handleStepClick(step.key)}
              title={disabled ? step.label : `Set status to ${step.label}`}
              style={{
                minWidth: '100px',
                clipPath: index === statusSteps.length - 1 ? 'none' : 'inherit'
              }}
            >
              <div className="flex items-center space-x-2">
                {(() => {
                  const isCompleted = index < currentIndex;
                  const isLost = currentStatus === 'lost' && step.key === 'lost';

                  if ((isCompleted && currentStatus !== 'lost') || (isLost && index < statusSteps.findIndex(s => s.key === 'lost'))) {
                    return (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    );
                  }
                  return null;
                })()}
                <span className="truncate">{step.label}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Mobile: Vertical stack layout */}
      <div className="sm:hidden space-y-2">
        {statusSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLost = currentStatus === 'lost' && step.key === 'lost';
          const isInactive = currentStatus === 'lost' && step.key !== 'lost';

          let bgClass = 'bg-gray-300';
          let textClass = 'text-gray-600';
          let borderClass = 'border-gray-300';

          if (isLost) {
            bgClass = step.bgColor;
            textClass = step.textColor;
            borderClass = 'border-red-500';
          } else if (isCurrent) {
            bgClass = step.bgColor;
            textClass = step.textColor;
            borderClass = step.bgColor.replace('bg-', 'border-');
          } else if (isCompleted) {
            bgClass = 'bg-green-500';
            textClass = 'text-white';
            borderClass = 'border-green-500';
          } else if (isInactive) {
            bgClass = 'bg-gray-200';
            textClass = 'text-gray-400';
            borderClass = 'border-gray-200';
          }

          return (
            <div
              key={step.key}
              className={`w-full p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${bgClass} ${textClass} ${borderClass} ${
                disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-90'
              }`}
              onClick={() => handleStepClick(step.key)}
              title={disabled ? step.label : `Set status to ${step.label}`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {(() => {
                    if ((isCompleted && currentStatus !== 'lost') || (isLost && index < statusSteps.findIndex(s => s.key === 'lost'))) {
                      return (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      );
                    }
                    return (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? 'bg-white bg-opacity-20' : 'bg-black bg-opacity-20'
                      }`}>
                        {index + 1}
                      </div>
                    );
                  })()}
                </div>
                <span className="font-semibold">{step.label}</span>
                {isCurrent && (
                  <span className="ml-auto text-xs opacity-75">Current</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CreateLeadDialog = ({ open, onOpenChange, onLeadCreated }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [leadForm, setLeadForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    website: '',
    lead_source: '',
    status: 'new',
    notes: '',
    custom_fields: {}
  });

  const resetForm = (fields = []) => {
    const initialCustomFields = {};
    fields.forEach(field => {
      if (field.field_type === 'BOOLEAN') {
        initialCustomFields[field.field_name] = false;
      } else if (field.field_type === 'MULTISELECT') {
        initialCustomFields[field.field_name] = [];
      } else {
        initialCustomFields[field.field_name] = '';
      }
    });

    setLeadForm({
      first_name: '', last_name: '', email: '', phone: '', company: '',
      address_line1: '', city: '', state: '', postal_code: '', country: '',
      website: '', lead_source: '', notes: '', status: 'new',
      custom_fields: initialCustomFields
    });
  };

  useEffect(() => {
    if (open) {
      const fetchCustomFields = async () => {
        try {
          const response = await api.get('/custom-fields');
          const leadFields = response.data.filter(field => field.module === 'leads');
          setCustomFields(leadFields);
          resetForm(leadFields);
        } catch (error) {
          console.error("Failed to fetch custom fields for leads:", error);
        }
      };
      fetchCustomFields();
    }
  }, [open]);

  const handleChange = (key, value) => {
    setLeadForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setLeadForm(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldName]: value
      }
    }));
  };

  // Handle multiselect field changes
  const handleMultiselectChange = (fieldName, optionValue, isChecked) => {
    setLeadForm(prev => {
      const currentValues = prev.custom_fields[fieldName] || [];
      let newValues;
      
      if (isChecked) {
        // Add the value if it's not already present
        newValues = currentValues.includes(optionValue) 
          ? currentValues 
          : [...currentValues, optionValue];
      } else {
        // Remove the value
        newValues = currentValues.filter(val => val !== optionValue);
      }
      
      return {
        ...prev,
        custom_fields: {
          ...prev.custom_fields,
          [fieldName]: newValues
        }
      };
    });
  };

  // Remove selected option from multiselect
  const removeMultiselectOption = (fieldName, optionValue) => {
    setLeadForm(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldName]: (prev.custom_fields[fieldName] || []).filter(val => val !== optionValue)
      }
    }));
  };

  const handleStatusChange = (newStatus) => {
    setLeadForm(prev => ({ ...prev, status: newStatus }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/leads', leadForm);
      onLeadCreated();
    } catch (error) {
      console.error('Error creating lead:', error);
    }
    setIsLoading(false);
  };

  const renderCustomField = (field, disabled = false) => {
    const value = leadForm.custom_fields[field.field_name];

    switch (field.field_type) {
      case 'TEXT':
        return <Input id={field.field_name} value={value || ''} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled} />;
      case 'TEXTAREA':
        return <Textarea id={field.field_name} value={value || ''} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled} />;
      case 'NUMBER':
        return <Input id={field.field_name} type="number" value={value || ''} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder} required={field.is_required} disabled={disabled} />;
      case 'DATE':
        return <Input id={field.field_name} type="date" value={value || ''} onChange={e => handleCustomFieldChange(field.field_name, e.target.value)} required={field.is_required} disabled={disabled} />;
      case 'BOOLEAN':
        return (
          <div className="flex items-center space-x-2">
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
          <option value=""></option>
          {field.options?.map((opt, idx) => (
            <option key={idx} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      );

      case 'MULTISELECT':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            {/* Selected values display */}
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50 dark:bg-gray-800/50 min-h-[40px]">
                {selectedValues.map((selectedValue, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-md"
                  >
                    {selectedValue}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeMultiselectOption(field.field_name, selectedValue)}
                        className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            
            {/* Options checkboxes */}
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
              {field.options?.map((opt, idx) => {
                const optionValue = opt.value || opt;
                const optionLabel = opt.label || opt;
                const isSelected = selectedValues.includes(optionValue);
                
                return (
                  <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => handleMultiselectChange(field.field_name, optionValue, e.target.checked)}
                      disabled={disabled}
                      className="rounded"
                    />
                    <span className="text-sm">{optionLabel}</span>
                  </label>
                );
              })}
            </div>
            
            {selectedValues.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options selected
              </p>
            )}
          </div>
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
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('createLeadDialog.title')}</DialogTitle>
          <DialogDescription>{t('createLeadDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
          <div className="pb-4 border-b">
            <Label className="text-base font-semibold">{t('createLeadDialog.labels.status')}</Label>
            <div className="mt-2"><LeadStatusProgress currentStatus={leadForm.status} onStatusChange={handleStatusChange} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="first_name">{t('createLeadDialog.labels.firstName')}</Label><Input id="first_name" value={leadForm.first_name} onChange={e => handleChange('first_name', e.target.value)} required /></div>
            <div><Label htmlFor="last_name">{t('createLeadDialog.labels.lastName')}</Label><Input id="last_name" value={leadForm.last_name} onChange={e => handleChange('last_name', e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="email">{t('createLeadDialog.labels.email')}</Label><Input id="email" type="email" value={leadForm.email} onChange={e => handleChange('email', e.target.value)} required /></div>
            <div><Label htmlFor="phone">{t('createLeadDialog.labels.phone')}</Label><Input id="phone" value={leadForm.phone} onChange={e => handleChange('phone', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="company">{t('createLeadDialog.labels.company')}</Label><Input id="company" value={leadForm.company} onChange={e => handleChange('company', e.target.value)} /></div>
            <div><Label htmlFor="website">{t('createLeadDialog.labels.website')}</Label><Input id="website" value={leadForm.website} onChange={e => handleChange('website', e.target.value)} /></div>
          </div>
          <div><Label htmlFor="address_line1">{t('createLeadDialog.labels.address')}</Label><Input id="address_line1" value={leadForm.address_line1} onChange={e => handleChange('address_line1', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="city">{t('createLeadDialog.labels.city')}</Label><Input id="city" value={leadForm.city} onChange={e => handleChange('city', e.target.value)} /></div>
            <div><Label htmlFor="state">{t('createLeadDialog.labels.state')}</Label><Input id="state" value={leadForm.state} onChange={e => handleChange('state', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="postal_code">{t('createLeadDialog.labels.postalCode')}</Label><Input id="postal_code" value={leadForm.postal_code} onChange={e => handleChange('postal_code', e.target.value)} /></div>
            <div><Label htmlFor="country">{t('createLeadDialog.labels.country')}</Label><Input id="country" value={leadForm.country} onChange={e => handleChange('country', e.target.value)} /></div>
          </div>
          <div><Label htmlFor="lead_source">{t('createLeadDialog.labels.leadSource')}</Label><Input id="lead_source" value={leadForm.lead_source} onChange={e => handleChange('lead_source', e.target.value)} placeholder={t('createLeadDialog.placeholders.leadSource')} /></div>
          <div><Label htmlFor="notes">{t('createLeadDialog.labels.notes')}</Label><Textarea id="notes" value={leadForm.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} /></div>

          {/* --- Dynamic Custom Fields Section --- */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">{t('createLeadDialog.labels.additionalInfo')}</h4>
              {customFields.map(field => {
                const isFormulated = field.is_read_only === 1;

                if (!isFormulated) {
                  return field.field_type === 'BOOLEAN' ? (
                    <div key={field.id}>{renderCustomField(field)}</div>
                  ) : (
                    <div key={field.id}>
                      <Label htmlFor={field.field_name}>
                        {field.field_label} {field.is_required ? '*' : ''}
                      </Label>
                      {renderCustomField(field)}
                    </div>
                  );
                }

                return (
                  <div key={field.id}>
                    {field.field_type !== 'BOOLEAN' && (
                      <Label htmlFor={field.field_name}>
                        {field.field_label} {field.is_required ? '*' : ''}
                      </Label>
                    )}
                    <div className="flex items-center space-x-2 mt-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed">
                      <Calculator className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="flex-grow">
                        {renderCustomField(field, true)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* --- End of Custom Fields --- */}

          <DialogFooter className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? t('editLeadDialog.buttons.saving') : t('editLeadDialog.buttons.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLeadDialog;