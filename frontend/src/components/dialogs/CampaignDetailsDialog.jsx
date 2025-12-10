import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Phone, Target, Users, Activity, Calendar, TrendingUp, Clock, User, Building, Mail, Plus, ArrowRight, Edit, Trash2, LineChart, CheckCircle2, AlertCircle, Trophy, BarChart2, Package, TrendingDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import TopEarningAccounts from '../analytics/TopEarningAccounts';
import api from '@/services/api';

const CampaignDetailsDialog = ({ 
  open, 
  onOpenChange, 
  campaign, 
  formatDate,
  getStatusBadge,
  getCampaignTypeBadge,
  getGoalTypeBadge,
  getProgressBar
}) => {
  const { t } = useTranslation();
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState({
    pacing: null,
    topPerformers: [],
    breakdown: null,
    topEarningAccounts: []
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Currency configuration
  const currencies = [
    { value: 'USD', label: 'USD ($)', symbol: '$' },
    { value: 'EUR', label: 'EUR (€)', symbol: '€' },
    { value: 'GBP', label: 'GBP (£)', symbol: '£' },
    { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
    { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
    { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
    { value: 'TRY', label: 'TRY (₺)', symbol: '₺' }
  ];



  // Get currency symbol based on currency code
  const getCurrencySymbol = (currencyCode) => {
    const currency = currencies.find(c => c.value === currencyCode);
    return currency ? currency.symbol : '$'; // Default to $ if currency not found
  };

  // Get currency icon component based on currency
  const getCurrencyIcon = (currencyCode) => {
    const symbol = getCurrencySymbol(currencyCode);
    // For now, return a span with the symbol, but you could create custom icons
    return <span className="text-green-600 font-bold text-xs">{symbol}</span>;
  };

  useEffect(() => {
    if (open && campaign) {
      fetchCampaignDetails();
      fetchCampaignStats();
      fetchAnalytics();
    } else {
      // Clear data when dialog closes
      setCampaignDetails(null);
      setStats(null);
      setAnalytics(null);
    }
  }, [open, campaign]);

  const fetchCampaignDetails = async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      const details = await api.get(`/campaigns/${campaign.id}`);
      setCampaignDetails(details.data);
    } catch (error) {
      console.error('Error fetching campaign details:', error);
    }
    setLoading(false);
  };

  const fetchCampaignStats = async () => {
    if (!campaign) return;
    try {
      const statsData = await api.get(`/campaigns/${campaign.id}/stats`);
      setStats(statsData.data);
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
    }
  };

  const fetchAnalytics = async () => {
    if (!campaign) return;
    setAnalyticsLoading(true);
    try {
      const analyticsData = await api.get(`/campaigns/${campaign.id}/analytics`);
      setAnalytics(analyticsData.data);
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
    }
    setAnalyticsLoading(false);
  };

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'joined': return <Plus className="h-4 w-4 text-green-600" />;
      case 'converted': return <ArrowRight className="h-4 w-4 text-purple-600" />;
      case 'updated': return <Edit className="h-4 w-4 text-blue-600" />;
      case 'removed': return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'created': return <Target className="h-4 w-4 text-green-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getParticipantStatusBadge = (status) => {
    switch (status) {
      case 'active': return <Badge variant="default" className="bg-green-100 text-green-800">{t('campaignDetails.participantStatus.active')}</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">{t('campaignDetails.participantStatus.completed')}</Badge>;
      case 'removed': return <Badge variant="secondary" className="bg-red-100 text-red-800">{t('campaignDetails.participantStatus.removed')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value, currencyCode = 'USD') => {
    // Ensure we have a valid currency code
    const currency = currencyCode || campaign?.goal_currency || 'USD';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value || 0);
    } catch (error) {
      console.error('Currency formatting error:', error);
      // Fallback to manual formatting
      const symbol = getCurrencySymbol(currency);
      return `${symbol}${formatNumber(value || 0)}`;
    }
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[900px] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Target className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">{campaign.name}</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {campaign.description || t('campaignDetails.noDescription')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">{t('campaignDetails.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="participants" className="text-xs sm:text-sm py-2">{t('campaignDetails.tabs.participants')}</TabsTrigger>
            <TabsTrigger value="activities" className="text-xs sm:text-sm py-2">{t('campaignDetails.tabs.activities')}</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2">{t('campaignDetails.tabs.analytics')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 pr-2">
                <Card className="flex-shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">{t('campaignDetails.overview.information')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.status')}:</span>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.type')}:</span>
                      {getCampaignTypeBadge(campaign.campaign_type)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.goalType')}:</span>
                      {getGoalTypeBadge(campaign.goal_type, campaign.campaign_type)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.duration')}:</span>
                      <div className="flex items-center gap-1 text-xs sm:text-sm">
                        <Calendar className="h-3 w-3" />
                        <span className="truncate">
                          {campaign.is_open_campaign ? t('campaignDetails.overview.openCampaign') : `${formatDate(campaign.start_date)} - ${formatDate(campaign.end_date)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.createdBy')}:</span>
                      <span className="text-xs sm:text-sm truncate">{campaign.created_by_fname} {campaign.created_by_lname}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">{t('campaignDetails.overview.createdAt')}:</span>
                      <span className="text-xs sm:text-sm">{formatDate(campaign.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex-shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">{t('campaignDetails.overview.progress')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    {campaign.goal_value > 0 ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span>{t('campaignDetails.overview.target')}:</span>
                            <span className="font-medium">{formatNumber(campaign.goal_value)}</span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span>{t('campaignDetails.overview.current')}:</span>
                            <span className="font-medium">{formatNumber(campaign.current_value || 0)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {getProgressBar(campaign.current_value || 0, campaign.goal_value)}
                        </div>
                        {stats && (
                          <div className="pt-2 border-t">
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              {t('campaignDetails.overview.progressDescription', { 
                                percentage: Math.round(((campaign.current_value || 0) / campaign.goal_value) * 100), 
                                remaining: formatNumber(campaign.goal_value - (campaign.current_value || 0))
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs sm:text-sm text-muted-foreground">{t('campaignDetails.overview.noGoalSet')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {stats && (
                <Card className="mt-3 sm:mt-4 flex-shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">{t('campaignDetails.overview.quickStats')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div className="text-center">
                        <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total_participants}</div>
                        <div className="text-xs text-muted-foreground">{t('campaignDetails.stats.totalParticipants')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.active_participants}</div>
                        <div className="text-xs text-muted-foreground">{t('campaignDetails.stats.activeParticipants')}</div>
                      </div>
                      {/* <div className="text-center">
                        <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.completed_participants}</div>
                        <div className="text-xs text-muted-foreground">{t('campaignDetails.stats.completedParticipants')}</div>
                      </div> */}
                      <div className="text-center">
                        <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.total_activities}</div>
                        <div className="text-xs text-muted-foreground">{t('campaignDetails.stats.totalActivities')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="participants" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full w-full">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : campaignDetails?.participants?.length > 0 ? (
                <div className="space-y-3 pr-2">
                  {campaignDetails.participants.map((p) => (
                    <Card key={`${p.entity_type}-${p.entity_id}`} className="flex-shrink-0">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                              {p.entity_type === 'lead' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{p.entity_name}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {p.entity_email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{p.entity_email}</span>
                                  </span>
                                )}
                                {p.entity_info && (
                                  <span className="text-xs truncate block">{p.entity_info}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right space-y-1 flex-shrink-0">
                            {getParticipantStatusBadge(p.status)}
                            <div className="text-xs text-muted-foreground">
                              {t('campaignDetails.participants.joinedAt')}: {formatDate(p.joined_at)}
                            </div>
                            {p.contribution > 0 && (
                              <div className="text-xs font-medium text-green-600">
                                {t('campaignDetails.participants.contribution')}: {formatNumber(p.contribution)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">{t('campaignDetails.participants.noParticipants')}</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activities" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full w-full">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : campaignDetails?.activities?.length > 0 ? (
                <div className="space-y-3 pr-2">
                  {campaignDetails.activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="mt-1 flex-shrink-0">
                        {getActivityIcon(act.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{act.entity_name}</span>
                          <Badge variant="outline" className="text-xs self-start sm:self-auto">{act.activity_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1 break-words">{act.activity_description}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(act.created_at)}
                          </span>
                          {act.created_by_username && (
                            <span>by {act.created_by_username}</span>
                          )}
                          {act.value_contributed > 0 && (
                            <span className="text-green-600 font-medium">+{formatNumber(act.value_contributed)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">{t('campaignDetails.activities.noActivities')}</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="analytics" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full w-full">
              {analyticsLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !analytics ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">{t('campaignDetails.analytics.noData')}</p>
                </div>
              ) : (
                <div className="space-y-4 pr-2">
                  {/* Pacing Analytics */}
                  {analytics.pacing && (
                    <Card className="flex-shrink-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">{t('campaignDetails.analytics.pacing.title')}</CardTitle>
                        <CardDescription className="text-sm">{t('campaignDetails.analytics.pacing.description')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className={`flex items-center p-3 rounded-md mb-4 ${
                          analytics.pacing.onTrack ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        } border`}>
                          {analytics.pacing.onTrack ? 
                            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mr-3 flex-shrink-0" /> : 
                            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 mr-3 flex-shrink-0" />
                          }
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm sm:text-base ${
                              analytics.pacing.onTrack ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {analytics.pacing.onTrack ? 
                                t('campaignDetails.analytics.pacing.onTrack') : 
                                t('campaignDetails.analytics.pacing.behindTrack')
                              }
                            </p>
    <p className="text-xs sm:text-sm text-muted-foreground">
      {analytics.pacing?.onTrack ? 
        t('campaignDetails.analytics.pacing.projected', { 
          value: formatNumber(Number(analytics.pacing?.projectedValue || 0).toFixed(2))
        }) :
        `${t('campaignDetails.analytics.pacing.projected', { 
          value: formatNumber(Number(analytics.pacing?.projectedValue || 0).toFixed(2))
        })}/${formatNumber(Number(analytics.pacing?.goalValue || 0).toFixed(2))}`
      }
    </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                          <div>
                            <div className="font-bold text-sm sm:text-lg">
                              {analytics.pacing.daysElapsed} / {analytics.pacing.campaignDuration}
                            </div>
                            <div className="text-xs text-muted-foreground">{t('campaignDetails.analytics.pacing.daysElapsed')}</div>
                          </div>
                          <div>
                            <div className="font-bold text-sm sm:text-lg">{analytics.pacing.daysRemaining}</div>
                            <div className="text-xs text-muted-foreground">{t('campaignDetails.analytics.pacing.daysRemaining')}</div>
                          </div>
                          <div>
                            <div className="font-bold text-sm sm:text-lg">{formatNumber(analytics.pacing.currentPace.toFixed(2))}</div>
                            <div className="text-xs text-muted-foreground">{t('campaignDetails.analytics.pacing.currentPace')}</div>
                          </div>
                          <div>
                            <div className="font-bold text-sm sm:text-lg">{formatNumber(analytics.pacing.requiredPace.toFixed(2))}</div>
                            <div className="text-xs text-muted-foreground">{t('campaignDetails.analytics.pacing.requiredPace')}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Enhanced Top Performers - Meeting Campaign Version */}
                    <Card className="flex-shrink-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                          {t('campaignDetails.analytics.topPerformers')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {analytics.topPerformers.length > 0 ? (
                          <div className="max-h-64 overflow-auto border rounded-md">
                            <Table>
                              <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow>
                                  <TableHead className="text-xs sm:text-sm">{t('common.user')}</TableHead>
                                  {campaign.campaign_type === 'account' && campaign.goal_type === 'meetings' ? (
                                    <>
                                      <TableHead className="text-right text-xs sm:text-sm">{t('metrics.totalCalls')}</TableHead>
                                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.successRate')}</TableHead>
                                      <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('metrics.meetings')}</TableHead>
                                    </>
                                  ) : campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type) ? (
                                    <>
                                      <TableHead className="text-right text-xs sm:text-sm">{t('metrics.salesValue')}</TableHead>
                                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.products')}</TableHead>
                                      <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('metrics.avgSale')}</TableHead>
                                    </>
                                  ) : campaign.campaign_type === 'lead' && campaign.goal_type === 'conversion' ? (
                                    <>
                                      <TableHead className="text-right text-xs sm:text-sm">{t('metrics.conversions')}</TableHead>
                                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.activities')}</TableHead>
                                    </>
                                  ) : (
                                    <TableHead className="text-right text-xs sm:text-sm">{t('campaignDetails.analytics.contribution')}</TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {analytics.topPerformers.map((p, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs sm:text-sm font-medium">
                                      {p.first_name} {p.last_name}
                                    </TableCell>
                                    {campaign.campaign_type === 'account' && campaign.goal_type === 'meetings' ? (
                                      <>
                                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                                          <div className="flex items-center justify-end gap-1">
                                            <Phone className="h-3 w-3 text-blue-600" />
                                            {formatNumber(p.total_calls || 0)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                          <div className="flex items-center justify-end gap-1">
                                            <TrendingUp className="h-3 w-3 text-green-600" />
                                            {p.success_rate || '0.0'}%
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                          <div className="flex items-center justify-end gap-1">
                                            <Calendar className="h-3 w-3 text-purple-600" />
                                            {formatNumber(p.meetings_scheduled || 0)}
                                          </div>
                                        </TableCell>
                                      </>
                                    ) : campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type) ? (
                                      <>
                                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                                          <div className="flex items-center justify-end gap-1">
                                            {getCurrencyIcon(campaign.goal_currency)}
                                            {formatCurrency(p.total_sales_value || p.total_contribution, campaign.goal_currency)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                          <div className="flex items-center justify-end gap-1">
                                            <Package className="h-3 w-3 text-blue-600" />
                                            {formatNumber(p.product_sales_count || 0)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                          {formatCurrency(p.avg_sale_value || 0, campaign.goal_currency)}
                                        </TableCell>
                                      </>
                                    ) : campaign.campaign_type === 'lead' && campaign.goal_type === 'conversion' ? (
                                      <>
                                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                                          <div className="flex items-center justify-end gap-1">
                                            <ArrowRight className="h-3 w-3 text-purple-600" />
                                            {formatNumber(p.total_conversions || p.total_contribution)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                          {formatNumber(p.total_activities || 0)}
                                        </TableCell>
                                      </>
                                    ) : (
                                      <TableCell className="text-right font-medium text-xs sm:text-sm">
                                        {formatNumber(parseFloat(p.total_contribution || 0).toFixed(2))}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                            {t('campaignDetails.analytics.noPerformers')}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Enhanced Breakdown - Meeting Campaign Version */}
                    {analytics.breakdown && (
                      <Card className="flex-shrink-0">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            {analytics.breakdown.type === 'lead_status' ? 
                              t('campaignDetails.analytics.leadStatusBreakdown') : 
                              analytics.breakdown.type === 'call_categories' ?
                                t('campaignDetails.analytics.callCategoriesBreakdown') :
                                t('campaignDetails.analytics.productRevenueBreakdown')
                            }
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analytics.breakdown.data.length > 0 ? (
                            <div className="max-h-64 overflow-auto border rounded-md">
                              <Table>
                                <TableHeader className="sticky top-0 bg-white z-10">
                                  <TableRow>
                                    <TableHead className="text-xs sm:text-sm">
                                      {analytics.breakdown.type === 'lead_status' ? 
                                        t('common.status') : 
                                        analytics.breakdown.type === 'call_categories' ?
                                          t('common.callCategory') :
                                          t('common.product')
                                      }
                                    </TableHead>
                                    <TableHead className="text-right text-xs sm:text-sm">
                                      {analytics.breakdown.type === 'lead_status' ? 
                                        t('common.count') : 
                                        analytics.breakdown.type === 'call_categories' ?
                                          t('metrics.totalCalls') :
                                          t('common.revenue')
                                      }
                                    </TableHead>
                                    {analytics.breakdown.type === 'call_categories' && (
                                      <>
                                        <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.successRate')}</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('metrics.meetings')}</TableHead>
                                      </>
                                    )}
                                    {analytics.breakdown.type === 'product_revenue' && (
                                      <>
                                        <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('common.units')}</TableHead>
                                        <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('common.accounts')}</TableHead>
                                      </>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {analytics.breakdown.data.map((item, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs sm:text-sm font-medium">
                                        {item.lead_status || item.category || item.name}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-xs sm:text-sm">
                                        {analytics.breakdown.type === 'lead_status' ? (
                                          <div className="flex items-center justify-end gap-1">
                                            <Users className="h-3 w-3 text-blue-600" />
                                            {formatNumber(item.count)}
                                          </div>
                                        ) : analytics.breakdown.type === 'call_categories' ? (
                                          <div className="flex items-center justify-end gap-1">
                                            <Phone className="h-3 w-3 text-blue-600" />
                                            {formatNumber(item.call_count)}
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1">
                                            {getCurrencyIcon(campaign.goal_currency)}
                                            {formatCurrency(item.total_value, campaign.goal_currency)}
                                          </div>
                                        )}
                                      </TableCell>
                                      {analytics.breakdown.type === 'call_categories' && (
                                        <>
                                          <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                            <div className="flex items-center justify-end gap-1">
                                              <TrendingUp className="h-3 w-3 text-green-600" />
                                              {item.success_rate || '0.0'}%
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                            <div className="flex items-center justify-end gap-1">
                                              <Calendar className="h-3 w-3 text-purple-600" />
                                              {formatNumber(item.meetings_scheduled || 0)}
                                            </div>
                                          </TableCell>
                                        </>
                                      )}
                                      {analytics.breakdown.type === 'product_revenue' && (
                                        <>
                                          <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                            <div className="flex items-center justify-end gap-1">
                                              <Package className="h-3 w-3 text-purple-600" />
                                              {formatNumber(item.units_sold || 0)}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                            <div className="flex items-center justify-end gap-1">
                                              <Building className="h-3 w-3 text-orange-600" />
                                              {formatNumber(item.unique_accounts || 0)}
                                            </div>
                                          </TableCell>
                                        </>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                              {t('common.noData')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Additional Top Call Accounts Section - Only for Meeting Campaigns */}
                  {campaign.campaign_type === 'account' && campaign.goal_type === 'meetings' && analytics.topCallAccounts && analytics.topCallAccounts.length > 0 && (
                    <div className="mt-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                            {t('campaignDetails.analytics.mostActiveAccounts')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-80 overflow-auto border rounded-md">
                            <Table>
                              <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow>
                                  <TableHead className="text-xs sm:text-sm">{t('common.account')}</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm">{t('metrics.totalCalls')}</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.successRate')}</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">{t('metrics.meetings')}</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('common.callTime')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {analytics.topCallAccounts.map((account, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs sm:text-sm">
                                      <div>
                                        <div className="font-medium">{account.account_name}</div>
                                        <div className="text-muted-foreground text-xs">{account.contact_name}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-xs sm:text-sm">
                                      <div className="flex items-center justify-end gap-1">
                                        <Phone className="h-3 w-3 text-blue-600" />
                                        {formatNumber(account.total_calls_received)}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                      <div className="flex items-center justify-end gap-1">
                                        <TrendingUp className="h-3 w-3 text-green-600" />
                                        {account.success_rate}%
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">
                                      <div className="flex items-center justify-end gap-1">
                                        <Calendar className="h-3 w-3 text-purple-600" />
                                        {formatNumber(account.meetings_scheduled)}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                      <div className="flex items-center justify-end gap-1">
                                        <Clock className="h-3 w-3 text-orange-600" />
                                        {Math.round(account.total_call_time || 0)}m
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Additional Sales Analytics for Account Campaigns */}
                  {campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type) && analytics.topPerformers.length > 0 && (
                    <Card className="flex-shrink-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                          {t('campaignDetails.analytics.salesPerformance.title')}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {t('campaignDetails.analytics.salesPerformance.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          {/* Calculate aggregate metrics from top performers */}
                          {(() => {
                            const totalSales = analytics.topPerformers.reduce((sum, p) => sum + (p.total_sales_value || p.total_contribution || 0), 0);
                            const totalProducts = analytics.topPerformers.reduce((sum, p) => sum + (p.product_sales_count || 0), 0);
                            const avgSaleValue = totalProducts > 0 ? totalSales / totalProducts : 0;
                            const highestSale = Math.max(...analytics.topPerformers.map(p => p.highest_sale_value || 0));
                            
                            return (
                              <>
                                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="text-lg sm:text-xl font-bold text-green-700">
                                    {formatCurrency(totalSales, campaign.goal_currency)}
                                  </div>
                                  <div className="text-xs text-green-600 font-medium">{t('campaignDetails.analytics.salesPerformance.totalSalesValue')}</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="text-lg sm:text-xl font-bold text-blue-700">
                                    {formatNumber(totalProducts)}
                                  </div>
                                  <div className="text-xs text-blue-600 font-medium">{t('campaignDetails.analytics.salesPerformance.productsSold')}</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="text-lg sm:text-xl font-bold text-purple-700">
                                    {formatCurrency(avgSaleValue, campaign.goal_currency)}
                                  </div>
                                  <div className="text-xs text-purple-600 font-medium">{t('campaignDetails.analytics.salesPerformance.avgSaleValue')}</div>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                                  <div className="text-lg sm:text-xl font-bold text-orange-700">
                                    {formatCurrency(highestSale, campaign.goal_currency)}
                                  </div>
                                  <div className="text-xs text-orange-600 font-medium">{t('campaignDetails.analytics.salesPerformance.highestSale')}</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Detailed performer breakdown */}
                        <div className="max-h-64 overflow-auto border rounded-md">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                              <TableRow>
                                <TableHead className="text-xs sm:text-sm">{t('common.salesRep')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm">{t('common.totalSales')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.products')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">{t('metrics.avgSale')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('campaignDetails.analytics.salesPerformance.highestSale')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden xl:table-cell">{t('metrics.activities')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics.topPerformers.map((performer, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs sm:text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                                        {i + 1}
                                      </div>
                                      {performer.first_name} {performer.last_name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-xs sm:text-sm text-green-700">
                                    {formatCurrency(performer.total_sales_value || performer.total_contribution, campaign.goal_currency)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                    <span className="inline-flex items-center gap-1">
                                      <Package className="h-3 w-3 text-blue-600" />
                                      {formatNumber(performer.product_sales_count || 0)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">
                                    {formatCurrency(performer.avg_sale_value || 0, campaign.goal_currency)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell text-orange-700 font-medium">
                                    {formatCurrency(performer.highest_sale_value || 0, campaign.goal_currency)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm hidden xl:table-cell">
                                    <span className="text-gray-600">{formatNumber(performer.total_activities || 0)}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {analytics.topEarningAccounts && analytics.topEarningAccounts.length > 0 && (
        <TopEarningAccounts 
          topEarningAccounts={analytics.topEarningAccounts}
          goalCurrency={campaign.goal_currency}
        />
      )}

                  {/* Additional Conversion Analytics for Lead Campaigns */}
                  {campaign.campaign_type === 'lead' && campaign.goal_type === 'conversion' && analytics.topPerformers.length > 0 && (
                    <Card className="flex-shrink-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                          {t('campaignDetails.analytics.conversionPerformance.title')}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {t('campaignDetails.analytics.conversionPerformance.description')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                          {/* Calculate conversion metrics */}
                          {(() => {
                            const totalConversions = analytics.topPerformers.reduce((sum, p) => sum + (p.total_conversions || p.total_contribution || 0), 0);
                            const totalActivities = analytics.topPerformers.reduce((sum, p) => sum + (p.total_activities || 0), 0);
                            const conversionRate = totalActivities > 0 ? (totalConversions / totalActivities * 100) : 0;
                            
                            return (
                              <>
                                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="text-lg sm:text-xl font-bold text-purple-700">
                                    {formatNumber(totalConversions)}
                                  </div>
                                  <div className="text-xs text-purple-600 font-medium">{t('campaignDetails.analytics.conversionPerformance.totalConversions')}</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="text-lg sm:text-xl font-bold text-blue-700">
                                    {formatNumber(totalActivities)}
                                  </div>
                                  <div className="text-xs text-blue-600 font-medium">{t('campaignDetails.analytics.conversionPerformance.totalActivities')}</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="text-lg sm:text-xl font-bold text-green-700">
                                    {conversionRate.toFixed(1)}%
                                  </div>
                                  <div className="text-xs text-green-600 font-medium">{t('campaignDetails.analytics.conversionPerformance.conversionRate')}</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Detailed conversion breakdown */}
                        <div className="max-h-64 overflow-auto border rounded-md">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                              <TableRow>
                                <TableHead className="text-xs sm:text-sm">{t('common.salesRep')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm">{t('metrics.conversions')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('metrics.activities')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">{t('common.rate')}</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">{t('common.performance')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics.topPerformers.map((performer, i) => {
                                const conversionRate = (performer.total_activities > 0) ? 
                                  ((performer.total_conversions || performer.total_contribution) / performer.total_activities * 100) : 0;
                                
                                return (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs sm:text-sm font-medium">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                                          {i + 1}
                                        </div>
                                        {performer.first_name} {performer.last_name}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xs sm:text-sm text-purple-700">
                                      <span className="inline-flex items-center gap-1">
                                        <ArrowRight className="h-3 w-3 text-purple-600" />
                                        {formatNumber(performer.total_conversions || performer.total_contribution)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                                      <span className="text-gray-600">{formatNumber(performer.total_activities || 0)}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">
                                      <span className={`font-medium ${conversionRate > 50 ? 'text-green-700' : conversionRate > 25 ? 'text-orange-700' : 'text-red-700'}`}>
                                        {conversionRate.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">
                                      <div className="flex items-center justify-end">
                                        {conversionRate > 75 ? (
                                          <div className="flex items-center gap-1 text-green-700">
                                            <TrendingUp className="h-3 w-3" />
                                            <span className="text-xs font-medium">{t('common.performanceLevels.excellent')}</span>
                                          </div>
                                        ) : conversionRate > 50 ? (
                                          <div className="flex items-center gap-1 text-blue-700">
                                            <LineChart className="h-3 w-3" />
                                            <span className="text-xs font-medium">{t('common.performanceLevels.good')}</span>
                                          </div>
                                        ) : conversionRate > 25 ? (
                                          <div className="flex items-center gap-1 text-orange-700">
                                            <TrendingDown className="h-3 w-3" />
                                            <span className="text-xs font-medium">{t('common.performanceLevels.average')}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-red-700">
                                            <AlertCircle className="h-3 w-3" />
                                            <span className="text-xs font-medium">{t('common.performanceLevels.needsImprovement')}</span>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDetailsDialog;