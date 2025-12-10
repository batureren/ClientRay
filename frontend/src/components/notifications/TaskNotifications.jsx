import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Bell, Clock, AlertTriangle, Users, Building, Calendar, AtSign } from 'lucide-react'
import api from '@/services/api';

const TaskNotifications = ({ user, onTaskClick, refreshTrigger }) => {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState({
    pending_count: 0,
    overdue_tasks: [],
    upcoming_tasks: [],
    unread_mentions: 0,
    mentioned_tasks: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const fetchNotifications = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await api.get('/tasks/notifications')
      setNotifications(data.data)
    } catch (error) { console.error('Error fetching task notifications:', error) }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { if (refreshTrigger) fetchNotifications() }, [refreshTrigger])

  const handleOpenChange = (open) => { setIsOpen(open); if (open) fetchNotifications() }

  const handleTaskClick = async (task) => {
    setIsOpen(false)
    try { await api.put('/tasks/mentions/read', { taskId: task.id }) } 
    catch (error) { console.error('Error marking mentions as read:', error) }
    if (onTaskClick) onTaskClick(task, 'view')
    setTimeout(() => { fetchNotifications() }, 1000)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString), now = new Date()
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60))
    if (diffHours < 1) return t('taskNotifications.dates.justNow')
    if (diffHours < 24) return t('taskNotifications.dates.overdueHours', { count: diffHours })
    return t('taskNotifications.dates.overdueDays', { count: Math.floor(diffHours / 24) })
  }

  const formatUpcomingDate = (dateString) => {
    const date = new Date(dateString), now = new Date()
    const diffHours = Math.floor((date - now) / (1000 * 60 * 60))
    if (diffHours < 24) return t('taskNotifications.dates.remainingHours', { count: diffHours })
    return t('taskNotifications.dates.remainingDays', { count: Math.floor(diffHours / 24) })
  }

  const formatMentionDate = (dateString) => {
    const date = new Date(dateString), now = new Date()
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60))
    if (diffHours < 1) return t('taskNotifications.dates.justNow')
    if (diffHours < 24) return t('taskNotifications.dates.agoHours', { count: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return t('taskNotifications.dates.agoDay', { count: 1 })
    if (diffDays < 7) return t('taskNotifications.dates.agoDays', { count: diffDays })
    return date.toLocaleDateString()
  }

  const getTaskIcon = (task) => {
    if (task.lead_name) return <Users className="h-4 w-4 text-blue-600" />
    if (task.account_name) return <Building className="h-4 w-4 text-green-600" />
    return <Clock className="h-4 w-4 text-gray-600" />
  }

  const getPriorityColor = (priority) => ({
    'urgent': 'text-red-600', 'high': 'text-orange-600',
    'medium': 'text-yellow-600', 'low': 'text-green-600'
  })[priority] || 'text-gray-600'

  const getMentionTypeText = (mentionType) => t(`taskNotifications.mentionTypes.${mentionType}`, { defaultValue: t('taskNotifications.mentionTypes.default') })

  const totalNotifications = notifications.overdue_tasks.length + notifications.unread_mentions

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && ( <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{totalNotifications > 99 ? '99+' : totalNotifications}</Badge> )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5" />{t('taskNotifications.title')}</CardTitle>
            <CardDescription>
              {t('taskNotifications.description.pending', { count: notifications.pending_count })}
              {notifications.overdue_tasks.length > 0 && ( <span className="text-red-600">{' '}{t('taskNotifications.description.overdue', { count: notifications.overdue_tasks.length })}</span> )}
              {notifications.unread_mentions > 0 && ( <span className="text-blue-600">{' '}{t('taskNotifications.description.mentions', { count: notifications.unread_mentions })}</span> )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? ( <div className="text-center py-4"><div className="text-sm text-muted-foreground">{t('taskNotifications.loading')}</div></div> ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {notifications.overdue_tasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600"><AlertTriangle className="h-4 w-4" />{t('taskNotifications.overdueTitle', { count: notifications.overdue_tasks.length })}</div>
                    {notifications.overdue_tasks.map((task) => (
                      <div key={`overdue-${task.id}`} className="p-3 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors" onClick={() => handleTaskClick(task)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">{getTaskIcon(task)}<div className="font-medium text-sm truncate">{task.task_name}</div><Badge className={`text-xs ${getPriorityColor(task.task_priority)}`}>{t(`taskNotifications.priorities.${task.task_priority}`, { defaultValue: task.task_priority })}</Badge></div>
                            <div className="text-xs text-muted-foreground truncate mb-1">{task.task_description}</div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{task.lead_name && t('taskNotifications.task.lead', { name: task.lead_name })}{task.account_name && t('taskNotifications.task.account', { name: task.account_name })}{!task.lead_name && !task.account_name && t('taskNotifications.task.general')}</span>
                              <span className="text-red-600 font-medium">{formatDate(task.deadline_date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.overdue_tasks.length > 0 && (notifications.upcoming_tasks.length > 0 || notifications.mentioned_tasks?.length > 0) && <Separator />}
                {notifications.mentioned_tasks && notifications.mentioned_tasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-purple-600"><AtSign className="h-4 w-4" />{t('taskNotifications.mentionsTitle', { count: notifications.mentioned_tasks.length })}</div>
                    {notifications.mentioned_tasks.map((mention) => (
                      <div key={`mentioned-${mention.task_id}-${mention.mention_id}`} className="p-3 rounded-lg border border-purple-100 bg-purple-50 hover:bg-purple-100 cursor-pointer transition-colors" onClick={() => handleTaskClick(mention)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">{getTaskIcon(mention)}<div className="font-medium text-sm truncate">{mention.task_name}</div><Badge className={`text-xs ${getPriorityColor(mention.task_priority)}`}>{t(`taskNotifications.priorities.${mention.task_priority}`, { defaultValue: mention.task_priority })}</Badge></div>
                            <div className="text-xs text-muted-foreground truncate mb-1">{mention.task_description}</div>
                            <div className="text-xs text-purple-600 mb-1">{mention.mentioned_by_name} {getMentionTypeText(mention.mention_type)}</div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{mention.lead_name && t('taskNotifications.task.lead', { name: mention.lead_name })}{mention.account_name && t('taskNotifications.task.account', { name: mention.account_name })}{!mention.lead_name && !mention.account_name && t('taskNotifications.task.general')}</span>
                              <span className="text-purple-600 font-medium">{formatMentionDate(mention.mentioned_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.mentioned_tasks?.length > 0 && notifications.upcoming_tasks.length > 0 && <Separator />}
                {notifications.upcoming_tasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600"><Calendar className="h-4 w-4" />{t('taskNotifications.upcomingTitle', { count: notifications.upcoming_tasks.length })}</div>
                    {notifications.upcoming_tasks.map((task) => (
                      <div key={`upcoming-${task.id}`} className="p-3 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors" onClick={() => handleTaskClick(task)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">{getTaskIcon(task)}<div className="font-medium text-sm truncate">{task.task_name}</div><Badge className={`text-xs ${getPriorityColor(task.task_priority)}`}>{t(`taskNotifications.priorities.${task.task_priority}`, { defaultValue: task.task_priority })}</Badge></div>
                            <div className="text-xs text-muted-foreground truncate mb-1">{task.task_description}</div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{task.lead_name && t('taskNotifications.task.lead', { name: task.lead_name })}{task.account_name && t('taskNotifications.task.account', { name: task.account_name })}{!task.lead_name && !task.account_name && t('taskNotifications.task.general')}</span>
                              <span className="text-blue-600 font-medium">{formatUpcomingDate(task.deadline_date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.unread_mentions > 0 && (!notifications.mentioned_tasks || notifications.mentioned_tasks.length === 0) && (
                  <>
                    {(notifications.overdue_tasks.length > 0 || notifications.upcoming_tasks.length > 0) && <Separator />}
                    <div className="p-3 rounded-lg border border-blue-100 bg-blue-50"><div className="flex items-center gap-2 text-sm"><AtSign className="h-4 w-4 text-blue-600" /><span className="font-medium text-blue-600">{t('taskNotifications.unreadMentions', { count: notifications.unread_mentions })}</span></div></div>
                  </>
                )}
                {notifications.overdue_tasks.length === 0 && notifications.upcoming_tasks.length === 0 && notifications.unread_mentions === 0 && (!notifications.mentioned_tasks || notifications.mentioned_tasks.length === 0) && ( <div className="text-center py-4 text-sm text-muted-foreground">{t('taskNotifications.noNotifications')}</div> )}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

export default TaskNotifications