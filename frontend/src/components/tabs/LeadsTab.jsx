// frontend/components/tabs/LeadsTab.jsx

import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Plus, MoreHorizontal, Edit, Trash2, ArrowRight, History, Clock, User, Calendar, Phone, Mail, Building, PhoneCall, ChevronLeft, ChevronRight, Loader2, Users, Columns, ChevronDown, ChevronUp, GripVertical, Folder } from 'lucide-react';
import { getStatusBadge } from '../ui/StatusBadge';
import SearchComponent from '../ui/SearchComponent';
import CreateTaskDialog from '../dialogs/CreateTaskDialog';
import CreateLeadDialog from '../dialogs/CreateLeadDialog';
import ConvertLeadDialog from '../dialogs/ConvertLeadDialog';
import EditLeadDialog from '../dialogs/EditLeadDialog';
import DeleteLeadDialog from '../dialogs/DeleteLeadDialog';
import ProfileDetails from '../dialogs/ProfileDetails';
import LeadHistoryDialog from '../dialogs/LeadHistoryDialog';
import CreateLeadCallDialog from '../dialogs/CreateLeadCallDialog';
import LeadCallHistoryDialog from '../dialogs/LeadCallHistoryDialog';
import RelatedTasksSection from '../sections/RelatedTasksSection';
import UploadDocDialog from '../dialogs/UploadDocDialog';
import SendEmailDialog from '../dialogs/SendEmailDialog';
import { RelationshipBadge, RelationshipsSection } from '@/components/PersonRelationship';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/services/api';
import { useAuthContext } from '@/context/AuthContext';

const SortableFieldItem = ({ id, label, isChecked, onCheckedChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded cursor-pointer touch-none border"
    >
      <button {...attributes} {...listeners} className="cursor-grab p-1">
        <GripVertical className="h-5 w-5 text-gray-400" />
      </button>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onCheckedChange}
        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
      />
      <span className="text-sm select-none">{label}</span>
    </div>
  );
};

// Updated signature to accept canEdit/canDelete
const LeadsTab = ({ users, user, canEdit, canDelete }) => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuthContext();

  // State is completely managed here now
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [leadHistory, setLeadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCreateLeadCallDialog, setShowCreateLeadCallDialog] = useState(false);
  const [showLeadCallHistoryDialog, setShowLeadCallHistoryDialog] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState(null);
  const [showRelationshipsSection, setShowRelationshipsSection] = useState(false);
  const [showUploadDocDialog, setShowUploadDocDialog] = useState(false);
  const [selectedEntityForRelationships, setSelectedEntityForRelationships] = useState(null);
  const [relationshipCounts, setRelationshipCounts] = useState({});
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [mobileExpandedRows, setMobileExpandedRows] = useState(new Set());
  const [expandedTaskRows, setExpandedTaskRows] = useState(new Set());
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null);
  const defaultFields = ['name_details', 'contact_info', 'source_status', 'tasks', 'calls', 'relationships', 'actions'];

  const fetchRelationshipCounts = async (leadIds) => {
    if (leadIds.length === 0) return;
    setRelationshipLoading(true);
    try {
      const entities = leadIds.map(id => ({ type: 'lead', id }));
      const response = await api.post('/relationships/counts', { entities });
      setRelationshipCounts(response.data || {});
    } catch (error) { 
      console.error('Error fetching relationship counts:', error); 
      setRelationshipCounts({}); 
    }
    setRelationshipLoading(false);
  };

  const handleSendEmail = (lead) => {
    setSelectedLeadForEmail(lead);
    setShowSendEmailDialog(true);
  };

  // Main fetch function for leads
  const fetchLeads = async (page = currentPage, limit = itemsPerPage, search = searchTerm) => {
    if (!isAuthenticated()) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString() 
      });
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await api.get(`/leads?${params.toString()}`);
      const data = response.data;
      
      if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
        setLeads(Array.isArray(data.data) ? data.data : []);
        setTotalItems(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        setCurrentPage(data.pagination?.currentPage || page);
        
        await fetchRelationshipCounts(
          Array.isArray(data.data) ? data.data.map(lead => lead.id) : []
        );
      } else if (Array.isArray(data)) {
        setLeads(data);
        setTotalItems(data.length);
        setTotalPages(1);
        setCurrentPage(1);
        
        await fetchRelationshipCounts(data.map(lead => lead.id));
      } else {
        console.warn('Unexpected API response format:', data);
        setLeads([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError(error.message || 'Failed to fetch leads');
      setLeads([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const initializeView = async () => {
    if (!isAuthenticated()) {
      setFieldsLoading(false);
      return;
    }

    setFieldsLoading(true);
    setError(null);
    
    try {
      const [standardFieldsResponse, customFieldsResponse] = await Promise.all([
        api.get('/field-definitions/leads'),
        api.get('/custom-fields')
      ]);

      const standardFields = standardFieldsResponse.data || [];
      const allCustomFields = customFieldsResponse.data || [];

      const allApiFields = [
        ...standardFields.map(f => ({ ...f, isStandard: true })),
        ...allCustomFields
          .filter(field => field.module === 'leads')
          .map(field => ({
            name: field.field_name,
            label: field.field_label,
            type: field.field_type,
            isStandard: false
          }))
      ];
      
      const excludedIndividualFields = [
        'first_name', 'last_name', 'email', 'phone', 
        'company', 'status', 'lead_source', 'created_at', 'updated_at'
      ];

      const pickableApiFields = allApiFields.filter(
        field => !excludedIndividualFields.includes(field.name)
      );
      
      const clientSideFields = [
        { name: 'name_details', label: t('leadsTab.table.name'), type: 'custom', isStandard: true },
        { name: 'contact_info', label: t('leadsTab.table.contact'), type: 'custom', isStandard: true },
        { name: 'source_status', label: t('leadsTab.table.sourceStatus'), type: 'custom', isStandard: true },
        { name: 'tasks', label: t('leadsTab.table.tasks'), type: 'custom', isStandard: true },
        { name: 'calls', label: t('leadsTab.table.calls'), type: 'custom', isStandard: true },
        { name: 'relationships', label: t('leadsTab.table.relations'), type: 'custom', isStandard: true },
        { name: 'actions', label: t('leadsTab.table.actions'), type: 'custom', align: 'right', isStandard: true },
      ];

      const allAvailableFields = [...clientSideFields, ...pickableApiFields];
      
      const uniqueFieldsMap = new Map();
      allAvailableFields.forEach(field => {
        if (!uniqueFieldsMap.has(field.name)) {
          uniqueFieldsMap.set(field.name, field);
        }
      });
      
      setAvailableFields(Array.from(uniqueFieldsMap.values()));

      try {
        const layoutResponse = await api.get('/users/preferences/lead-layout');
        const layoutData = layoutResponse.data;
        
        if (layoutData && layoutData.selected_fields) {
          setSelectedFields(layoutData.selected_fields);
        } else {
          setSelectedFields(defaultFields);
        }
      } catch (e) {
        setSelectedFields(defaultFields);
      }
    } catch (error) {
      console.error('Error initializing view:', error);
      setError('Failed to initialize view');
      setAvailableFields([]);
      setSelectedFields(defaultFields);
    } finally {
      setFieldsLoading(false);
      fetchLeads(1, itemsPerPage, '');
    }
  };

  useEffect(() => {
    if (isAuthenticated()) {
      initializeView();
    } else {
      setFieldsLoading(false);
    }
  }, [isAuthenticated]);

  const handlePageChange = (page) => { 
    setCurrentPage(page); 
    fetchLeads(page, itemsPerPage, searchTerm); 
  };
  
  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit); 
    setCurrentPage(1); 
    fetchLeads(1, newLimit, searchTerm);
  };
  
  const handlePreviousPage = () => { 
    if (currentPage > 1) { 
      const newPage = currentPage - 1; 
      setCurrentPage(newPage); 
      fetchLeads(newPage, itemsPerPage, searchTerm); 
    } 
  };
  
  const handleNextPage = () => { 
    if (currentPage < totalPages) { 
      const newPage = currentPage + 1; 
      setCurrentPage(newPage); 
      fetchLeads(newPage, itemsPerPage, searchTerm); 
    } 
  };

  const getPageNumbers = () => {
    const delta = 2, range = [], rangeWithDots = [];
    if (totalPages <= 1) return [1];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) range.push(i);
    if (currentPage - delta > 2) rangeWithDots.push(1, '...'); else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) rangeWithDots.push('...', totalPages); else if (totalPages > 1) rangeWithDots.push(totalPages);
    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };

  const handleSearch = async (searchValue, showAll = false) => {
    const newSearchTerm = showAll ? '' : searchValue;
    setSearchTerm(newSearchTerm); 
    setCurrentPage(1);
    
    try { 
      await fetchLeads(1, itemsPerPage, newSearchTerm); 
      return totalItems; 
    } catch (error) { 
      console.error('Search error:', error); 
      throw error; 
    }
  };

  const handleRefresh = () => fetchLeads(currentPage, itemsPerPage, searchTerm);
  const handleLeadCreated = () => { setShowLeadDialog(false); handleRefresh(); };
  const handleLeadConverted = () => { setShowConvertDialog(false); setSelectedLead(null); handleRefresh(); };
  const handleLeadUpdated = () => { setShowEditDialog(false); setSelectedLead(null); handleRefresh(); };

  const handleDeleteConfirmed = async (leadId) => {
    setIsDeleting(true);
    try { 
      await api.delete(`/leads/${leadId}`); 
      handleRefresh(); 
    } catch (error) { 
      console.error('Error deleting lead:', error); 
      setError('Failed to delete lead');
    }
    setIsDeleting(false); 
    setShowDeleteDialog(false); 
    setSelectedLead(null);
  };

  const fetchLeadHistory = async (leadId) => {
    setHistoryLoading(true);
    try { 
      const response = await api.get(`/leads/${leadId}/history`); 
      setLeadHistory(response.data || []); 
    } catch (error) { 
      console.error('Error fetching lead history:', error); 
      setLeadHistory([]); 
    }
    setHistoryLoading(false);
  };

  const handleShowHistory = async (lead) => { 
    setSelectedLead(lead); 
    await fetchLeadHistory(lead.id); 
    setShowHistoryDialog(true); 
  };
  
  const handleCreateTask = (lead) => { setSelectedLead(lead); setShowCreateTaskDialog(true); };
  const handleUploadDoc = (lead) => { setSelectedLead(lead); setShowUploadDocDialog(true); };
  const handleTaskCreated = () => { setShowCreateTaskDialog(false); setSelectedLead(null); handleRefresh(); };
  const handleTasksUpdated = handleRefresh;
  const handleLogCall = (lead) => { setSelectedLeadForCall(lead); setShowCreateLeadCallDialog(true); };
  const handleCallLogged = () => { setShowCreateLeadCallDialog(false); setSelectedLeadForCall(null); handleRefresh(); };
  const handleShowCallHistory = (lead) => { setSelectedLeadForCall(lead); setShowLeadCallHistoryDialog(true); };
  const handleCallUpdated = handleRefresh;
  const handleUploadSuccess = () => setShowUploadDocDialog(false);

  const handleShowRelationships = (lead) => {
    const isConverted = lead.status === 'converted' && lead.converted_account_id;
    const entityToShow = {
      type: isConverted ? 'account' : 'lead',
      id: isConverted ? lead.converted_account_id : lead.id,
      name: `${lead.first_name} ${lead.last_name}`
    };
    setSelectedEntityForRelationships(entityToShow); 
    setShowRelationshipsSection(true);
  };

  const handleRelationshipsUpdated = () => fetchRelationshipCounts(leads.map(lead => lead.id));
  const getRelationshipCount = (leadId) => relationshipCounts[`lead_${leadId}`]?.total || 0;
  const formatDate = (dateString) => new Date(dateString).toLocaleString(i18n.language);

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'created': return <Plus className="h-4 w-4 text-green-600" />;
      case 'updated': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'converted': return <ArrowRight className="h-4 w-4 text-purple-600" />;
      case 'deleted': return <User className="h-4 w-4 text-red-600" />;
      default: return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTaskCountBadge = (lead) => {
    const counts = lead.task_counts;
    if (!counts || counts.total === 0) return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">0</Badge>;
    const badgeText = (type, count) => t(`leadsTab.tasks.${type}Badge`, { total: counts.total, count });
    if (counts.overdue > 0) return <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">{badgeText('overdue', counts.overdue)}</Badge>;
    if (counts.pending > 0) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">{badgeText('pending', counts.pending)}</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">{counts.total}</Badge>;
  };

  const getCallCountBadge = (lead) => {
    const counts = lead.call_counts;
    if (!counts || counts.total === 0) return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />0</Badge>;
    const badgeText = t('leadsTab.calls.recentBadge', { total: counts.total, count: counts.recent });
    if (counts.recent > 0) return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />{badgeText}</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs flex items-center gap-1"><PhoneCall className="h-3 w-3" />{counts.total}</Badge>;
  };

  const toggleFieldSelection = (fieldName) => {
    setSelectedFields(prev => {
      const isCurrentlySelected = prev.includes(fieldName);
      if (isCurrentlySelected) {
        return prev.filter(name => name !== fieldName);
      } else {
        const sortableFields = prev.filter(name => name !== 'actions');
        const actionsField = prev.includes('actions') ? ['actions'] : [];
        return [...sortableFields, fieldName, ...actionsField];
      }
    });
  };

  const handleSaveLayout = async () => {
    try {
      await api.put('/users/preferences/lead-layout', { 
        selected_fields: selectedFields 
      });
      setShowFieldSelector(false);
    } catch (error) {
      console.error('Error saving layout:', error);
      setError('Failed to save layout');
    }
  };

  const getSelectedFieldObjects = () => {
    return selectedFields
      .map(fieldName => availableFields.find(f => f.name === fieldName))
      .filter(Boolean);
  };
  
  const toggleMobileExpansion = (itemId) => {
    setMobileExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleTaskExpansion = (leadId) => {
    setExpandedTaskRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
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

  const getDisplayValue = (lead, field) => {
    switch (field.name) {
      case 'name_details':
        return (
          <div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="p-1 h-auto" onClick={() => { setSelectedLead(lead); setShowProfile(true); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person-vcard-fill" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm9 1.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 0-1h-4a.5.5 0 0 0-.5.5M9 8a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 0-1h-4A.5.5 0 0 0 9 8m1 2.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1h-3a.5.5 0 0 0-.5.5m-1 2C9 10.567 7.21 9 5 9c-2.086 0-3.8 1.398-3.984 3.181A1 1 0 0 0 2 13h6.96q.04-.245.04-.5M7 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0"/></svg>
              </Button>
              <div className="font-medium truncate">{`${lead.first_name} ${lead.last_name}`}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1 pl-8">{t('leadsTab.createdLabel', 'Created')}: {formatDate(lead.created_at)}</div>
            <div className="text-xs text-muted-foreground pl-8">{t('leadsTab.updatedLabel', 'Updated')}: {formatDate(lead.updated_at)}</div>
          </div>
        );
      case 'contact_info':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              <div className="truncate text-sm">{lead.company}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <button
                onClick={() => handleSendEmail(lead)}
                className="truncate max-w-[120px] hover:underline text-blue-600 hover:text-blue-800"
              >
                {lead.email}
              </button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <a href={`tel:${lead.phone}`} className="hover:underline">
                {lead.phone}
              </a>
            </div>
          </div>
        );
      case 'source_status':
        return (
          <div className="flex flex-col items-start gap-2">
            {getStatusBadge(lead.status)}
            {lead.lead_source ? (
            <Badge variant="outline" className="text-xs">{lead.lead_source}</Badge>
            ) : null}
          </div>
        );
      case 'tasks':
        return (
          <div className="flex items-center gap-2">
            {getTaskCountBadge(lead)}
            <Button size="sm" variant="ghost" onClick={() => toggleTaskExpansion(lead.id)} className="h-6 px-1">
              {expandedTaskRows.has(lead.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        );
      case 'calls':
        return <Button size="sm" variant="ghost" onClick={() => handleShowCallHistory(lead)} className="p-0 h-auto">{getCallCountBadge(lead)}</Button>;
      case 'relationships':
        return <RelationshipBadge count={getRelationshipCount(lead.id)} onClick={() => handleShowRelationships(lead)} loading={relationshipLoading}/>;
      case 'actions':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">{t('leadsTab.openMenu')}</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShowRelationships(lead)}><Users className="h-4 w-4 mr-2" />{t('leadsTab.actions.relationships')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLogCall(lead)}><PhoneCall className="h-4 w-4 mr-2" />{t('leadsTab.actions.logCall')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowCallHistory(lead)}><Phone className="h-4 w-4 mr-2" />{t('leadsTab.actions.callHistory')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowHistory(lead)}><History className="h-4 w-4 mr-2" />{t('leadsTab.actions.leadHistory')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUploadDoc(lead)}><Folder className="h-4 w-4 mr-2" />{t('docsTab.uploadButton')}</DropdownMenuItem>
              {lead.status !== 'converted' && (<>
              <DropdownMenuItem onClick={() => handleCreateTask(lead)}><Calendar className="h-4 w-4 mr-2" />{t('leadsTab.actions.addTask')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedLead(lead); setShowConvertDialog(true); }}><ArrowRight className="h-4 w-4 mr-2" />{t('leadsTab.actions.convert')}</DropdownMenuItem>
              </>)}
              {canEdit && <DropdownMenuItem onClick={() => { setSelectedLead(lead); setShowEditDialog(true); }}><Edit className="h-4 w-4 mr-2" />{t('common.edit')}</DropdownMenuItem>}
              {canDelete && <DropdownMenuItem onClick={() => { setSelectedLead(lead); setShowDeleteDialog(true); }} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        );
    }
    
    if (lead.hasOwnProperty(field.name)) {
      if (field.name === 'status') return getStatusBadge(lead.status);
      if (field.name === 'created_at' || field.name === 'updated_at') return formatDate(lead[field.name]);
      return lead[field.name] || '-';
    }

    if (lead.custom_fields && Array.isArray(lead.custom_fields)) {
      const customField = lead.custom_fields.find(cf => cf.field_name === field.name);
      if (customField && customField.value) {
        try {
          const parsed = JSON.parse(customField.value);
          if (Array.isArray(parsed)) {
            return parsed.join(', ');
          }
        } catch {
          // not JSON, just return raw
        }
        return customField.value;
      }
      return '-';
    }

    return '-';
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
      {showRelationshipsSection && selectedEntityForRelationships ? (
        <RelationshipsSection
          entityType={selectedEntityForRelationships.type}
          entityId={selectedEntityForRelationships.id}
          entityName={selectedEntityForRelationships.name}
        
          onClose={() => { setShowRelationshipsSection(false); setSelectedEntityForRelationships(null); handleRelationshipsUpdated(); }}
        />
      ) : (
        <>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-2xl font-semibold">{t('leadsTab.title')}</h2>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowFieldSelector(true)}>
                    <Columns className="h-4 w-4 mr-2" />
                    {t('common.fields')}
                </Button>
                <Button onClick={() => setShowLeadDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('leadsTab.addLead')}
                </Button>
            </div>
          </div>
          
          {showFieldSelector && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-end">
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedFields(defaultFields)}>
                      {t('common.resetToDefault')}
                    </Button>
                    <Button size="sm" onClick={handleSaveLayout}>
                      {t('common.done')}
                    </Button>
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
                        <span className="text-sm text-gray-500 dark:text-gray-400 select-none">{t('leadsTab.table.actions')}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('leadsTab.fields.standard')}</h3>
                    <div className="space-y-2">
                        {availableFields.filter(f => f.isStandard && !selectedFields.includes(f.name)).map(field => (
                            <div key={field.name} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border">
                            <input
                                type="checkbox"
                                checked={false}
                                onChange={() => toggleFieldSelection(field.name)}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
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
                            <input
                                type="checkbox"
                                checked={false}
                                onChange={() => toggleFieldSelection(field.name)}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
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
                  <CardTitle>{t('leadsTab.allLeads')}</CardTitle>
                  <CardDescription>{t('leadsTab.description')}</CardDescription>
                </div>
                <SearchComponent onSearch={handleSearch} placeholder={t('leadsTab.searchPlaceholder')} initialValue={searchTerm} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>
                    ) : (
                      t('leadsTab.pagination.showing', { start: totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, end: Math.min(currentPage * itemsPerPage, totalItems), total: totalItems })
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">{t('leadsTab.pagination.perPage')}</label>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange} disabled={loading}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    {getPageNumbers().map((pageNum, index) => (
                      <Button key={index} variant={pageNum === currentPage ? "default" : "outline"} size="sm" onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)} disabled={pageNum === '...'} className="min-w-[40px]">{pageNum}</Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /><span className="ml-2">{t('leadsTab.loadingLeads')}</span></div>
              ) : (
                <>
                   <div className="lg:hidden">
                    {leads.map((lead) => {
                       const isMobileExpanded = mobileExpandedRows.has(lead.id);
                       const fieldObjects = getSelectedFieldObjects();
                       const primaryFields = fieldObjects.slice(0, 3);
                       const secondaryFields = fieldObjects.slice(3);

                       return(
                        <Card key={lead.id} className="m-2 border">
                            <CardContent className="p-4 space-y-3">
                                {primaryFields.map(field => (
                                    <div key={field.name} className="flex justify-between items-start gap-2">
                                        <span className="text-sm font-medium text-muted-foreground w-1/3">{field.label}:</span>
                                        <div className="w-2/3 flex justify-end text-right">{getDisplayValue(lead, field)}</div>
                                    </div>
                                ))}
                                {isMobileExpanded && secondaryFields.length > 0 && (
                                    <div className="pt-2 border-t space-y-3">
                                        {secondaryFields.map(field => (
                                            <div key={field.name} className="flex justify-between items-start gap-2">
                                                <span className="text-sm font-medium text-muted-foreground w-1/3">{field.label}:</span>
                                                <div className="w-2/3 flex justify-end text-right">{getDisplayValue(lead, field)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {expandedTaskRows.has(lead.id) && (
                                  <div className="pt-2 mt-2 border-t">
                                      <RelatedTasksSection
                                          relatedTo={lead}
                                          relatedType="lead"
                                        
                                          users={users}
                                          user={user}
                                          onTaskUpdate={handleTasksUpdated}
                                          existingTasks={lead.tasks || []}
                                      />
                                  </div>
                                )}
                                {secondaryFields.length > 0 && (
                                    <div className="pt-2 border-t">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleMobileExpansion(lead.id)}
                                          className="w-full"
                                        >
                                          {isMobileExpanded ? 'Show Less' : `Show More (${secondaryFields.length})`}
                                          {isMobileExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                       )
                    })}
                   </div>
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {getSelectedFieldObjects().map(field => (
                            <TableHead key={field.name} className={`${field.align === 'right' ? 'text-right' : ''}`}>
                                {field.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => (
                          <Fragment key={lead.id}>
                            <TableRow>
                              {getSelectedFieldObjects().map(field => (
                                  <TableCell key={field.name} className={`max-w-30 w-fit overflow-hidden ${field.align === 'right' ? 'text-right' : ''}`}>
                                      {getDisplayValue(lead, field)}
                                  </TableCell>
                              ))}
                            </TableRow>
                            {expandedTaskRows.has(lead.id) && (
                              <TableRow>
                                <TableCell colSpan={getSelectedFieldObjects().length} className="bg-muted/50 p-4">
                                  <RelatedTasksSection
                                    relatedTo={lead}
                                    relatedType="lead"
                                  
                                    users={users}
                                    user={user}
                                    onTaskUpdate={handleTasksUpdated}
                                    existingTasks={lead.tasks || []}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {leads.length === 0 && (<div className="text-center py-8"><p className="text-muted-foreground">{t('leadsTab.noLeads')}</p></div>)}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <CreateLeadDialog open={showLeadDialog} onOpenChange={setShowLeadDialog} onLeadCreated={handleLeadCreated}/>
      <ConvertLeadDialog open={showConvertDialog} onOpenChange={setShowConvertDialog} selectedLead={selectedLead} onLeadConverted={handleLeadConverted}/>
      <EditLeadDialog open={showEditDialog} onOpenChange={setShowEditDialog} lead={selectedLead} onLeadUpdated={handleLeadUpdated}/>
      <DeleteLeadDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} lead={selectedLead} onDeleteConfirmed={handleDeleteConfirmed} isLoading={isDeleting}/>
      <ProfileDetails open={showProfile} onOpenChange={setShowProfile} lead={selectedLead}/>
      <LeadHistoryDialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog} lead={selectedLead} history={leadHistory} isLoading={historyLoading} formatDate={formatDate} getActionIcon={getActionIcon}/>
      <CreateTaskDialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog} onTaskCreated={handleTaskCreated} users={users} relatedTo={selectedLead} relatedType="lead"/>
      <CreateLeadCallDialog open={showCreateLeadCallDialog} onOpenChange={setShowCreateLeadCallDialog} lead={selectedLeadForCall} user={user} onCallLogged={handleCallLogged}/>
      <LeadCallHistoryDialog open={showLeadCallHistoryDialog} onOpenChange={setShowLeadCallHistoryDialog} lead={selectedLeadForCall} user={user} onCallUpdated={handleCallUpdated}/>
      <UploadDocDialog open={showUploadDocDialog} onOpenChange={setShowUploadDocDialog} person={selectedLead} onUploadSuccess={handleUploadSuccess} uploadType={"lead"}/>
      <SendEmailDialog
        open={showSendEmailDialog}
        onOpenChange={setShowSendEmailDialog}
        recipient={selectedLeadForEmail?.email}
        recipientName={selectedLeadForEmail ? `${selectedLeadForEmail.first_name} ${selectedLeadForEmail.last_name}` : ''}
      />
    </div>
  );
};

export default LeadsTab;