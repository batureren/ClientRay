// components/dialogs/LeadHistoryDialog.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Tabs, TabsContent } from '@/components/ui/tabs.jsx'
import { User, Clock } from 'lucide-react'

const LeadHistoryDialog = ({ open, onOpenChange, lead, history, isLoading, formatDate, getActionIcon }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('history')

  const getActionColor = (actionType) => ({
    'created': 'bg-green-100 text-green-800', 'updated': 'bg-blue-100 text-blue-800',
    'converted': 'bg-purple-100 text-purple-800', 'deleted': 'bg-red-100 text-red-800',
    'status_changed': 'bg-orange-100 text-orange-800', 'task_created': 'bg-cyan-100 text-cyan-800',
    'task_updated': 'bg-indigo-100 text-indigo-800', 'task_deleted': 'bg-rose-100 text-rose-800'
  })[actionType] || 'bg-gray-100 text-gray-800'

  const formatFieldChange = (entry) => {
    if (entry.field_name && entry.old_value && entry.new_value) {
      return (
        <div className="mt-2 text-sm text-gray-600">
          <div className="font-medium capitalize mb-1">{t(`profile.fields.${entry.field_name}`, { defaultValue: entry.field_name.replace(/_/g, ' ') })}:</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="line-through text-red-600 break-all">"{entry.old_value}"</span>
            <span className="text-gray-400 hidden sm:inline">→</span>
            <span className="text-gray-400 sm:hidden">↓</span>
            <span className="text-green-600 break-all">"{entry.new_value}"</span>
          </div>
        </div>
      )
    }
    return null
  }

  if (!lead) return null

  const summaryStats = [
    { label: t('leadHistory.summary.created'), color: 'green-600', key: 'created' },
    { label: t('leadHistory.summary.updated'), color: 'blue-600', key: 'updated' },
    { label: t('leadHistory.summary.converted'), color: 'purple-600', key: 'converted' },
    { label: t('leadHistory.summary.statusChanges'), color: 'orange-600', key: 'status_changed' },
    { label: t('leadHistory.summary.taskActivities'), color: 'cyan-600', key: 'task_' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden p-3 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">{t('leadHistory.title', { name: `${lead.first_name} ${lead.last_name}` })}</span>
          </DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsContent value="history" className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 mb-4">
              <ScrollArea className="h-full pr-2">
                <div className="pb-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600 text-sm sm:text-base">{t('leadHistory.loading')}</span>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm sm:text-base">{t('leadHistory.noHistory')}</div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {history.map((entry, index) => (
                        <Card key={entry.id || index} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-2 sm:p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-1 flex-shrink-0">{getActionIcon(entry.action_type)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <Badge className={getActionColor(entry.action_type)}>{t(`leadHistory.actionTypes.${entry.action_type}`, { defaultValue: entry.action_type.replace(/_/g, ' ').toUpperCase() })}</Badge>
                                    <span className="text-sm text-gray-500">{t('leadHistory.byUser', { name: entry.user_name || t('leadHistory.unknownUser') })}</span>
                                  </div>
                                  <p className="text-gray-800 mb-2 break-words">{entry.description}</p>
                                  {formatFieldChange(entry)}
                                </div>
                              </div>
                              <div className="text-right text-sm text-gray-500 ml-4 flex-shrink-0">
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(entry.created_at)}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            {!isLoading && history.length > 0 && (
              <div className="border-t pt-2 sm:pt-3 flex-shrink-0 bg-white">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2 text-center text-xs sm:text-sm">
                  {summaryStats.map(({ label, color, key }) => {
                    const count = history.filter(h => key.endsWith('_') ? h.action_type.startsWith(key) : h.action_type === key).length;
                    return (
                      <div key={label} className="p-1 sm:p-0.5">
                        <div className={`text-base sm:text-lg font-bold text-${color}`}>{count}</div>
                        <div className="text-gray-600">{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default LeadHistoryDialog