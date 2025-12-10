// components/sections/RelatedTasksSection.jsx
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem} from '@/components/ui/dropdown-menu.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, MoreHorizontal, CheckCircle, Clock, AlertCircle, Edit, Trash2, User, Calendar, ListTodo, View } from 'lucide-react'
import CreateTaskDialog from '../dialogs/CreateTaskDialog'
import EditTaskDialog from '../dialogs/EditTaskDialog'
import OpenTaskDialog from '../dialogs/OpenTaskDialog'
import api from '@/services/api';

const RelatedTasksSection = ({ 
  relatedTo, 
  relatedType, 
  users, 
  user, 
  onTaskUpdate,
  inDialog = false,
  existingTasks = null,
  projects
}) => {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showViewDialog, setShowViewDialog] = useState(false)

  const fetchTasks = async () => {
    if (!relatedTo) return
    
    if (existingTasks !== null) {
      setTasks(existingTasks)
      return
    }
    
    setIsLoading(true)
    try {
      const endpoint = relatedType === 'lead' 
        ? `/leads/${relatedTo.id}/tasks` 
        : `/accounts/${relatedTo.id}/tasks`
      const data = await api.get(endpoint)
      setTasks(data.data)
    } catch (error) {
      console.error('Error fetching related tasks:', error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [relatedTo, relatedType, existingTasks])

  const triggerRefresh = () => {
    if (existingTasks !== null && onTaskUpdate) {
      onTaskUpdate()
    } else {
      fetchTasks()
      if (onTaskUpdate) onTaskUpdate()
    }
  }

  const handleEditClick = async (taskToEdit) => {
    try {
      const detailedTask = await api.get(`/tasks/${taskToEdit.id}/details`);
      setSelectedTask(detailedTask.data);
      setShowEditDialog(true);
    } catch (error) {
      console.error('Error fetching full task details:', error);
      setSelectedTask(taskToEdit);
      setShowEditDialog(true);
    }
  };

  const handleTaskCreated = () => {
    setShowCreateDialog(false)
    triggerRefresh()
  }

  const handleTaskUpdated = () => {
    setShowEditDialog(false)
    setSelectedTask(null)
    triggerRefresh()
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}`, { 
        task_status: 'completed',
        completed_at: new Date().toISOString()
      })
      triggerRefresh()
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Failed to complete task')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      await api.delete(`/tasks/${taskId}`)
      triggerRefresh()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }

    return (
      <Badge className={`${colors[priority]} text-xs`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    )
  }

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }

    return (
      <Badge className={`${colors[status]} text-xs`}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    )
  }
  
  const formatDate = (dateString, status = 'pending') => {
    if (!dateString) return { formatted: 'N/A', formattedWithTime: 'N/A', isOverdue: false };
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    
    return {
      formatted: date.toLocaleDateString(),
      formattedWithTime: date.toLocaleString(),
      isOverdue: isOverdue && !['completed', 'cancelled'].includes(status)
    }
  }

  const getAssigneeDisplay = (task) => {
    const primaryName = task.assigned_to_name || 'Unknown';
  
    if (task.has_multiple_assignees && task.all_assignees_ids) {
      const allIds = task.all_assignees_ids.split(',');
      const numOthers = allIds.length - 1;
  
      if (numOthers > 0) {
        return `${primaryName} + ${numOthers} others`;
      }
    }
    
    return primaryName;
  }

  const getSubtasksBadge = (task) => {
    const total = parseInt(task.total_subtasks) || 0;
    const completed = parseInt(task.completed_subtasks) || 0;
    
    if (total === 0) return null;
    
    const allCompleted = total === completed;
    const bgColor = allCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${bgColor} text-xs flex items-center gap-1`}>
              <ListTodo className="h-3 w-3" />
              {completed}/{total}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{completed} of {total} subtasks completed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Mobile Card Layout Component
  const MobileTaskCard = ({ task }) => {
    const deadlineInfo = formatDate(task.deadline_date, task.task_status)
    const createdDate = formatDate(task.created_at, task.task_status)
    const isUserAssigned = task.all_assignees_ids?.split(',').includes(user?.id.toString());
    
    return (
      <div className="border rounded-lg p-4 mb-3 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h4 className="font-medium text-sm truncate">{task.task_name}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.task_description}
            </p>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            {getPriorityBadge(task.task_priority)}
            {getStatusBadge(task.task_status)}
            {getSubtasksBadge(task)}
          </div>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{getAssigneeDisplay(task)}</span>
            {task.has_multiple_assignees ? ( <Badge variant="secondary" className="text-xs">Team</Badge>) : null}
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3" />
            <div className="flex flex-col">
              <span className="text-muted-foreground">
                Created: {createdDate.formattedWithTime}
              </span>
              <span className={deadlineInfo.isOverdue ? 'text-red-600' : 'text-muted-foreground'}>
                Due: {deadlineInfo.formattedWithTime}
                {deadlineInfo.isOverdue && (
                  <AlertCircle className="h-3 w-3 inline ml-1" />
                )}
              </span>
            </div>
          </div>
        </div>

        {!inDialog && (
          <div className="pt-2 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                  Actions
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                {task.task_status !== 'completed' && isUserAssigned && (
                  <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}><View className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSelectedTask(task)
                  setShowEditDialog(true)
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteTask(task.id)} 
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    )
  }

  if (!relatedTo) return null

  const entityName = relatedType === 'lead' 
    ? `${relatedTo.first_name} ${relatedTo.last_name}`
    : relatedTo.account_name

  // Content section for mobile and desktop
  const renderContent = () => {
    if (isLoading && existingTasks === null) {
      return <p className="text-center py-4">Loading tasks...</p>
    }
    
    if (tasks.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          No tasks found for this {relatedType}
        </p>
      )
    }

    return (
      <>
        {/* Mobile Layout */}
        <div className="block md:hidden">
          {tasks.map((task) => (
            <MobileTaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3 min-w-[200px]">Task</TableHead>
                  <TableHead className="w-20">Priority & Status</TableHead>
                  <TableHead className="w-32">Assigned To</TableHead>
                  <TableHead className="w-28">Dates</TableHead>
                  {!inDialog && <TableHead className="w-40">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const createdDate = formatDate(task.created_at, task.task_status)
                  const deadlineInfo = formatDate(task.deadline_date, task.task_status)
                  const isUserAssigned = task.all_assignees_ids?.split(',').includes(user?.id.toString()) || task.assigned_to === user?.id;
                  return (
                    <TableRow key={task.id}>
                       <TableCell className="max-w-xs">
                        <div>
                          <div className="font-medium truncate" title={task.task_name}>
                            {task.task_name}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2 break-words" title={task.task_description}>
                            {task.task_description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getPriorityBadge(task.task_priority)} 
                          {getStatusBadge(task.task_status)}
                          {getSubtasksBadge(task)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-32">
                        <div className="text-sm truncate" title={task.all_assignees_names || task.assigned_to_name}>
                          {getAssigneeDisplay(task)}
                          {task.has_multiple_assignees ? ( <Badge variant="secondary" className="ml-2 text-xs">Team</Badge> ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-muted-foreground">Created: {createdDate.formatted}</div>
                          <div className={deadlineInfo.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            Due: {deadlineInfo.formatted}
                            {deadlineInfo.isOverdue && (
                              <AlertCircle className="h-3 w-3 inline ml-1" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {!inDialog && (
                        <TableCell className="text-left">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {task.task_status !== 'completed' && isUserAssigned && (
                                <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Complete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}><View className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(task)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteTask(task.id)} 
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
          </Table>
          </div>
        </div>
      </>
    )
  }

  if (inDialog) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Related Tasks ({tasks.length})
            </h3>
            <p className="text-sm text-muted-foreground max-w-3">
              Tasks related to {relatedType}: {entityName}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div>
          {renderContent()}
        </div>

        <CreateTaskDialog 
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onTaskCreated={handleTaskCreated}
          
          users={users}
          relatedTo={relatedTo}
          relatedType={relatedType}
          projects={projects}
        />

        <EditTaskDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          task={selectedTask}
          onTaskUpdate={handleTaskUpdated}
          
          users={users}
          projects={projects}
        />
      </div>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Related Tasks ({tasks.length})
            </CardTitle>
            <CardDescription>
              Tasks related to {relatedType}: {entityName}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>

      <CreateTaskDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={handleTaskCreated}
        
        users={users}
        relatedTo={relatedTo}
        relatedType={relatedType}
      />

      <EditTaskDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        task={selectedTask}
        onTaskUpdate={handleTaskUpdated}
        
        users={users}
      />
      <OpenTaskDialog open={showViewDialog} onOpenChange={setShowViewDialog} onClose={() => setSelectedTask(null)} users={users} task={selectedTask}  />
    </Card>
  )
}

export default RelatedTasksSection