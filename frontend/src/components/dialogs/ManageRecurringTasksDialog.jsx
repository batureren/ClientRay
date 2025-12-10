import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Repeat, StopCircle, Calendar, Clock, AlertCircle, Loader2 } from 'lucide-react'
import ConfirmationDialog from './ConfirmationDialog';
import api from '@/services/api';

const ManageRecurringTasksDialog = ({ open, onOpenChange }) => {
  const [recurringTasks, setRecurringTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [stopping, setStopping] = useState(null)
  
  // State for the custom confirmation dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)

  useEffect(() => {
    if (open) {
      fetchRecurringTasks()
    }
  }, [open])

const fetchRecurringTasks = async () => {
  setLoading(true)
  try {
    const response = await api.get('/tasks/recurring') 
    const recurringTasksData = Array.isArray(response.data) ? response.data : response.data.data || []
    setRecurringTasks(recurringTasksData)
  } catch (error) {
    console.error('Error fetching recurring tasks:', error)
  }
  setLoading(false)
}

  // Opens the confirmation dialog
  const handleStopRecurring = (task) => {
    setSelectedTask(task)
    setIsConfirmOpen(true)
  }

  const confirmStopRecurring = async () => {
    if (!selectedTask) return;

    setStopping(selectedTask.id)
    try {
      await api.put(`/tasks/${selectedTask.id}/stop-recurring`)
      await fetchRecurringTasks()
    } catch (error) {
      console.error('Error stopping recurring task:', error)
      alert('Failed to stop recurring task')
    }
    // Reset state and close the dialog
    setStopping(null)
    setIsConfirmOpen(false)
    setSelectedTask(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRecurrenceDisplay = (pattern, interval) => {
    const intervalText = interval > 1 ? ` (every ${interval})` : ''
    const patternMap = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    }
    return `${patternMap[pattern] || pattern}${intervalText}`
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const TaskAction = ({ task }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleStopRecurring(task)} // Updated onClick handler
      disabled={stopping === task.id}
      className="gap-2 w-full md:w-auto"
    >
      {stopping === task.id ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Stopping...
        </>
      ) : (
        <>
          <StopCircle className="h-4 w-4" />
          Stop Recurring
        </>
      )}
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Manage Recurring Tasks
            </DialogTitle>
            <DialogDescription>
              View and manage your recurring tasks. You can stop the recurrence schedule to prevent future instances from being created.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recurringTasks.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have any active recurring tasks at the moment.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="flex">
                  You have <strong>{recurringTasks.length}</strong> active recurring task{recurringTasks.length !== 1 ? 's' : ''}.
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4">
                  {recurringTasks.map(task => (
                      <div key={task.id} className="p-4 border rounded-lg space-y-3">
                          <div className="font-medium">{task.task_name}</div>
                          {task.task_description && (
                              <div className="text-sm text-muted-foreground">
                                  {task.task_description}
                              </div>
                          )}
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Pattern</span>
                              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                  <Repeat className="h-3 w-3" />
                                  {getRecurrenceDisplay(task.recurrence_pattern, task.recurrence_interval || 1)}
                              </Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Status</span>
                              <Badge className={getStatusColor(task.task_status)}>
                                  {task.task_status?.replace('_', ' ')}
                              </Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Next Occurrence</span>
                              <span className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {formatDate(task.next_occurrence)}
                              </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">End Date</span>
                              <span>
                                  {task.recurrence_end_date 
                                      ? formatDate(task.recurrence_end_date)
                                      : <span className="text-muted-foreground">Never</span>
                                  }
                              </span>
                          </div>
                          <TaskAction task={task} />
                      </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add the ConfirmationDialog component here */}
      <ConfirmationDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Stop Recurring Schedule?"
        description={`Are you sure you want to stop new instances of "${selectedTask?.task_name}" from being created? This action cannot be undone.`}
        onConfirm={confirmStopRecurring}
        confirmText="Yes, Stop Recurring"
      />
    </>
  )
}

export default ManageRecurringTasksDialog