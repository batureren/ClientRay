import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { PhoneCall, Phone, MoreHorizontal, Package, Eye, Edit, Trash2, Calendar, User, History, Plus, Clock, ChevronLeft, ChevronRight, Loader2, Mail, Users, Columns, GripVertical, ChevronDown, ChevronUp, Folder, Building } from 'lucide-react';
import SearchComponent from '../ui/SearchComponent';
import AssignProductDialog from '../dialogs/AssignProductDialog';
import ProfileDetails from '../dialogs/ProfileDetails';
import EditProductDialog from '../dialogs/EditProductDialog';
import CreateTaskDialog from '../dialogs/CreateTaskDialog';
import RelatedTasksSection from '../sections/RelatedTasksSection';
import EditAccountDialog from '../dialogs/EditAccountDialog';
import AccountHistoryDialog from '../dialogs/AccountHistoryDialog';
import DeleteAccountDialog from '../dialogs/DeleteAccountDialog';
import AccountCallHistoryDialog from '../dialogs/AccountCallHistoryDialog';
import CreateAccountCallDialog from '../dialogs/CreateAccountCallDialog';
import UploadDocDialog from '../dialogs/UploadDocDialog';
import SendEmailDialog from '../dialogs/SendEmailDialog';
import { RelationshipBadge, RelationshipsSection } from '@/components/PersonRelationship';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/services/api';

const SortableFieldItem = ({ id, label, isChecked, onCheckedChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded cursor-pointer touch-none border">
      <button {...attributes} {...listeners} className="cursor-grab p-1">
        <GripVertical className="h-5 w-5 text-gray-400" />
      </button>
      <input type="checkbox" checked={isChecked} onChange={onCheckedChange} className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
      <span className="text-sm select-none">{label}</span>
    </div>
  );
};

const AccountsTab = ({ products, users, user }) => {
  const { t, i18n } = useTranslation();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showAssignProductDialog, setShowAssignProductDialog] = useState(false);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedProductAssignment, setSelectedProductAssignment] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedProductRows, setExpandedProductRows] = useState(new Set());
  const [expandedTaskRows, setExpandedTaskRows] = useState(new Set());
  const [mobileExpandedRows, setMobileExpandedRows] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [accountHistory, setAccountHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCallHistoryDialog, setShowCallHistoryDialog] = useState(false);
  const [showCreateCallDialog, setShowCreateCallDialog] = useState(false);
  const [showUploadDocDialog, setShowUploadDocDialog] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [selectedAccountForEmail, setSelectedAccountForEmail] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [showRelationshipsSection, setShowRelationshipsSection] = useState(false);
  const [selectedAccountForRelationships, setSelectedAccountForRelationships] = useState(null);
  const [relationshipCounts, setRelationshipCounts] = useState({});
  const [relationshipLoading, setRelationshipLoading] = useState(false);

  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  const defaultFields = ['account_details', 'contact', 'type_industry', 'products', 'total_value', 'tasks', 'calls', 'relationships', 'actions'];
  
const fetchRelationshipCounts = async (accountIds) => {
  if (accountIds.length === 0) return;
  setRelationshipLoading(true);
  try {
    const entities = accountIds.map(id => ({ type: 'account', id }));
    const response = await api.post('/relationships/counts', { entities });
    setRelationshipCounts(response.data);
  } catch (error) { 
    console.error('Error fetching relationship counts:', error); 
    setRelationshipCounts({}); 
  }
  setRelationshipLoading(false);
};
  
const fetchAccounts = async (page = currentPage, limit = itemsPerPage, search = searchTerm) => {
  setLoading(true);
  try {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (search && search.trim()) params.append('search', search.trim());
    
    const response = await api.get(`/accounts?${params.toString()}`);
    
    if (response.data && response.data.data && response.data.pagination) {
      setAccounts(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
      setCurrentPage(response.data.pagination.currentPage);
      await fetchRelationshipCounts(response.data.data.map(acc => acc.id));
    } else {
      setAccounts(Array.isArray(response.data) ? response.data : []);
      setTotalItems(Array.isArray(response.data) ? response.data.length : 0);
      setTotalPages(1);
    }
  } catch (error) { 
    console.error('Error fetching accounts:', error); 
    setAccounts([]); 
    setTotalItems(0); 
    setTotalPages(0); 
  }
  setLoading(false);
};

  const initializeView = async () => {
    setFieldsLoading(true);
    try {
      const [standardFieldsResponse, allCustomFields] = await Promise.all([
        api.get('/field-definitions/accounts'),
        api.get('/custom-fields')
      ]);

      const standardFields = (standardFieldsResponse.data || []).map(f => ({ ...f, isStandard: true }));
      
      const accountCustomFields = (allCustomFields.data || [])
        .filter(field => field.module === 'accounts')
        .map(field => ({
          name: field.field_name,
          label: field.field_label,
          type: field.field_type,
          isStandard: false
        }));

      const clientSideFields = [
        { name: 'account_details', label: t('accountsTab.table.accountName'), type: 'custom', isStandard: true },
        { name: 'contact', label: t('accountsTab.table.contact'), type: 'custom', isStandard: true },
        { name: 'type_industry', label: t('accountsTab.table.typeIndustry'), type: 'custom', isStandard: true },
        { name: 'products', label: t('accountsTab.table.products'), type: 'custom', isStandard: true },
        { name: 'total_value', label: t('accountsTab.table.total'), type: 'custom', isStandard: true },
        { name: 'tasks', label: t('accountsTab.table.tasks'), type: 'custom', isStandard: true },
        { name: 'calls', label: t('accountsTab.table.calls'), type: 'custom', isStandard: true },
        { name: 'relationships', label: t('accountsTab.table.relations'), type: 'custom', isStandard: true },
        { name: 'actions', label: t('accountsTab.table.actions'), type: 'custom', align: 'right', isStandard: true },
      ];

      const excludedIndividualFields = [
        'account_name', 'primary_contact_first_name', 'primary_contact_last_name', 'primary_contact_email', 'primary_contact_phone',
        'account_type', 'industry', 'created_at', 'updated_at', 'company_name'
      ];
      
      const pickableApiFields = [...standardFields, ...accountCustomFields].filter(
        field => !excludedIndividualFields.includes(field.name)
      );

      const allAvailableFields = [...clientSideFields, ...pickableApiFields];

      const uniqueFieldsMap = new Map();
      allAvailableFields.forEach(field => {
        if (!uniqueFieldsMap.has(field.name)) {
          uniqueFieldsMap.set(field.name, field);
        }
      });
      
      setAvailableFields(Array.from(uniqueFieldsMap.values()));
      
      try {
        const layoutResponse = await api.get('/users/preferences/account-layout');
        setSelectedFields(layoutResponse.data.selected_fields);
      } catch (e) {
        setSelectedFields(defaultFields);
      }
    } catch (error) {
      console.error('Error initializing accounts view:', error);
      setAvailableFields([]);
      setSelectedFields(defaultFields);
    }
    setFieldsLoading(false);
    fetchAccounts(1, itemsPerPage, '');
  };

  useEffect(() => { initializeView(); }, []);
  
  const handleShowRelationships = (account) => { setSelectedAccountForRelationships(account); setShowRelationshipsSection(true); };
  const handleRelationshipsUpdated = () => fetchRelationshipCounts(accounts.map(acc => acc.id));
  const getRelationshipCount = (accountId) => relationshipCounts[`account_${accountId}`]?.total || 0;
  
  const handlePageChange = (page) => { setCurrentPage(page); fetchAccounts(page, itemsPerPage, searchTerm); };
  const handleItemsPerPageChange = (value) => { const newLimit = parseInt(value); setItemsPerPage(newLimit); setCurrentPage(1); fetchAccounts(1, newLimit, searchTerm); };
  const handleUploadDoc = (account) => { setSelectedAccount(account); setShowUploadDocDialog(true); };
  const handlePreviousPage = () => { if (currentPage > 1) { const newPage = currentPage - 1; setCurrentPage(newPage); fetchAccounts(newPage, itemsPerPage, searchTerm); } };
  const handleNextPage = () => { if (currentPage < totalPages) { const newPage = currentPage + 1; setCurrentPage(newPage); fetchAccounts(newPage, itemsPerPage, searchTerm); } };
  const handleUploadSuccess = () => setShowUploadDocDialog(false);
  
  const handleSendEmail = (account) => {
    setSelectedAccountForEmail(account);
    setShowSendEmailDialog(true);
  };
  
  const getPageNumbers = () => {
    const delta = 2, range = [], rangeWithDots = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) range.push(i);
    if (currentPage - delta > 2) rangeWithDots.push(1, '...'); else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) rangeWithDots.push('...', totalPages); else rangeWithDots.push(totalPages);
    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };
  
  const formatDate = (dateString) => new Date(dateString).toLocaleString(i18n.language);
  const handleShowCallHistory = (account) => { setSelectedAccount(account); setShowCallHistoryDialog(true); };
  const handleCreateCall = (account) => { setSelectedAccount(account); setShowCreateCallDialog(true); };
  const handleCallCreated = () => { setShowCreateCallDialog(false); setSelectedAccount(null); fetchAccounts(currentPage, itemsPerPage, searchTerm); };
  
  const handleSearch = async (searchValue, showAll = false) => { const newSearchTerm = showAll ? '' : searchValue; setSearchTerm(newSearchTerm); await fetchAccounts(1, itemsPerPage, newSearchTerm); return totalItems; };
  const handleProductAssigned = async () => { setShowAssignProductDialog(false); setSelectedAccount(null); await fetchAccounts(currentPage, itemsPerPage, searchTerm); };
  const handleProductUpdated = async () => { setShowEditProductDialog(false); setSelectedProductAssignment(null); setSelectedAccount(null); await fetchAccounts(currentPage, itemsPerPage, searchTerm); };
  const handleEditProduct = (account, productAssignment) => { setSelectedAccount(account); setSelectedProductAssignment(productAssignment); setShowEditProductDialog(true); };
  
  const handleDeleteConfirmed = async (accountId) => {
    setIsDeleting(true);
    try {
      await api.delete(`/accounts/${accountId}`);
      const newTotalItems = totalItems - 1;
      const newTotalPages = Math.ceil(newTotalItems / itemsPerPage);
      const pageToFetch = currentPage > newTotalPages ? Math.max(1, newTotalPages) : currentPage;
      await fetchAccounts(pageToFetch, itemsPerPage, searchTerm);
    } catch (error) { console.error('Error deleting account:', error); }
    setIsDeleting(false); setShowDeleteDialog(false); setSelectedAccount(null);
  };
  
  const handleDeleteProduct = async (accountId, productAssignmentId) => {
    if (!confirm(t('accountsTab.product.deleteConfirm'))) return;
    try { await api.delete(`/accounts/${accountId}/products/${productAssignmentId}`); await fetchAccounts(currentPage, itemsPerPage, searchTerm); } 
    catch (error) { console.error('Error removing product:', error); alert(t('accountsTab.errors.productRemoveFailed')); }
  };
  
  const handleCreateTask = (account) => { setSelectedAccount(account); setShowCreateTaskDialog(true); };
  const handleTaskCreated = () => { setShowCreateTaskDialog(false); setSelectedAccount(null); fetchAccounts(currentPage, itemsPerPage, searchTerm); };
  const handleTasksUpdated = () => fetchAccounts(currentPage, itemsPerPage, searchTerm);
  const handleAccountUpdated = () => { setShowEditAccountDialog(false); setSelectedAccount(null); fetchAccounts(currentPage, itemsPerPage, searchTerm); };
  
  const fetchAccountHistory = async (accountId) => {
    setHistoryLoading(true);
    try { const history = await api.get(`/accounts/${accountId}/history`); setAccountHistory(history.data); } 
    catch (error) { console.error('Error fetching account history:', error); setAccountHistory([]); }
    setHistoryLoading(false);
  };
  
  const handleShowHistory = async (account) => { setSelectedAccount(account); await fetchAccountHistory(account.id); setShowHistoryDialog(true); };
  
  const getCallCountBadge = (account) => {
    const counts = account.call_counts;
    if (!counts || counts.total === 0) return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />0</Badge>;
    const badgeText = t('accountsTab.calls.recentBadge', { total: counts.total, count: counts.recent });
    if (counts.recent > 0) return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />{badgeText}</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />{counts.total}</Badge>;
  };
  
  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'created': return <Plus className="h-4 w-4 text-green-600" />;
      case 'updated': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'product_assigned': return <Package className="h-4 w-4 text-purple-600" />;
      case 'product_updated': return <Edit className="h-4 w-4 text-orange-600" />;
      case 'product_removed': return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'task_created': return <Calendar className="h-4 w-4 text-cyan-600" />;
      case 'deleted': return <User className="h-4 w-4 text-red-600" />;
      default: return <History className="h-4 w-4 text-gray-600" />;
    }
  };
  
  const toggleProductExpansion = (accountId) => { const newExpanded = new Set(expandedProductRows); if (newExpanded.has(accountId)) newExpanded.delete(accountId); else newExpanded.add(accountId); setExpandedProductRows(newExpanded); };
  const toggleTaskExpansion = (accountId) => { const newExpanded = new Set(expandedTaskRows); if (newExpanded.has(accountId)) newExpanded.delete(accountId); else newExpanded.add(accountId); setExpandedTaskRows(newExpanded); };
  const toggleMobileExpansion = (accountId) => { const newExpanded = new Set(mobileExpandedRows); if (newExpanded.has(accountId)) newExpanded.delete(accountId); else newExpanded.add(accountId); setMobileExpandedRows(newExpanded); };
  const getStatusColor = (status) => ({ 'quoted': 'default', 'ordered': 'secondary', 'delivered': 'default', 'cancelled': 'destructive' })[status] || 'default';
  const calculateAccountTotal = (assignedProducts) => (assignedProducts || []).reduce((total, product) => total + (parseFloat(product.total_amount) || 0), 0);
  
  const getTaskCountBadge = (account) => {
    const counts = account.task_counts;
    if (!counts || counts.total === 0) return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">0</Badge>;
    const badgeText = (type, count) => t(`accountsTab.tasks.${type}Badge`, { total: counts.total, count });
    if (counts.overdue > 0) return <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">{badgeText('overdue', counts.overdue)}</Badge>;
    if (counts.pending > 0) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">{badgeText('pending', counts.pending)}</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">{counts.total}</Badge>;
  };

  const toggleFieldSelection = (fieldName) => {
    setSelectedFields(prev => prev.includes(fieldName) ? prev.filter(name => name !== fieldName) : [...prev.filter(n => n !== 'actions'), fieldName, ...(prev.includes('actions') ? ['actions'] : [])]);
  };

  const handleSaveLayout = async () => {
    try {
      await api.put('/users/preferences/account-layout', { selected_fields: selectedFields });
      setShowFieldSelector(false);
    } catch (error) {
      console.error('Error saving account layout:', error);
    }
  };

  const getSelectedFieldObjects = () => {
    return selectedFields.map(fieldName => availableFields.find(f => f.name === fieldName)).filter(Boolean);
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSelectedFields((items) => {
        const sortableItems = items.filter(i => i !== 'actions');
        const oldIndex = sortableItems.indexOf(active.id);
        const newIndex = sortableItems.indexOf(over.id);
        const reorderedSortable = arrayMove(sortableItems, oldIndex, newIndex);
        return items.includes('actions') ? [...reorderedSortable, 'actions'] : reorderedSortable;
      });
    }
  };

  const getDisplayValue = (account, field) => {
    switch(field.name) {
      case 'account_details':
        return (
          <div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="p-1 h-auto" onClick={() => { setSelectedAccount(account); setShowProfile(true); }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person-vcard-fill" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm9 1.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 0-1h-4a.5.5 0 0 0-.5.5M9 8a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 0-1h-4A.5.5 0 0 0 9 8m1 2.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1h-3a.5.5 0 0 0-.5.5m-1 2C9 10.567 7.21 9 5 9c-2.086 0-3.8 1.398-3.984 3.181A1 1 0 0 0 2 13h6.96q.04-.245.04-.5M7 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0"/></svg></Button>
              <div className="truncate text-sm font-medium">{account.account_name}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1 pl-8">{t('accountsTab.createdLabel')}: {formatDate(account.created_at)}</div>
            <div className="text-xs text-muted-foreground pl-8">{t('accountsTab.updatedLabel')}: {formatDate(account.updated_at)}</div>
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Building className="h-3 w-3" />
        <div className="truncate text-sm">{account.company_name}</div>
      </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <button
                onClick={() => handleSendEmail(account)}
                className="truncate max-w-[120px] hover:underline text-blue-600 hover:text-blue-800"
              >
                {account.primary_contact_email}
              </button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /><a href={`tel:${account.primary_contact_phone}`} className="hover:underline">{account.primary_contact_phone}</a></div>
          </div>
        );
      case 'type_industry':
        return (
          <div className="space-y-1">
            <Badge variant="outline" className="text-xs">{account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}</Badge>
            <div className="text-xs text-muted-foreground truncate">{account.industry}</div>
          </div>
        );
      case 'products':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{t('accountsTab.product.count', { count: (account.assigned_products || []).length })}</Badge>
            {(account.assigned_products || []).length > 0 && 
                <Button size="sm" variant="ghost" onClick={() => toggleProductExpansion(account.id)} className="h-6 px-1">
                    {expandedProductRows.has(account.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            }
          </div>
        );
      case 'total_value':
        return <div className="font-medium text-sm">${calculateAccountTotal(account.assigned_products).toFixed(2)}</div>;
      case 'tasks':
        return (
            <div className="flex items-center gap-2">
                {getTaskCountBadge(account)}
                <Button size="sm" variant="ghost" onClick={() => toggleTaskExpansion(account.id)} className="h-6 px-1">
                    {expandedTaskRows.has(account.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            </div>
        );
      case 'calls':
        return <Button size="sm" variant="ghost" onClick={() => handleShowCallHistory(account)} className="p-0 h-auto">{getCallCountBadge(account)}</Button>;
      case 'relationships':
        return <RelationshipBadge count={getRelationshipCount(account.id)} onClick={() => handleShowRelationships(account)} loading={relationshipLoading}/>;
      case 'actions':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">{t('accountsTab.openMenu')}</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShowRelationships(account)}><Users className="h-4 w-4 mr-2" />{t('accountsTab.actions.relationships')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateCall(account)}><Phone className="h-4 w-4 mr-2" />{t('accountsTab.actions.logCall')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowCallHistory(account)}><PhoneCall className="h-4 w-4 mr-2" />{t('accountsTab.actions.callHistory')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowHistory(account)}><History className="h-4 w-4 mr-2" />{t('accountsTab.actions.accountHistory')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedAccount(account); setShowAssignProductDialog(true); }}><Package className="h-4 w-4 mr-2" />{t('accountsTab.actions.assignProduct')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUploadDoc(account)}><Folder className="h-4 w-4 mr-2" />{t('docsTab.uploadButton')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateTask(account)}><Calendar className="h-4 w-4 mr-2" />{t('accountsTab.actions.addTask')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedAccount(account); setShowEditAccountDialog(true); }}><Edit className="h-4 w-4 mr-2" />{t('accountsTab.actions.edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedAccount(account); setShowDeleteDialog(true); }} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{t('accountsTab.actions.delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      default:
        if (account.hasOwnProperty(field.name)) return account[field.name] || '-';
        if (account.custom_fields && Array.isArray(account.custom_fields)) {
          const customField = account.custom_fields.find(cf => cf.field_name === field.name);
          if (customField && customField.value) {
            try {
              const parsed = JSON.parse(customField.value);
              if (Array.isArray(parsed)) {
                return parsed.join(', ');
              }
            } catch {
              // not JSON, return raw value
            }
            return customField.value;
          }
          return '-';
        }
        return '-';
    }
  };

  if (fieldsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showRelationshipsSection && selectedAccountForRelationships ? (
        <RelationshipsSection
          entityType="account"
          entityId={selectedAccountForRelationships.id}
          entityName={selectedAccountForRelationships.account_name}
          
          onClose={() => { setShowRelationshipsSection(false); setSelectedAccountForRelationships(null); handleRelationshipsUpdated(); }}
        />
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">{t('accountsTab.title')}</h2>
            <Button variant="outline" onClick={() => setShowFieldSelector(true)}>
              <Columns className="h-4 w-4 mr-2" /> {t('common.fields')}
            </Button>
          </div>
          {showFieldSelector && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-end">
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedFields(defaultFields)}>{t('common.resetToDefault')}</Button>
                    <Button size="sm" onClick={handleSaveLayout}>{t('common.done')}</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('leadsTab.fields.visible')}</h3>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={selectedFields.filter(f => f !== 'actions')} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {selectedFields.filter(f => f !== 'actions').map(fieldName => {
                            const field = availableFields.find(f => f.name === fieldName);
                            return field ? <SortableFieldItem key={field.name} id={field.name} label={field.label} isChecked={true} onCheckedChange={() => toggleFieldSelection(field.name)} /> : null;
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    {selectedFields.includes('actions') && (
                       <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded mt-2 border border-dashed">
                        <GripVertical className="h-5 w-5 text-gray-300 dark:text-gray-500" />
                        <input type="checkbox" checked={true} disabled className="rounded"/>
                        <span className="text-sm text-gray-500 dark:text-gray-400 select-none">{t('accountsTab.table.actions')}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('leadsTab.fields.standard')}</h3>
                    <div className="space-y-2">
                      {availableFields.filter(f => f.isStandard && !selectedFields.includes(f.name)).map(field => (
                        <div key={field.name} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border">
                          <input type="checkbox" checked={false} onChange={() => toggleFieldSelection(field.name)} className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                          <span className="text-sm">{field.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('leadsTab.fields.custom')}</h3>
                    <div className="space-y-2">
                      {availableFields.filter(f => !f.isStandard && !selectedFields.includes(f.name)).map(field => (
                        <div key={field.name} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border">
                          <input type="checkbox" checked={false} onChange={() => toggleFieldSelection(field.name)} className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                          <span className="text-sm">{field.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>{t('accountsTab.allAccounts')}</CardTitle>
                  <CardDescription>{t('accountsTab.description')}</CardDescription>
                </div>
                <SearchComponent onSearch={handleSearch} placeholder={t('accountsTab.searchPlaceholder')} initialValue={searchTerm}/>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {loading ? ( <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div> ) : ( t('accountsTab.pagination.showing', { start: totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, end: Math.min(currentPage * itemsPerPage, totalItems), total: totalItems }) )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">{t('accountsTab.pagination.perPage')}</label>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange} disabled={loading}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1 || loading}><ChevronLeft className="h-4 w-4" /></Button>
                    {getPageNumbers().map((pageNum, index) => ( <Button key={index} variant={pageNum === currentPage ? "default" : "outline"} size="sm" onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)} disabled={pageNum === '...' || loading} className="min-w-[40px]">{pageNum}</Button> ))}
                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages || loading}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">{t('accountsTab.loadingAccounts')}</span>
                </div>
              ) : (
                <>
                  <div className="md:hidden">
                    {accounts.map((account) => {
                      const isMobileExpanded = mobileExpandedRows.has(account.id);
                      const fieldObjects = getSelectedFieldObjects();
                      const primaryFields = fieldObjects.slice(0, 3);
                      const secondaryFields = fieldObjects.slice(3);

                      return (
                        <Card key={account.id} className="m-2 border">
                          <CardContent className="p-4 space-y-3">
                            {primaryFields.map(field => (
                              <div key={field.name} className="flex justify-between items-start gap-2">
                                <span className="text-sm font-medium text-muted-foreground w-1/3">{field.label}:</span>
                                <div className="w-2/3 flex justify-end text-right">{getDisplayValue(account, field)}</div>
                              </div>
                            ))}
                            {isMobileExpanded && secondaryFields.length > 0 && (
                              <div className="pt-2 border-t space-y-3">
                                {secondaryFields.map(field => (
                                  <div key={field.name} className="flex justify-between items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground w-1/3">{field.label}:</span>
                                    <div className="w-2/3 flex justify-end text-right">{getDisplayValue(account, field)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {expandedProductRows.has(account.id) && (account.assigned_products || []).length > 0 && (
                                <div className="pt-2 mt-2 border-t">
                                    <h4 className="font-medium my-2 text-sm">{t('accountsTab.product.title')}</h4>
                                    <div className="space-y-2">
                                        {(account.assigned_products || []).map((p, index) => (
                                            <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                                                <div className="font-bold">{p.product_name}</div>
                                                <div>{t('accountsTab.product.qty')}: {p.quantity} @ ${p.unit_price} = ${(parseFloat(p.total_amount) || 0).toFixed(2)}</div>
                                                <div className="flex items-center justify-between mt-1">
                                                  <Badge variant={getStatusColor(p.status)}>{t(`profile.statuses.${p.status.toLowerCase()}`, { defaultValue: p.status.charAt(0).toUpperCase() + p.status.slice(1) })}</Badge>
                                                  <div>
                                                    <Button size="icon" variant="ghost" onClick={() => handleEditProduct(account, p)} className="h-6 w-6"><Edit className="h-3 w-3" /></Button>
                                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(account.id, p.id)} className="h-6 w-6 text-red-600 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
                                                  </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {expandedTaskRows.has(account.id) && (
                              <div className="pt-2 mt-2 border-t">
                                  <RelatedTasksSection
                                      relatedTo={account}
                                      relatedType="account"
                                      
                                      users={users}
                                      user={user}
                                      onTaskUpdate={handleTasksUpdated}
                                      existingTasks={account.tasks || []}
                                  />
                              </div>
                            )}
                            {secondaryFields.length > 0 && (
                              <div className="pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMobileExpansion(account.id)}
                                  className="w-full"
                                >
                                  {isMobileExpanded ? 'Show Less' : `Show More (${secondaryFields.length})`}
                                  {isMobileExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {getSelectedFieldObjects().map(field => (
                            <TableHead key={field.name} className={field.align === 'right' ? 'text-right' : ''}>{field.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts && accounts.map((account) => (
                          <Fragment key={account.id}>
                            <TableRow>
                              {getSelectedFieldObjects().map(field => (
                                  <TableCell key={field.name} className={`max-w-30 w-fit overflow-hidden ${field.align === 'right' ? 'text-right' : ''}`}>
                                      {getDisplayValue(account, field)}
                                  </TableCell>
                              ))}
                            </TableRow>
                            {expandedProductRows.has(account.id) && (account.assigned_products || []).length > 0 && (
                              <TableRow>
                                <TableCell colSpan={selectedFields.length} className="bg-muted/50">
                                  <div className="p-4">
                                    <h4 className="font-medium mb-3">{t('accountsTab.product.title')}</h4>
                                    <div className="grid gap-2">
                                      {(account.assigned_products || []).map((p, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded border">
                                          <div className="flex-1">
                                            <div className="font-medium">{p.product_name} ({p.product_code})</div>
                                            <div className="text-sm text-muted-foreground">{t('accountsTab.product.qty')}: {p.quantity} | {t('accountsTab.product.unit')}: ${p.unit_price} | {t('accountsTab.product.total')}: ${(parseFloat(p.total_amount) || 0).toFixed(2)}{p.discount_percentage > 0 && <span> ({t('accountsTab.product.discount')}: {p.discount_percentage}%)</span>}</div>
                                            {p.notes && <div className="text-sm text-muted-foreground mt-1">{t('accountsTab.product.notes')}: {p.notes}</div>}
                                          </div>
                                          <div className='flex flex-col p-2 text-xs text-muted-foreground'>
                                            <div>{t('accountsTab.product.created_at')}: {formatDate(p.created_at)}</div>
                                            {p.purchase_date && <div>{t('accountsTab.product.purchase_date')}: {formatDate(p.purchase_date)}</div>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={getStatusColor(p.status)}>{t(`profile.statuses.${p.status.toLowerCase()}`, { defaultValue: p.status.charAt(0).toUpperCase() + p.status.slice(1) })}</Badge>
                                            <Button size="sm" variant="ghost" onClick={() => handleEditProduct(account, p)}><Edit className="h-4 w-4" /></Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(account.id, p.id)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {expandedTaskRows.has(account.id) && (
                              <TableRow>
                                <TableCell colSpan={selectedFields.length} className="bg-muted/50 p-4">
                                   <RelatedTasksSection
                                      relatedTo={account}
                                      relatedType="account"
                                      
                                      users={users}
                                      user={user}
                                      onTaskUpdate={handleTasksUpdated}
                                      existingTasks={account.tasks || []}
                                    />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {accounts.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">{t('accountsTab.noAccounts')}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <AssignProductDialog open={showAssignProductDialog} onOpenChange={setShowAssignProductDialog} selectedAccount={selectedAccount} products={products} onProductAssigned={handleProductAssigned} />
      <EditProductDialog open={showEditProductDialog} onOpenChange={setShowEditProductDialog} selectedAccount={selectedAccount} productAssignment={selectedProductAssignment} products={products} onProductUpdated={handleProductUpdated} />
      <EditAccountDialog open={showEditAccountDialog} onOpenChange={setShowEditAccountDialog} account={selectedAccount} onAccountUpdated={handleAccountUpdated} />
      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} account={selectedAccount} onDeleteConfirmed={handleDeleteConfirmed} isLoading={isDeleting}/>
      <AccountHistoryDialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog} account={selectedAccount} history={accountHistory} isLoading={historyLoading} formatDate={formatDate} getActionIcon={getActionIcon}/>
      <CreateTaskDialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog} onTaskCreated={handleTaskCreated}  users={users} relatedTo={selectedAccount} relatedType="account"/>
      <ProfileDetails open={showProfile} onOpenChange={setShowProfile} lead={selectedAccount}/>
      <AccountCallHistoryDialog open={showCallHistoryDialog} onOpenChange={setShowCallHistoryDialog} account={selectedAccount} user={user} onCallUpdated={handleCallCreated}/>
      <CreateAccountCallDialog open={showCreateCallDialog} onOpenChange={setShowCreateCallDialog} account={selectedAccount}  onCallCreated={handleCallCreated}/>
      <UploadDocDialog open={showUploadDocDialog} onOpenChange={setShowUploadDocDialog} person={selectedAccount} onUploadSuccess={handleUploadSuccess} uploadType={"account"} />
      <SendEmailDialog
        open={showSendEmailDialog}
        onOpenChange={setShowSendEmailDialog}
        recipient={selectedAccountForEmail?.primary_contact_email}
        recipientName={selectedAccountForEmail ? `${selectedAccountForEmail.primary_contact_first_name} ${selectedAccountForEmail.primary_contact_last_name}` : ''}
      />
    </div>
  );
};

export default AccountsTab;