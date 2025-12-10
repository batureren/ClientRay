import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Eye, Settings, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

const Form2LeadEditor = () => {
  const navigate = useNavigate();
  const api = useApi();
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState([]);
  const [formConfig, setFormConfig] = useState({
    title: 'Contact Us',
    description: 'Fill out the form below and we\'ll get back to you soon.',
    submitButtonText: 'Submit',
    successMessage: 'Thank you! We\'ll be in touch soon.',
    redirectUrl: '',
    leadSource: 'Website Form',
    fields: [
      { 
        id: 'first_name',
        name: 'first_name', 
        label: 'First Name', 
        type: 'text', 
        required: true, 
        enabled: true,
        isStandard: true,
        column: 'left'
      },
      { 
        id: 'last_name',
        name: 'last_name', 
        label: 'Last Name', 
        type: 'text', 
        required: true, 
        enabled: true,
        isStandard: true,
        column: 'right'
      },
      { 
        id: 'email',
        name: 'email', 
        label: 'Email', 
        type: 'email', 
        required: true, 
        enabled: true,
        isStandard: true,
        column: 'full'
      },
      { 
        id: 'phone',
        name: 'phone', 
        label: 'Phone', 
        type: 'tel', 
        required: false, 
        enabled: true,
        isStandard: true,
        column: 'left'
      },
      { 
        id: 'company',
        name: 'company', 
        label: 'Company', 
        type: 'text', 
        required: false, 
        enabled: true,
        isStandard: true,
        column: 'right'
      },
      { 
        id: 'website',
        name: 'website', 
        label: 'Website', 
        type: 'url', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'full'
      },
      { 
        id: 'address_line1',
        name: 'address_line1', 
        label: 'Address', 
        type: 'text', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'full'
      },
      { 
        id: 'city',
        name: 'city', 
        label: 'City', 
        type: 'text', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'left'
      },
      { 
        id: 'state',
        name: 'state', 
        label: 'State/Province', 
        type: 'text', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'right'
      },
      { 
        id: 'postal_code',
        name: 'postal_code', 
        label: 'Postal Code', 
        type: 'text', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'left'
      },
      { 
        id: 'country',
        name: 'country', 
        label: 'Country', 
        type: 'text', 
        required: false, 
        enabled: false,
        isStandard: true,
        column: 'right'
      },
      { 
        id: 'notes',
        name: 'notes', 
        label: 'Message', 
        type: 'textarea', 
        required: false, 
        enabled: true,
        isStandard: true,
        column: 'full'
      }
    ]
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [codeFormat, setCodeFormat] = useState('html');
  const [copied, setCopied] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [showCustomFieldSelector, setShowCustomFieldSelector] = useState(false);

  // Fetch custom field definitions on mount
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await api.get('/custom-fields');
        const leadFields = response.filter(field => field.module === 'leads');
        setCustomFieldDefinitions(leadFields);
      } catch (error) {
        console.error('Failed to fetch custom fields:', error);
      }
    };
    fetchCustomFields();
  }, []);

  const updateField = (id, updates) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.map((field) => 
        field.id === id ? { ...field, ...updates } : field
      )
    }));
  };

  const addCustomField = (customFieldDef) => {
    const newField = {
      id: `custom_${customFieldDef.id}_${Date.now()}`,
      name: customFieldDef.field_name,
      label: customFieldDef.field_label,
      type: mapCustomFieldType(customFieldDef.field_type),
      required: customFieldDef.is_required === 1,
      enabled: true,
      isStandard: false,
      isCustom: true,
      customFieldId: customFieldDef.id,
      placeholder: customFieldDef.placeholder,
      options: customFieldDef.options,
      column: 'full'
    };
    setFormConfig(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setShowCustomFieldSelector(false);
  };

  const mapCustomFieldType = (dbType) => {
    const typeMap = {
      'TEXT': 'text',
      'TEXTAREA': 'textarea',
      'NUMBER': 'number',
      'DATE': 'date',
      'BOOLEAN': 'checkbox',
      'SELECT': 'select',
      'RADIO': 'radio'
    };
    return typeMap[dbType] || 'text';
  };

  const removeField = (id) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.filter((field) => field.id !== id)
    }));
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const newFields = [...formConfig.fields];
    const draggedField = newFields[draggedItem];
    
    newFields.splice(draggedItem, 1);
    newFields.splice(dropIndex, 0, draggedField);
    
    setFormConfig(prev => ({ ...prev, fields: newFields }));
    setDraggedItem(null);
  };

  const generateFormLayout = () => {
    const enabledFields = formConfig.fields.filter(f => f.enabled);
    
    // Group fields into rows based on column layout
    const rows = [];
    let currentRow = [];
    
    enabledFields.forEach(field => {
      if (field.column === 'full') {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
          currentRow = [];
        }
        rows.push([field]);
      } else {
        currentRow.push(field);
        if (currentRow.length === 2) {
          rows.push([...currentRow]);
          currentRow = [];
        }
      }
    });
    
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    return rows;
  };

  const generateHtmlCode = () => {
    const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';
    const rows = generateFormLayout();
    
    const generateFieldHtml = (field) => {
      const inputId = `form2lead_${field.name}`;
      const isRequired = field.required ? 'required' : '';
      const requiredMark = field.required ? ' *' : '';
      const placeholder = field.placeholder ? ` placeholder="${field.placeholder}"` : '';
      
      let inputElement = '';
      
      switch (field.type) {
        case 'textarea':
          inputElement = `<textarea id="${inputId}" name="${field.name}" rows="4" ${isRequired}${placeholder} style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical;"></textarea>`;
          break;
        case 'select':
            {
          const selectOptions = field.options ? field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('') : '';
          inputElement = `<select id="${inputId}" name="${field.name}" ${isRequired} style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit;"><option value="">Please select...</option>${selectOptions}</select>`;
            }
          break;
        case 'radio':
          if (field.options) {
            const radioOptions = field.options.map((opt, idx) => 
              `<div style="margin: 4px 0;"><input type="radio" id="${inputId}_${idx}" name="${field.name}" value="${opt}" ${isRequired} style="margin-right: 8px;"><label for="${inputId}_${idx}">${opt}</label></div>`
            ).join('');
            inputElement = radioOptions;
          }
          break;
        case 'checkbox':
          inputElement = `<input type="checkbox" id="${inputId}" name="${field.name}" value="1" style="margin-right: 8px;">`;
          break;
        default:
          inputElement = `<input type="${field.type}" id="${inputId}" name="${field.name}" ${isRequired}${placeholder} style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit;" />`;
      }
      
      return `
        <label for="${inputId}" style="display: block; margin-bottom: 4px; font-weight: 500;">${field.label}${requiredMark}</label>
        ${inputElement}`;
    };

    const rowsHtml = rows.map(row => {
      if (row.length === 1) {
        return `
        <div style="margin-bottom: 16px;">
          ${generateFieldHtml(row[0])}
        </div>`;
      } else {
        return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          ${row.map(field => `<div>${generateFieldHtml(field)}</div>`).join('')}
        </div>`;
      }
    }).join('');

    const customFieldsJs = formConfig.fields
      .filter(f => f.enabled && f.isCustom)
      .map(f => `if (data['${f.name}']) customFields['${f.name}'] = data['${f.name}'];`)
      .join('\n    ');

    return `<!-- Form2Lead Generated Form -->
<form id="form2lead-form" style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827;">${formConfig.title}</h2>
    <p style="margin: 0; color: #6b7280; line-height: 1.5;">${formConfig.description}</p>
  </div>
  
  ${rowsHtml}
  
  <!-- Hidden fields -->
  <input type="hidden" name="lead_source" value="${formConfig.leadSource}" />
  
  <button type="submit" style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
    ${formConfig.submitButtonText}
  </button>
  
  <div id="form2lead-message" style="margin-top: 16px; padding: 12px; border-radius: 4px; display: none;"></div>
</form>

<script>
(function() {
  const form = document.getElementById('form2lead-form');
  const messageDiv = document.getElementById('form2lead-message');
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Convert custom fields to the expected format
    const customFields = {};
    ${customFieldsJs}
    
    const leadData = {
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      address_line1: data.address_line1 || '',
      city: data.city || '',
      state: data.state || '',
      postal_code: data.postal_code || '',
      country: data.country || '',
      website: data.website || '',
      lead_source: data.lead_source || '${formConfig.leadSource}',
      notes: data.notes || '',
      status: 'new',
      custom_fields: customFields
    };
    
    try {
      const button = form.querySelector('button[type="submit"]');
      const originalText = button.textContent;
      button.textContent = 'Submitting...';
      button.disabled = true;
      
      const response = await fetch('${baseUrl}/api/form2lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData)
      });
      
      if (response.ok) {
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#f0fdf4';
        messageDiv.style.color = '#166534';
        messageDiv.style.border = '1px solid #bbf7d0';
        messageDiv.textContent = '${formConfig.successMessage}';
        
        form.reset();
        
        ${formConfig.redirectUrl ? `setTimeout(() => { window.location.href = '${formConfig.redirectUrl}'; }, 2000);` : ''}
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#fef2f2';
      messageDiv.style.color = '#dc2626';
      messageDiv.style.border = '1px solid #fecaca';
      messageDiv.textContent = 'There was an error submitting the form. Please try again.';
    } finally {
      const button = form.querySelector('button[type="submit"]');
      button.textContent = originalText;
      button.disabled = false;
    }
  });
})();
</script>`;
  };

  const generateJsxCode = () => {
    const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';
    const rows = generateFormLayout();
    
    const customFields = formConfig.fields.filter(f => f.enabled && f.isCustom);

    const generateFieldJsx = (field) => {
        const requiredMark = field.required ? ' *' : '';
        const requiredProp = field.required ? 'required' : '';
        const placeholderProp = field.placeholder ? `placeholder="${field.placeholder}"` : '';
        const inputId = `form2lead_${field.name}`;

        let inputElement;

        switch (field.type) {
            case 'textarea':
                inputElement = `<textarea id="${inputId}" name="${field.name}" rows={4} ${requiredProp} ${placeholderProp} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }} />`;
                break;
            case 'select':
                {
                const selectOptions = field.options?.map(opt => `<option key="${opt}" value="${opt}">${opt}</option>`).join('\n              ') || '';
                inputElement = `<select id="${inputId}" name="${field.name}" ${requiredProp} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit' }}>
              <option value="">Please select...</option>
              ${selectOptions}
            </select>`;}
                break;
            case 'radio':
                {
                const radioOptions = field.options?.map((opt, idx) => `
              <div key={${idx}} style={{ display: 'flex', alignItems: 'center', marginRight: '16px' }}>
                <input type="radio" id="${inputId}_${idx}" name="${field.name}" value="${opt}" ${requiredProp} style={{ marginRight: '8px' }} />
                <label htmlFor="${inputId}_${idx}">${opt}</label>
              </div>`).join('') || '';
                inputElement = `<div style={{ display: 'flex' }}>${radioOptions}</div>`;}
                break;
            case 'checkbox':
                return `<div style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" id="${inputId}" name="${field.name}" value="1" style={{ marginRight: '8px' }} />
          <label htmlFor="${inputId}" style={{ fontWeight: 500 }}>${field.label}${requiredMark}</label>
        </div>`;
            default:
                inputElement = `<input type="${field.type}" id="${inputId}" name="${field.name}" ${requiredProp} ${placeholderProp} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit' }} />`;
                break;
        }

        return `<div>
          <label htmlFor="${inputId}" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            ${field.label}${requiredMark}
          </label>
          ${inputElement}
        </div>`;
    };

    const rowsJsx = rows.map((row, rowIndex) => {
        if (row.length === 1) {
            return `
        <div style={{ marginBottom: '16px' }}>
          ${generateFieldJsx(row[0])}
        </div>`;
        }
        return `
        <div key={${rowIndex}} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          ${row.map(field => generateFieldJsx(field)).join('\n          ')}
        </div>`;
    }).join('');
    
    const customFieldsJs = customFields.map(f =>
        `    if (data['${f.name}']) customFields['${f.name}'] = data['${f.name}'];`
    ).join('\n');

    return `import React, { useState } from 'react';

const Form2Lead = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const customFields = {};
${customFieldsJs}
    
    const leadData = {
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      address_line1: data.address_line1 || '',
      city: data.city || '',
      state: data.state || '',
      postal_code: data.postal_code || '',
      country: data.country || '',
      website: data.website || '',
      lead_source: data.lead_source || '${formConfig.leadSource}',
      notes: data.notes || '',
      status: 'new',
      custom_fields: customFields
    };
    
    try {
      const response = await fetch('${baseUrl}/api/form2lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData)
      });
      
      if (response.ok) {
        setMessage('${formConfig.successMessage}');
        setMessageType('success');
        e.target.reset();
        
        ${formConfig.redirectUrl ? `setTimeout(() => { window.location.href = '${formConfig.redirectUrl}'; }, 2000);` : ''}
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      setMessage('There was an error submitting the form. Please try again.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '24px', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        background: '#fff', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: '#111827' }}>
          ${formConfig.title}
        </h2>
        <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>
          ${formConfig.description}
        </p>
      </div>
      
${rowsJsx}
      
      <input type="hidden" name="lead_source" value="${formConfig.leadSource}" />
      
      <button 
        type="submit" 
        disabled={isSubmitting}
        style={{ 
          width: '100%', 
          padding: '12px', 
          background: isSubmitting ? '#9ca3af' : '#3b82f6', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px', 
          fontSize: '16px', 
          fontWeight: 500, 
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        {isSubmitting ? 'Submitting...' : '${formConfig.submitButtonText}'}
      </button>
      
      {message && (
        <div 
          style={{ 
            marginTop: '16px', 
            padding: '12px', 
            borderRadius: '4px',
            background: messageType === 'success' ? '#f0fdf4' : '#fef2f2',
            color: messageType === 'success' ? '#166534' : '#dc2626',
            border: messageType === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
};

export default Form2Lead;`;
  };

  const copyCode = () => {
    const code = codeFormat === 'html' ? generateHtmlCode() : generateJsxCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const FormPreview = () => {
    const rows = generateFormLayout();
    
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: '#111827' }}>
            {formConfig.title}
          </h2>
          <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>
            {formConfig.description}
          </p>
        </div>
        
        {rows.map((row, rowIndex) => (
          <div 
            key={rowIndex}
            style={{ 
              marginBottom: '16px',
              display: row.length === 1 ? 'block' : 'grid',
              gridTemplateColumns: row.length === 2 ? '1fr 1fr' : 'none',
              gap: row.length === 2 ? '16px' : '0'
            }}
          >
            {row.map((field) => {
              const renderInput = () => {
                switch (field.type) {
                  case 'textarea':
                    return (
                      <textarea 
                        rows={4}
                        placeholder={field.placeholder}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                        disabled
                      />
                    );
                  case 'select':
                    return (
                      <select style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} disabled>
                        <option>Please select...</option>
                        {field.options?.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    );
                  case 'radio':
                    return (
                      <div>
                        {field.options?.map((opt, idx) => (
                          <div key={idx} style={{ margin: '4px 0' }}>
                            <input type="radio" name={field.name} disabled style={{ marginRight: '8px' }} />
                            <label>{opt}</label>
                          </div>
                        ))}
                      </div>
                    );
                  case 'checkbox':
                    return <input type="checkbox" disabled style={{ marginRight: '8px' }} />;
                  default:
                    return (
                      <input 
                        type={field.type}
                        placeholder={field.placeholder}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        disabled
                      />
                    );
                }
              };

              return (
                <div key={field.id}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {renderInput()}
                </div>
              );
            })}
          </div>
        ))}
        
        <button 
          type="button" 
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '16px', 
            fontWeight: 500
          }}
        >
          {formConfig.submitButtonText}
        </button>
      </div>
    );
  };

  const availableCustomFields = customFieldDefinitions.filter(def => 
    !formConfig.fields.some(field => field.customFieldId === def.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Settings
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Form2Lead</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                previewMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {previewMode ? <Settings className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {previewMode ? 'Edit Form' : 'Preview'}
            </button>
          </div>
        </div>

        {previewMode ? (
          /* Preview Mode */
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Form Preview</h2>
                            <div className="flex items-center gap-2">
 
                <select
                  value={codeFormat}
                  onChange={(e) => setCodeFormat(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="html">HTML</option>
                  <option value="jsx">JSX (React)</option>
                </select>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <FormPreview />
              </div>
              
              <div>
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-auto max-h-[600px] text-gray-800 dark:text-gray-200">
                  <code>{codeFormat === 'html' ? generateHtmlCode() : generateJsxCode()}</code>
                </pre>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Implementation Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>Copy the generated code above</li>
                <li>Paste it into your website where you want the form to appear</li>
                <li>Make sure your website can reach the API endpoint: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{import.meta.env.VITE_BASE_URL}/api/form2lead</code></li>
                <li>Test the form to ensure it creates leads in your CRM</li>
              </ol>
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Configuration */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Form Settings</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Form Title
                    </label>
                    <input
                      type="text"
                      value={formConfig.title}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formConfig.description}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Submit Button Text
                    </label>
                    <input
                      type="text"
                      value={formConfig.submitButtonText}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, submitButtonText: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Success Message
                    </label>
                    <input
                      type="text"
                      value={formConfig.successMessage}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, successMessage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lead Source (Hidden Field)
                    </label>
                    <input
                      type="text"
                      value={formConfig.leadSource}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, leadSource: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Redirect URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={formConfig.redirectUrl}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, redirectUrl: e.target.value }))}
                      placeholder="https://example.com/thank-you"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Field Configuration */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Form Fields</h2>
                  <div className="relative">
                    <button
                      onClick={() => setShowCustomFieldSelector(!showCustomFieldSelector)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      disabled={availableCustomFields.length === 0}
                    >
                      <Plus className="w-4 h-4" />
                      Add Custom Field
                      {showCustomFieldSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {showCustomFieldSelector && availableCustomFields.length > 0 && (
                      <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-64">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Custom Fields</h4>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {availableCustomFields.map((field) => (
                            <button
                              key={field.id}
                              onClick={() => addCustomField(field)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                            >
                              <div className="font-medium text-gray-900 dark:text-gray-100">{field.field_label}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {field.field_type} • {field.is_required ? 'Required' : 'Optional'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {formConfig.fields.map((field, index) => (
                    <div 
                      key={field.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-1 flex items-center justify-center">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => updateField(field.id, { enabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Field label"
                            disabled={field.isStandard}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={field.name}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-mono"
                            placeholder="field_name"
                            disabled
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <div className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                            {field.type}
                          </div>
                        </div>
                        
                        <div className="col-span-1">
                          <select
                            value={field.column}
                            onChange={(e) => updateField(field.id, { column: e.target.value })}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="full">Full</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            className="w-4 h-4 text-red-600 rounded"
                            title="Required field"
                          />
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-center">
                          {!field.isStandard && (
                            <button
                              onClick={() => removeField(field.id)}
                              className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                              title="Remove field"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {field.enabled && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong className="text-gray-600 dark:text-gray-400">Preview:</strong>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {field.label}{field.required ? ' *' : ''}
                              </span>
                            </div>
                            <div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                field.isStandard 
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                                  : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                              }`}>
                                {field.isStandard ? 'Standard' : 'Custom'}
                              </span>
                              <span className={`ml-2 text-xs px-2 py-1 rounded ${
                                field.column === 'full' 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              }`}>
                                {field.column === 'full' ? 'Full Width' : field.column === 'left' ? 'Left Half' : 'Right Half'}
                              </span>
                            </div>
                          </div>
                          
                          {field.placeholder && (
                            <div className="mt-2">
                              <strong className="text-xs text-gray-500 dark:text-gray-400">Placeholder:</strong>
                              <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">{field.placeholder}</span>
                            </div>
                          )}
                          
                          {field.options && field.options.length > 0 && (
                            <div className="mt-2">
                              <strong className="text-xs text-gray-500 dark:text-gray-400">Options:</strong>
                              <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">
                                {field.options.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <p><strong>Instructions:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Drag the grip icon to reorder fields</li>
                    <li>Check "Enable" to include the field in your form</li>
                    <li>Select column width: Full width or split into left/right halves</li>
                    <li>Check "Required" to make the field mandatory</li>
                    <li>Standard field labels and types cannot be changed</li>
                    <li>Custom fields can be removed with the trash icon</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Form2LeadEditor;