// components/dialogs/ProfileDetails.jsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Button } from '@/components/ui/button.jsx'
import { 
  Package, Calendar, Phone, User, Clock, MessageSquare, CheckCircle, 
  AlertCircle, XCircle, Building, Tag, Users, PhoneCall, Check, X,
  FileText, Download, Eye, Loader2
} from 'lucide-react'

const ProfileDetails = ({ open, onOpenChange, lead }) => {
  const { t, i18n } = useTranslation()
  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [docsError, setDocsError] = useState(null)
  
  const formatDate = (value) => {
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value))
    if (isNaN(date)) return value
    return date.toLocaleDateString(i18n.language, {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }
  
  const formatDateTime = (value) => {
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value))
    if (isNaN(date)) return value
    return date.toLocaleString(i18n.language, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  useEffect(() => {
    if (open && lead?.id) {
      fetchRelatedDocuments()
    }
  }, [open, lead?.id])

  if (!lead) return null

  const getFieldIcon = (key) => {
    const iconMap = {
      'status': AlertCircle, 'created_at': Calendar,
      'updated_at': Calendar, 'contact_person': Users
    }
    return iconMap[key] || null
  }

  const isBooleanField = (key, value, fieldType = null) => {
    if (fieldType) {
      return fieldType.toLowerCase() === 'boolean' || fieldType.toLowerCase() === 'bool'
    }
    const booleanFieldNames = [
      'active', 'inactive', 'enabled', 'disabled', 'verified', 'confirmed',
      'is_active', 'is_verified', 'is_enabled', 'is_primary', 'is_default',
      'has_', 'can_', 'should_', 'will_', 'allow_', 'enable_', 'disable_',
      'opted_in', 'opted_out', 'subscribed', 'unsubscribed',
      'priority', 'featured', 'published', 'archived', 'deleted'
    ]
    const keyLower = key.toLowerCase()
    const hasBooleanPattern = booleanFieldNames.some(pattern => 
      keyLower.includes(pattern) || keyLower.startsWith(pattern)
    )
    const isBooleanValue = [0, 1, true, false, '0', '1', 'true', 'false'].includes(value)
    return hasBooleanPattern && isBooleanValue
  }

  const handleDownloadDocument = async (docId, fileName) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/docs/download/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error(t('profile.errors.downloadFailed'))
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
    }
  }

  const handlePreviewDocument = (docId) => {
    const token = localStorage.getItem('auth_token')
    const previewUrl = `/api/docs/preview/${docId}?token=${token}&format=html`
    window.open(previewUrl, '_blank')
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return `0 ${t('profile.documents.bytes')}`
    const k = 1024
    const sizes = [t('profile.documents.bytes'), t('profile.documents.kb'), t('profile.documents.mb'), t('profile.documents.gb')]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return '📄'
    if (fileType?.includes('word') || fileType?.includes('document')) return '📝'
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet')) return '📊'
    if (fileType?.includes('image')) return '🖼️'
    return '📎'
  }

  const DocumentsSection = () => {
    const entityTypeName = lead.account_name ? t('profile.account') : t('profile.lead')

    const CardWrapper = ({ children }) => (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {t('profile.documents.title')} {documents.length > 0 && `(${documents.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    )

    if (loadingDocs) {
      return (
        <CardWrapper>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">{t('profile.documents.loading')}</span>
          </div>
        </CardWrapper>
      )
    }

    if (docsError) {
      return (
        <CardWrapper>
          <div className="text-red-600 text-center py-4">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            {docsError}
          </div>
        </CardWrapper>
      )
    }

    if (documents.length === 0) {
      return (
        <CardWrapper>
          <div className="text-gray-500 text-center py-4">
            {t('profile.documents.none', { type: entityTypeName })}
          </div>
        </CardWrapper>
      )
    }

    return (
      <CardWrapper>
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getFileIcon(doc.file_type)}</span>
                      <div className="font-medium text-sm truncate">{doc.file_name}</div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>{t('profile.documents.size')}: {formatFileSize(doc.file_size)}</div>
                      <div>{t('profile.documents.uploaded')}: {new Date(doc.created_at).toLocaleDateString(i18n.language)}</div>
                      {doc.uploaded_by_name && <div>{t('profile.documents.by')}: {doc.uploaded_by_name}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => handlePreviewDocument(doc.id)} className="h-8 w-8 p-0" title={t('profile.documents.preview')}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(doc.id, doc.file_name)} className="h-8 w-8 p-0" title={t('profile.documents.download')}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardWrapper>
    )
  }
  
  const getStatusColor = (status) => {
    const colors = {
      'new': 'bg-blue-100 text-blue-800', 'contacted': 'bg-yellow-100 text-yellow-800',
      'qualified': 'bg-green-100 text-green-800', 'proposal': 'bg-purple-100 text-purple-800',
      'negotiation': 'bg-orange-100 text-orange-800', 'closed-won': 'bg-green-100 text-green-800',
      'closed-lost': 'bg-red-100 text-red-800', 'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800', 'quoted': 'bg-blue-100 text-blue-800',
      'ordered': 'bg-purple-100 text-purple-800', 'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    }
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const getTaskStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-600" />
      case 'overdue': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getCallOutcomeColor = (outcome) => {
    const key = outcome?.toLowerCase().replace(' ', '_');
    const colors = {
      'successful': 'bg-green-100 text-green-800', 'no_answer': 'bg-red-100 text-red-800',
      'voicemail': 'bg-yellow-100 text-yellow-800', 'busy': 'bg-orange-100 text-orange-800',
      'disconnected': 'bg-red-100 text-red-800', 'meeting_scheduled': 'bg-blue-100 text-blue-800'
    }
    return colors[key] || 'bg-gray-100 text-gray-800'
  }
  
  const getCategoryColor = (category) => {
    const colors = {
      'sale': 'bg-green-100 text-green-800', 'follow-up': 'bg-blue-100 text-blue-800',
      'informational': 'bg-gray-100 text-gray-800', 'reminder': 'bg-yellow-100 text-yellow-800',
      'support': 'bg-purple-100 text-purple-800', 'meeting': 'bg-indigo-100 text-indigo-800',
      'negotiation': 'bg-orange-100 text-orange-800'
    }
    return colors[category?.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }
  
  const formatValue = (key, value, fieldType = null) => {
    if (isBooleanField(key, value, fieldType)) {
      const isChecked = [1, true, '1', 'true'].includes(value)
      return (
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${isChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>
            {isChecked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </div>
          <span className={`text-sm font-medium ${isChecked ? 'text-green-700' : 'text-gray-500'}`}>
            {isChecked ? t('profile.boolean.yes') : t('profile.boolean.no')}
          </span>
        </div>
      )
    }

    if (key === 'created_at' || key === 'updated_at') return formatDate(value)
    
    if (key === 'status' && typeof value === 'string') {
      return <Badge className={getStatusColor(value)}>{t(`profile.statuses.${value.toLowerCase()}`, { defaultValue: value })}</Badge>
    }
    
    if (key === 'assigned_products' && Array.isArray(value)) {
      if (value.length === 0) return <div className="text-gray-500 text-sm">{t('profile.noProductsAssigned')}</div>
      return (
        <div className="space-y-3">
          {value.map((product, index) => (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2"><Package className="h-4 w-4 text-blue-600" />{product.product_name}</div>
                    <div className="text-xs text-gray-600">{t('profile.productLabels.code')}: {product.product_code}</div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(product.status)}>{t(`profile.statuses.${product.status?.toLowerCase()}`, { defaultValue: product.status })}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>{t('profile.productLabels.quantity')}: {product.quantity}</div>
                  <div>{t('profile.productLabels.unitPrice')}: ${product.unit_price}</div>
                  <div>{t('profile.productLabels.total')}: ${(parseFloat(product.total_amount) || 0).toFixed(2)}</div>
                  {product.discount_percentage > 0 && <div>{t('profile.productLabels.discount')}: {product.discount_percentage}%</div>}
                </div>
                {product.notes && <div className="mt-2 p-2 bg-gray-50 rounded text-xs dark:bg-gray-900"><MessageSquare className="h-3 w-3 inline mr-1" />{product.notes}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (key === 'tasks' && Array.isArray(value)) {
      if (value.length === 0) return <div className="text-gray-500 text-sm">{t('profile.noTasks')}</div>
      return (
        <div className="space-y-3">
          {value.map((task, index) => (
            <Card key={index} className="border-l-4 border-l-green-500">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">{getTaskStatusIcon(task.task_status)}{task.task_name || task.task_description}</div>
                    {task.assigned_to_name && <div className="text-xs text-gray-600 flex items-center gap-1 mt-1"><User className="h-3 w-3" />{t('profile.taskLabels.assignedTo')}: {task.assigned_to_name}</div>}
                  </div>
                  <Badge variant="outline" className={getStatusColor(task.task_status)}>{t(`profile.statuses.${task.task_status?.toLowerCase()}`, { defaultValue: task.task_status })}</Badge>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  {task.deadline_date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t('profile.taskLabels.due')}: {formatDateTime(task.deadline_date)}</div>}
                  {task.task_priority && <div className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />{t('profile.taskLabels.priority')}: {task.task_priority}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if ((key === 'calls' || key === 'call_logs' || key === 'account_calls') && Array.isArray(value)) {
      if (value.length === 0) return <div className="text-gray-500 text-sm">{t('profile.noCalls')}</div>
      return (
        <div className="space-y-3">
          {value.slice(0, 5).map((call, index) => (
            <Card key={index} className="border-l-4 border-l-purple-500">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getCategoryColor(call.category)}>{t(`profile.categories.${call.category?.toLowerCase()}`, { defaultValue: call.category })}</Badge>
                    <Badge variant="outline" className={getCallOutcomeColor(call.call_outcome)}>{t(`profile.callOutcomes.${call.call_outcome?.toLowerCase().replace(' ', '_')}`, { defaultValue: call.call_outcome })}</Badge>
                  </div>
                  {call.call_duration && <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />{call.call_duration}m</Badge>}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-1"><PhoneCall className="h-3 w-3" />{formatDateTime(call.call_date)}</div>
                  {call.logged_by_name && <div className="flex items-center gap-1"><User className="h-3 w-3" />{t('profile.callLabels.loggedBy')}: {call.logged_by_name}</div>}
                  {call.contact_person && <div className="flex items-center gap-1"><Users className="h-3 w-3" />{t('profile.callLabels.contact')}: {call.contact_person}</div>}
                </div>
                {call.notes && <div className="mt-2 p-2 bg-gray-50 rounded text-xs dark:bg-gray-900"><MessageSquare className="h-3 w-3 inline mr-1" />{call.notes}</div>}
              </CardContent>
            </Card>
          ))}
          {value.length > 5 && <div className="text-xs text-gray-500 text-center">{t('profile.callLabels.moreCalls', { count: value.length - 5 })}</div>}
        </div>
      )
    }

    if (key === 'task_counts' && typeof value === 'object' && value !== null) {
      return (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-blue-50 rounded"><div className="text-lg font-bold text-blue-600">{value.total || 0}</div><div className="text-xs text-gray-600">{t('profile.taskCounts.total')}</div></div>
          <div className="p-2 bg-yellow-50 rounded"><div className="text-lg font-bold text-yellow-600">{value.pending || 0}</div><div className="text-xs text-gray-600">{t('profile.taskCounts.pending')}</div></div>
          <div className="p-2 bg-green-50 rounded"><div className="text-lg font-bold text-green-600">{value.completed || 0}</div><div className="text-xs text-gray-600">{t('profile.taskCounts.completed')}</div></div>
          <div className="p-2 bg-red-50 rounded"><div className="text-lg font-bold text-red-600">{value.overdue || 0}</div><div className="text-xs text-gray-600">{t('profile.taskCounts.overdue')}</div></div>
        </div>
      )
    }

    if (typeof value === 'object' && value !== null) {
      return <Card className="bg-gray-50"><CardContent className="p-3"><pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre></CardContent></Card>
    }

    return value
  }

  const basicFields = [], contactFields = [], businessFields = [], systemFields = [], complexFields = []

  Object.entries(lead).forEach(([key, value]) => {
    if (!value || key === 'id') return
    const contactKeywords = ['email', 'phone', 'first_name', 'last_name', 'primary_contact']
    const businessKeywords = ['company', 'account_name', 'industry', 'account_type', 'address', 'city', 'state', 'zip', 'postal', 'country']
    const systemKeywords = ['created_at', 'updated_at', 'status']
    const complexKeywords = ['assigned_products', 'tasks', 'calls', 'call_logs', 'account_calls', 'task_counts']
    if (complexKeywords.some(keyword => key.includes(keyword))) complexFields.push([key, value])
    else if (contactKeywords.some(keyword => key.includes(keyword))) contactFields.push([key, value])
    else if (businessKeywords.some(keyword => key.includes(keyword))) businessFields.push([key, value])
    else if (systemKeywords.some(keyword => key.includes(keyword))) systemFields.push([key, value])
    else if (key === 'custom_fields' && Array.isArray(value)) value.forEach(cf => basicFields.push([cf.field_name, cf.value, cf.field_type, cf.field_label]))
    else if (key === 'notes') basicFields.unshift([key, value])
  })

  const fetchRelatedDocuments = async () => {
    if (!lead?.id) return
    setLoadingDocs(true)
    setDocsError(null)
    try {
      const entityType = (lead.account_name && lead.account_type) ? 'account' : 'lead'
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/docs/entity/${entityType}/${lead.id}?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error(t('profile.errors.fetchFailed'))
      const data = await response.json()
      setDocuments(data.data)
    } catch (error) {
      console.error('Error fetching documents:', error)
      setDocsError(t('profile.errors.loadFailed'))
    } finally {
      setLoadingDocs(false)
    }
  }

  const isAccount = lead.account_name && lead.account_type
  const title = isAccount ? t('profile.accountTitle') : t('profile.leadTitle')
  const displayName = isAccount ? lead.account_name : `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
  
  const renderFieldGroup = (fields, titleKey, icon) => {
    if (fields.length === 0) return null
    const Icon = icon
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{t(titleKey)}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
<div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            {fields.map(([key, value, fieldType, fieldLabel]) => {
              const FieldIcon = getFieldIcon(key)
              const label = fieldLabel || t(`profile.fields.${key}`, { defaultValue: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })
              return (
<div key={key} className="flex flex-col sm:flex-row sm:items-start gap-2">
                  {FieldIcon && <FieldIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-500">{label}</div>
                    <div className="text-sm break-words">{formatValue(key, value, fieldType)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none !w-[95vw] sm:!w-[90vw] lg:!w-[80vw] xl:!w-[70vw] max-h-[85vh] p-1">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">{isAccount ? <Building className="h-5 w-5" /> : <User className="h-5 w-5" />}{title}</DialogTitle>
          <DialogDescription>{t('profile.description', { name: displayName })}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-120px)]">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {renderFieldGroup(contactFields, 'profile.contactInfo', User)}
            {renderFieldGroup(businessFields, 'profile.businessInfo', Building)}
            {renderFieldGroup(basicFields, 'profile.additionalInfo', Tag)}
            <DocumentsSection />
            {complexFields.map(([key, value]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {key.includes('product') && <Package className="h-4 w-4" />}
                    {key.includes('task') && <Calendar className="h-4 w-4" />}
                    {key.includes('call') && <Phone className="h-4 w-4" />}
                    {t(`profile.fields.${key}`, { defaultValue: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })}
                  </CardTitle>
                </CardHeader>
                <CardContent>{formatValue(key, value)}</CardContent>
              </Card>
            ))}
            {renderFieldGroup(systemFields, 'profile.systemInfo', Clock)}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileDetails