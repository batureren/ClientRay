// components/dialogs/AccountCallHistoryDialog.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import { Phone, Clock, MessageSquare, Calendar, MoreHorizontal, Trash2, User, TrendingUp, PhoneCall, Users } from 'lucide-react'
import ConfirmationDialog from './ConfirmationDialog';
import api from '@/services/api';

const AccountCallHistoryDialog = ({ open, onOpenChange, account, user, onCallUpdated }) => {
  const { t, i18n } = useTranslation()
  const [callLogs, setCallLogs] = useState([])
  const [callStats, setCallStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [callToDeleteId, setCallToDeleteId] = useState(null);

  useEffect(() => {
    if (open && account) {
      fetchCallLogs()
      fetchCallStats()
    }
  }, [open, account])

  const fetchCallLogs = async () => {
    if (!account) return
    setIsLoading(true)
    try {
      const calls = await api.get(`/account-calls/account/${account.id}`)
      setCallLogs(calls.data)
    } catch (error) { console.error('Error fetching account call logs:', error); setCallLogs([]) } 
    finally { setIsLoading(false) }
  }

  const fetchCallStats = async () => {
    if (!account) return
    try {
      const stats = await api.get(`/account-calls/account/${account.id}/stats`)
      setCallStats(stats.data)
    } catch (error) { console.error('Error fetching account call stats:', error); setCallStats(null) }
  }

  const promptDeleteCall = (callId) => {
    setCallToDeleteId(callId);
    setShowConfirmDialog(true);
  };

  const confirmDeleteCall = async () => {
    if (!callToDeleteId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/account-calls/${callToDeleteId}`);
      await fetchCallLogs();
      await fetchCallStats();
      onCallUpdated?.();
    } catch (error) {
      console.error('Error deleting call:', error);
      alert(t('accountCallHistory.deleteError'));
    } finally {
      setIsDeleting(false);
      setCallToDeleteId(null);
      setShowConfirmDialog(false);
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString)
    return {
      date: date.toLocaleDateString(i18n.language),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const getCategoryBadgeColor = (category) => ({
    'Sale': 'bg-green-100 text-green-800', 'Follow-up': 'bg-blue-100 text-blue-800', 
    'Informational': 'bg-gray-100 text-gray-800', 'Reminder': 'bg-yellow-100 text-yellow-800', 
    'Support': 'bg-purple-100 text-purple-800', 'Meeting': 'bg-indigo-100 text-indigo-800', 
    'Negotiation': 'bg-orange-100 text-orange-800'
  })[category] || 'bg-gray-100 text-gray-800'

  const getOutcomeBadgeColor = (outcome) => ({
    'Successful': 'bg-green-100 text-green-800', 'No Answer': 'bg-red-100 text-red-800',
    'Voicemail': 'bg-yellow-100 text-yellow-800', 'Busy': 'bg-orange-100 text-orange-800',
    'Disconnected': 'bg-red-100 text-red-800', 'Meeting Scheduled': 'bg-blue-100 text-blue-800'
  })[outcome] || 'bg-gray-100 text-gray-800'

  const canEditCall = (call) => user && (call.user_id === user.id || user.role === 'manager')

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[80vh] p-4 sm:p-6">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg"><PhoneCall className="h-5 w-5" />{t('accountCallHistory.title', { name: account?.account_name })}</DialogTitle>
          <DialogDescription>{t('accountCallHistory.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-hidden flex flex-col min-h-0">
          {callStats?.stats && (
            <Card className="flex-shrink-0">
              <CardHeader className="pb-2 sm:pb-3"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />{t('accountCallHistory.stats.title')}</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between sm:hidden text-xs">
                  <div className="text-center flex-1"><div className="text-lg font-bold text-blue-600">{callStats.stats.total_calls || 0}</div><div className="text-muted-foreground leading-tight">{t('accountCallHistory.stats.total_mobile')}</div></div>
                  <div className="text-center flex-1"><div className="text-lg font-bold text-green-600">{callStats.stats.successful_calls || 0}</div><div className="text-muted-foreground leading-tight">{t('accountCallHistory.stats.success_mobile')}</div></div>
                  <div className="text-center flex-1"><div className="text-lg font-bold text-purple-600">{Math.round(callStats.stats.avg_duration || 0)}</div><div className="text-muted-foreground leading-tight">{t('accountCallHistory.stats.avg_mobile')}</div></div>
                  <div className="text-center flex-1"><div className="text-lg font-bold text-indigo-600">{callStats.stats.meetings_scheduled || 0}</div><div className="text-muted-foreground leading-tight">{t('accountCallHistory.stats.meetings_mobile')}</div></div>
                </div>
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center"><div className="text-2xl font-bold text-blue-600">{callStats.stats.total_calls || 0}</div><div className="text-muted-foreground">{t('accountCallHistory.stats.total')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-green-600">{callStats.stats.successful_calls || 0}</div><div className="text-muted-foreground">{t('accountCallHistory.stats.successful')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-purple-600">{Math.round(callStats.stats.avg_duration || 0)}</div><div className="text-muted-foreground">{t('accountCallHistory.stats.avg')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-indigo-600">{callStats.stats.meetings_scheduled || 0}</div><div className="text-muted-foreground">{t('accountCallHistory.stats.meetings')}</div></div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex-shrink-0 pb-2 sm:pb-3"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Phone className="h-4 w-4" />{t('accountCallHistory.logTitle', { count: callLogs.length })}</CardTitle></CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[300px] sm:max-h-[400px]">
                {isLoading ? ( <div className="flex justify-center items-center h-32"><div className="text-muted-foreground text-sm">{t('accountCallHistory.loading')}</div></div>
                ) : callLogs.length === 0 ? ( <div className="flex justify-center items-center h-32"><div className="text-muted-foreground text-sm">{t('accountCallHistory.noCalls')}</div></div>
                ) : (
                  <div className="space-y-3 p-3 sm:p-4">
                    {callLogs.map((call) => {
                      const { date, time } = formatDateTime(call.call_date);
                      const outcomeKey = call.call_outcome?.replace(' ', '_');
                      return (
                        <Card key={call.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <Badge className={`${getCategoryBadgeColor(call.category)} text-xs`}>{t(`profile.categories.${call.category?.toLowerCase()}`, { defaultValue: call.category })}</Badge>
                                <Badge variant="outline" className={`${getOutcomeBadgeColor(call.call_outcome)} text-xs`}>{t(`profile.callOutcomes.${outcomeKey?.toLowerCase()}`, { defaultValue: call.call_outcome })}</Badge>
                                {call.call_duration && <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />{call.call_duration}m</Badge>}
                                {call.contact_person && <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Users className="h-3 w-3" />{call.contact_person}</Badge>}
                              </div>
                            {canEditCall(call) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 sm:h-8 sm:w-8">
                                    <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => promptDeleteCall(call.id)} // Updated onClick
                                    className="text-red-600 focus:text-red-600"
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{date} {t('accountCallHistory.atTime')} {time}</div>
                                <div className="flex items-center gap-1"><User className="h-3 w-3" />{call.logged_by_name || call.user_name}</div>
                              </div>
                              {call.notes && (
                                <div className="mt-2 sm:mt-3">
                                  <div className="text-xs sm:text-sm font-medium mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t('accountCallHistory.notes')}:</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 p-2 rounded">{call.notes}</div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={t('accountCallHistory.confirmDelete.title')}
        description={t('accountCallHistory.confirmDelete.description')}
        onConfirm={confirmDeleteCall}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />
    </>
  )
}

export default AccountCallHistoryDialog