// components/tabs/CampaignsTab.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Plus, MoreHorizontal, Edit, Trash2, Target, Users, Activity, Calendar, ChevronLeft, ChevronRight, Loader2, TrendingUp, Clock, UserPlus, Building } from 'lucide-react';
import SearchComponent from '../ui/SearchComponent';
import CreateCampaignDialog from '../dialogs/CreateCampaignDialog';
import EditCampaignDialog from '../dialogs/EditCampaignDialog';
import DeleteCampaignDialog from '../dialogs/DeleteCampaignDialog';
import CampaignDetailsDialog from '../dialogs/CampaignDetailsDialog';
import ManageCampaignParticipantsDialog from '../dialogs/ManageCampaignParticipantsDialog';
import api from '@/services/api';

const CampaignsTab = ({ user }) => {
  const { t, i18n } = useTranslation();

  // Data states
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Search and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [goalTypeFilter, setGoalTypeFilter] = useState('');
  
  const fetchCampaigns = async (page = currentPage, limit = itemsPerPage, search = searchTerm, status = statusFilter, campaign_type = typeFilter, goal_type = goalTypeFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString() 
      });
      
      if (search && search.trim()) params.append('search', search.trim());
      if (status) params.append('status', status);
      if (campaign_type) params.append('campaign_type', campaign_type);
      if (goal_type) params.append('goal_type', goal_type);
      
      const response = await api.get(`/campaigns?${params.toString()}`);
      if (response.data.data && response.data.pagination) {
        setCampaigns(response.data.data);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
        setCurrentPage(response.data.pagination.currentPage);
      } else {
        setCampaigns(Array.isArray(response.data) ? response.data : []);
        setTotalItems(Array.isArray(response.data) ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
      setTotalItems(0);
      setTotalPages(0);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchCampaigns(1, itemsPerPage, '', '', '', '');
  }, []);
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchCampaigns(page, itemsPerPage, searchTerm, statusFilter, typeFilter, goalTypeFilter);
  };
  
  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit);
    setCurrentPage(1);
    fetchCampaigns(1, newLimit, searchTerm, statusFilter, typeFilter, goalTypeFilter);
  };
  
  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchCampaigns(1, itemsPerPage, searchTerm, statusFilter, typeFilter, goalTypeFilter);
  };
  
  useEffect(() => {
    handleFilterChange();
  }, [statusFilter, typeFilter, goalTypeFilter]);
  
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchCampaigns(newPage, itemsPerPage, searchTerm, statusFilter, typeFilter, goalTypeFilter);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchCampaigns(newPage, itemsPerPage, searchTerm, statusFilter, typeFilter, goalTypeFilter);
    }
  };

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    
    if (totalPages <= 1) return [1];
    
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    
    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }
    
    rangeWithDots.push(...range);
    
    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }
    
    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };

  const handleSearch = async (searchValue, showAll = false) => {
    const newSearchTerm = showAll ? '' : searchValue;
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
    
    try {
      await fetchCampaigns(1, itemsPerPage, newSearchTerm, statusFilter, typeFilter, goalTypeFilter);
      return totalItems;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  };

  const handleRefresh = () => {
    fetchCampaigns(currentPage, itemsPerPage, searchTerm, statusFilter, typeFilter, goalTypeFilter);
  };
  
  const handleCampaignCreated = () => {
    setShowCreateDialog(false);
    handleRefresh();
  };
  
  const handleCampaignUpdated = () => {
    setShowEditDialog(false);
    setSelectedCampaign(null);
    handleRefresh();
  };
  
  const handleDeleteConfirmed = async (campaignId) => {
    setIsDeleting(true);
    try {
      await api.delete(`/campaigns/${campaignId}`);
      handleRefresh();
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
    setSelectedCampaign(null);
  };

  const handleShowDetails = (campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailsDialog(true);
  };

  const handleManageParticipants = (campaign) => {
    setSelectedCampaign(campaign);
    setShowParticipantsDialog(true);
  };

  const handleParticipantsUpdated = () => {
    setShowParticipantsDialog(false);
    setSelectedCampaign(null);
    handleRefresh();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(i18n.language);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('campaignsTab.status.active')}</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600">{t('campaignsTab.status.inactive')}</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">{t('campaignsTab.status.completed')}</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('campaignsTab.status.paused')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCampaignTypeBadge = (type) => {
    switch (type) {
      case 'lead':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><UserPlus className="h-3 w-3 mr-1" />{t('campaignsTab.type.lead')}</Badge>;
      case 'account':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Building className="h-3 w-3 mr-1" />{t('campaignsTab.type.account')}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getGoalTypeBadge = (goalType, campaignType) => {
    const leadGoalTypes = {
      conversion: { label: t('campaignsTab.goalType.conversion'), color: 'bg-green-50 text-green-700 border-green-200' },
      new_added: { label: t('campaignsTab.goalType.newAdded'), color: 'bg-blue-50 text-blue-700 border-blue-200' },
      status_change: { label: t('campaignsTab.goalType.statusChange'), color: 'bg-orange-50 text-orange-700 border-orange-200' }
    };

    const accountGoalTypes = {
      sales: { label: t('campaignsTab.goalType.sales'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      revenue: { label: t('campaignsTab.goalType.revenue'), color: 'bg-violet-50 text-violet-700 border-violet-200' },
      meetings: { label: t('campaignsTab.goalType.meetings'), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    };

    const goalTypes = campaignType === 'lead' ? leadGoalTypes : accountGoalTypes;
    const goal = goalTypes[goalType];
    
    if (goal) {
      return <Badge variant="outline" className={goal.color}>{goal.label}</Badge>;
    }
    
    return <Badge variant="outline">{goalType}</Badge>;
  };

  const getProgressBar = (current, goal) => {
    if (!goal || goal === 0) return null;
    
    const percentage = Math.min((current / goal) * 100, 100);
    const isComplete = percentage >= 100;
    
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 bg-gray-200 rounded-full h-2 relative overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${isComplete ? 'text-green-600' : 'text-gray-600'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{t('campaignsTab.title')}</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('campaignsTab.createCampaign')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>{t('campaignsTab.allCampaigns')}</CardTitle>
              <CardDescription>{t('campaignsTab.description')}</CardDescription>
            </div>
            <SearchComponent 
              onSearch={handleSearch} 
              placeholder={t('campaignsTab.searchPlaceholder')} 
              initialValue={searchTerm} 
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('campaignsTab.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">{t('campaignsTab.filters.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('campaignsTab.status.active')}</SelectItem>
                <SelectItem value="inactive">{t('campaignsTab.status.inactive')}</SelectItem>
                <SelectItem value="completed">{t('campaignsTab.status.completed')}</SelectItem>
                <SelectItem value="paused">{t('campaignsTab.status.paused')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('campaignsTab.filters.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">{t('campaignsTab.filters.allTypes')}</SelectItem>
                <SelectItem value="lead">{t('campaignsTab.type.lead')}</SelectItem>
                <SelectItem value="account">{t('campaignsTab.type.account')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={goalTypeFilter} onValueChange={setGoalTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('campaignsTab.filters.goalType')} />
              </SelectTrigger>
<SelectContent>
  <SelectItem value="null">{t('campaignsTab.filters.allGoalTypes')}</SelectItem>

  {typeFilter === "null" || typeFilter === "" ? (
    <>
      <SelectItem value="conversion">{t('campaignsTab.goalType.conversion')}</SelectItem>
      <SelectItem value="new_added">{t('campaignsTab.goalType.newAdded')}</SelectItem>
      <SelectItem value="sales">{t('campaignsTab.goalType.sales')}</SelectItem>
      <SelectItem value="meetings">{t('campaignsTab.goalType.meetings')}</SelectItem>
    </>
  ) : typeFilter === "lead" ? (
    <>
      <SelectItem value="conversion">{t('campaignsTab.goalType.conversion')}</SelectItem>
      <SelectItem value="new_added">{t('campaignsTab.goalType.newAdded')}</SelectItem>
    </>
  ) : (
    <>
      <SelectItem value="sales">{t('campaignsTab.goalType.sales')}</SelectItem>
      <SelectItem value="meetings">{t('campaignsTab.goalType.meetings')}</SelectItem>
    </>
  )}
</SelectContent>

            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : (
                  t('campaignsTab.pagination.showing', { 
                    start: totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, 
                    end: Math.min(currentPage * itemsPerPage, totalItems), 
                    total: totalItems 
                  })
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('campaignsTab.pagination.perPage')}</label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange} disabled={loading}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
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
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((pageNum, index) => (
                  <Button
                    key={index}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                    disabled={pageNum === '...'}
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">{t('campaignsTab.loadingCampaigns')}</span>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block md:hidden">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="border-b p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="p-1 h-auto"
                            onClick={() => handleShowDetails(campaign)}
                          >
                            <Target className="h-4 w-4" />
                          </Button>
                          <div>
                            <div className="font-medium text-sm">{campaign.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(campaign.status)}
                              {getCampaignTypeBadge(campaign.campaign_type)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {campaign.is_open_campaign 
                                ? t('campaignsTab.openCampaign')
                                : `${formatDate(campaign.start_date)} - ${formatDate(campaign.end_date)}`
                              }
                            </span>
                          </div>
                          <div>{getGoalTypeBadge(campaign.goal_type, campaign.campaign_type)}</div>
                          {campaign.goal_value > 0 && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3" />
                              <span>{parseFloat(campaign.current_value)} / {parseFloat(campaign.goal_value)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-600 text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {campaign.participant_count || 0}
                        </Badge>
                        {campaign.goal_value > 0 && getProgressBar(campaign.current_value, campaign.goal_value)}
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">{t('campaignsTab.openMenu')}</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleShowDetails(campaign)}>
                            <Activity className="h-4 w-4 mr-2" />
                            {t('campaignsTab.actions.viewDetails')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageParticipants(campaign)}>
                            <Users className="h-4 w-4 mr-2" />
                            {t('campaignsTab.actions.manageParticipants')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedCampaign(campaign); setShowEditDialog(true); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => { setSelectedCampaign(campaign); setShowDeleteDialog(true); }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">{t('campaignsTab.table.name')}</TableHead>
                      <TableHead className="w-[120px]">{t('campaignsTab.table.type')}</TableHead>
                      <TableHead className="w-[150px]">{t('campaignsTab.table.goal')}</TableHead>
                      <TableHead className="w-[150px]">{t('campaignsTab.table.progress')}</TableHead>
                      <TableHead className="w-[100px]">{t('campaignsTab.table.participants')}</TableHead>
                      <TableHead className="w-[120px]">{t('campaignsTab.table.dates')}</TableHead>
                      <TableHead className="w-[100px]">{t('campaignsTab.table.status')}</TableHead>
                      <TableHead className="w-[100px]">{t('campaignsTab.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="p-1 h-auto"
                              onClick={() => handleShowDetails(campaign)}
                            >
                              <Target className="h-4 w-4" />
                            </Button>
                            <div>
                              <div className="font-medium text-sm">{campaign.name}</div>
                              {campaign.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {campaign.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            {getCampaignTypeBadge(campaign.campaign_type)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            {getGoalTypeBadge(campaign.goal_type, campaign.campaign_type)}
                            {campaign.goal_value > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {t('campaignsTab.table.target')}: {parseFloat(campaign.goal_value)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {campaign.goal_value > 0 ? (
                            <div className="space-y-1">
                              {getProgressBar(campaign.current_value, campaign.goal_value)}
                              <div className="text-xs text-muted-foreground">
                                {parseFloat(campaign.current_value)} / {parseFloat(campaign.goal_value)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleManageParticipants(campaign)}
                            className="p-0 h-auto"
                          >
                            <Badge variant="secondary" className="bg-blue-100 text-blue-600">
                              <Users className="h-3 w-3 mr-1" />
                              {campaign.participant_count || 0}
                            </Badge>
                          </Button>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {campaign.is_open_campaign ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span className="text-muted-foreground">{t('campaignsTab.openCampaign')}</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>{formatDate(campaign.start_date)}</div>
                                <div className="text-muted-foreground">{formatDate(campaign.end_date)}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(campaign.status)}
                        </TableCell>
                        
                        <TableCell className="text-left">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('campaignsTab.openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleShowDetails(campaign)}>
                                <Activity className="h-4 w-4 mr-2" />
                                {t('campaignsTab.actions.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManageParticipants(campaign)}>
                                <Users className="h-4 w-4 mr-2" />
                                {t('campaignsTab.actions.manageParticipants')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedCampaign(campaign); setShowEditDialog(true); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => { setSelectedCampaign(campaign); setShowDeleteDialog(true); }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {campaigns.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t('campaignsTab.noCampaigns')}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCampaignCreated={handleCampaignCreated}
        user={user}
      />

      <EditCampaignDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        campaign={selectedCampaign}
        onCampaignUpdated={handleCampaignUpdated}
      />

      <DeleteCampaignDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        campaign={selectedCampaign}
        onDeleteConfirmed={handleDeleteConfirmed}
        isLoading={isDeleting}
      />

      <CampaignDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        campaign={selectedCampaign}
        formatDate={formatDate}
        getStatusBadge={getStatusBadge}
        getCampaignTypeBadge={getCampaignTypeBadge}
        getGoalTypeBadge={getGoalTypeBadge}
        getProgressBar={getProgressBar}
      />

      <ManageCampaignParticipantsDialog
        open={showParticipantsDialog}
        onOpenChange={setShowParticipantsDialog}
        campaign={selectedCampaign}
        onParticipantsUpdated={handleParticipantsUpdated}
      />
    </div>
  );
};

export default CampaignsTab;