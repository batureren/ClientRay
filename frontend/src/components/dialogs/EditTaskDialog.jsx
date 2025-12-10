// components/dialogs/EditTaskDialog.jsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import api from '@/services/api';

const calculateNextOccurrence = (currentDate, pattern, interval = 1) => {
  let date;
  if (typeof currentDate === 'string' && currentDate.includes('-')) {
    const [year, month, day] = currentDate.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(currentDate);
  }
  
  const originalMonth = date.getMonth();

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekdays':
      date.setDate(date.getDate() + 1);
      while (date.getDay() === 0 || date.getDay() === 6) { // 0 = Sunday, 6 = Saturday
        date.setDate(date.getDate() + 1);
      }
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval));
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      if (date.getMonth() !== (originalMonth + interval) % 12) {
        date.setDate(0); 
      }
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + (3 * interval));
      if (date.getMonth() !== (originalMonth + (3 * interval)) % 12) {
        date.setDate(0);
      }
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      return null;
  }
  return date;
};

const EditTaskDialog = ({ open, onOpenChange, task, onTaskUpdate, users }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState({
    task_name: '',
    task_description: '',
    task_priority: 'medium',
    task_status: 'pending',
    assigned_to: '',
    additional_assignees: [],
    deadline_date: '',
    deadline_time: '09:00',
    project_id: '__GENERAL__',
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_interval: 1,
    recurrence_end_date: '',
    recurrence_end_type: 'never'
  });
  
  const [availableAssignees, setAvailableAssignees] = useState(users);
  const [upcomingDates, setUpcomingDates] = useState([]);
  
  const recurrencePatterns = [
    { value: 'daily', label: 'Every day' },
    { value: 'weekdays', label: 'Every weekday (Mon-Fri)' },
    { value: 'weekly', label: 'Every week' },
    { value: 'biweekly', label: 'Every other week' },
    { value: 'monthly', label: 'Every month' },
    { value: 'quarterly', label: 'Every 3 months' },
    { value: 'yearly', label: 'Every year' }
  ];

  const getAvailableRecurrencePatterns = () => {
    if (!formData.deadline_date) return recurrencePatterns;
    const deadlineDate = new Date(formData.deadline_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    return recurrencePatterns.filter(pattern => {
      const intervalMultiplier = formData.recurrence_interval || 1;
      if (daysUntilDeadline < 0) return true; 
      switch (pattern.value) {
        case 'daily': case 'weekdays': return true;
        case 'weekly': return daysUntilDeadline >= (7 * intervalMultiplier);
        case 'biweekly': return daysUntilDeadline >= 14;
        case 'monthly': return daysUntilDeadline >= (30 * intervalMultiplier);
        case 'quarterly': return daysUntilDeadline >= (90 * intervalMultiplier);
        case 'yearly': return daysUntilDeadline >= (365 * intervalMultiplier);
        default: return true;
      }
    });
  };

  useEffect(() => {
    if (open){
      api.get("/projects").then(response => setProjects(response.data)).catch(err => console.error("Error fetching projects:", err));
    }
  }, [open]);
  
  useEffect(() => {
    if (task) {
      const deadline = new Date(task.deadline_date);
      const dateString = deadline.toISOString().split('T')[0];
      const timeString = deadline.toTimeString().slice(0, 5);
      
      const primaryAssigneeId = task.assigned_to?.toString() || '';
      const additionalIds = task.additional_assignees?.map(id => id.toString()) || [];

      let recurrenceEndDate = '';
      if (task.recurrence_end_date) {
        recurrenceEndDate = new Date(task.recurrence_end_date).toISOString().split('T')[0];
      }

      setFormData({
        task_name: task.task_name || '',
        task_description: task.task_description || '',
        task_priority: task.task_priority || 'medium',
        task_status: task.task_status || 'pending',
        assigned_to: primaryAssigneeId,
        additional_assignees: additionalIds,
        deadline_date: dateString,
        deadline_time: timeString,
        project_id: task.project_id?.toString() || '__GENERAL__',
        is_recurring: task.is_recurring || false,
        recurrence_pattern: task.recurrence_pattern || 'weekly',
        recurrence_interval: task.recurrence_interval || 1,
        recurrence_end_date: recurrenceEndDate,
        recurrence_end_type: task.recurrence_end_date ? 'date' : 'never'
      });
    }
  }, [task]);

useEffect(() => {
  if (open && formData.project_id && formData.project_id !== '__GENERAL__') {
    api.get(`/projects/${formData.project_id}/details`)
      .then(response => {
        const projectDetails = response.data;
        const memberIds = new Set(projectDetails.members.map(m => m.id));
        const filteredUsers = users.filter(u => memberIds.has(u.id));
        setAvailableAssignees(filteredUsers);
        if (formData.assigned_to && !memberIds.has(parseInt(formData.assigned_to))) {
          setFormData(prev => ({ ...prev, assigned_to: '', additional_assignees: [] }));
        }
      })
      .catch(err => console.error("Error fetching project details:", err));
  } else {
    setAvailableAssignees(users);
  }
}, [formData.project_id, users, open]);

  useEffect(() => {
    const availablePatterns = getAvailableRecurrencePatterns();
    const isCurrentPatternAvailable = availablePatterns.some(p => p.value === formData.recurrence_pattern);
    if (formData.is_recurring && !isCurrentPatternAvailable && availablePatterns.length > 0) {
      setFormData(prev => ({ ...prev, recurrence_pattern: availablePatterns[0].value }));
    }
  }, [formData.deadline_date, formData.recurrence_interval, formData.is_recurring]);
  
  useEffect(() => {
    if (!formData.is_recurring || !formData.deadline_date) {
      setUpcomingDates([]);
      return;
    }
    const dates = [];
    let currentDate = new Date(formData.deadline_date);
    for (let i = 0; i < 3; i++) {
      const nextDate = calculateNextOccurrence(currentDate, formData.recurrence_pattern, formData.recurrence_interval);
      if (!nextDate) break;
      if (formData.recurrence_end_date && nextDate > new Date(formData.recurrence_end_date)) break;
      dates.push(nextDate);
      currentDate = nextDate;
    }
    setUpcomingDates(dates);
  }, [formData.is_recurring, formData.deadline_date, formData.recurrence_pattern, formData.recurrence_interval, formData.recurrence_end_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { task_name, assigned_to, deadline_date } = formData;
    if (!task_name.trim() || !assigned_to || !deadline_date) {
      alert('Please fill in all required fields');
      return;
    }
    setIsLoading(true);
    try {
      const taskData = {
        ...formData,
        project_id: formData.project_id === '__GENERAL__' ? null : formData.project_id,
        assigned_to: parseInt(formData.assigned_to),
        additional_assignees: formData.additional_assignees.map(id => parseInt(id)),
        deadline_date: `${formData.deadline_date} ${formData.deadline_time}:00`,
        completed_at: formData.task_status === 'completed' ? new Date().toISOString() : null,
        recurrence_end_date: formData.recurrence_end_type === 'date' && formData.recurrence_end_date ? 
          `${formData.recurrence_end_date} 23:59:59` : null
      };
      await api.put(`/tasks/${task.id}`, taskData);
      onOpenChange(false);
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
    setIsLoading(false);
  }

  const handleStatusChange = (value) => {
    setFormData(prev => ({ ...prev, task_status: value }))
  }

  const getRecurrenceDescription = () => {
    if (!formData.is_recurring) return null;
    const pattern = recurrencePatterns.find(p => p.value === formData.recurrence_pattern);
    let description = pattern?.label || 'Custom pattern';
    if (formData.recurrence_interval > 1 && !['weekdays'].includes(formData.recurrence_pattern)) {
      description = description.replace('Every', `Every ${formData.recurrence_interval}`);
    }
    if (formData.recurrence_end_type === 'date' && formData.recurrence_end_date) {
      description += ` until ${formData.recurrence_end_date}`;
    }
    return description;
  };

  const getRecurrenceWarning = () => {
    if (!formData.is_recurring || !formData.deadline_date) return null;
    const availablePatterns = getAvailableRecurrencePatterns();
    const allPatterns = recurrencePatterns;
    if (availablePatterns.length < allPatterns.length) {
      const unavailablePatterns = allPatterns.filter(p => !availablePatterns.some(ap => ap.value === p.value));
      return `Some recurrence options may be unavailable due to the selected deadline: ${unavailablePatterns.map(p => p.label).join(', ')}`;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            {task && `Editing task: ${task.task_name}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task_name">Task Name *</Label>
            <Input id="task_name" value={formData.task_name} onChange={(e) => setFormData(p => ({ ...p, task_name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task_description">Description</Label>
            <Textarea id="task_description" value={formData.task_description} onChange={(e) => setFormData(p => ({ ...p, task_description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_id">Project</Label>
              <Select value={formData.project_id} onValueChange={(v) => setFormData(p => ({...p, project_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__GENERAL__">General Task (No Project)</SelectItem>
                  {projects?.map(proj => <SelectItem key={proj.id} value={proj.id.toString()}>{proj.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task_priority">Priority</Label>
              <Select value={formData.task_priority} onValueChange={(value) => setFormData(prev => ({ ...prev, task_priority: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-green-600">Low</SelectItem>
                  <SelectItem value="medium" className="text-yellow-600">Medium</SelectItem>
                  <SelectItem value="high" className="text-orange-600">High</SelectItem>
                  <SelectItem value="urgent" className="text-red-600">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task_status">Status</Label>
            <Select value={formData.task_status} onValueChange={handleStatusChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Primary Assignee *</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({...prev, assigned_to: value, additional_assignees: prev.additional_assignees.filter(id => id !== value)}))}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {availableAssignees?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>{user.first_name} {user.last_name} ({user.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional Assignees</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">{availableAssignees?.filter(user => user.id.toString() !== formData.assigned_to).map((user) => (
                <label key={user.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={user.id} checked={formData.additional_assignees.includes(user.id.toString())} onChange={(e) => { const value = e.target.value; setFormData(prev => { const list = Array.isArray(prev.additional_assignees) ? prev.additional_assignees : []; return {...prev, additional_assignees: e.target.checked ? [...list, value] : list.filter(id => id !== value)}})}} />
                  {user.first_name} {user.last_name} ({user.role})
                </label>
              ))}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline_date">
                {formData.is_recurring ? 'First Deadline *' : 'Deadline *'}
              </Label>
              <Input id="deadline_date" type="date" value={formData.deadline_date} onChange={(e) => setFormData(prev => ({ ...prev, deadline_date: e.target.value }))} required />
              {formData.is_recurring && (
                <p className="text-xs text-muted-foreground mt-1">This date is the anchor for the recurring series.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline_time">Deadline Time</Label>
              <Input id="deadline_time" type="time" value={formData.deadline_time} onChange={(e) => setFormData(prev => ({ ...prev, deadline_time: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="is_recurring" checked={formData.is_recurring} onChange={(e) => setFormData(p => ({ ...p, is_recurring: e.target.checked }))} className="rounded border-gray-300" />
                <Label htmlFor="is_recurring" className="text-sm font-medium">Make this a recurring task</Label>
              </div>
              {getRecurrenceDescription() && <p className="text-sm text-gray-600">{getRecurrenceDescription()}</p>}
              {getRecurrenceWarning() && <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded">{getRecurrenceWarning()}</p>}
            </div>
            {formData.is_recurring && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div className="space-y-2">
                  <Label htmlFor="recurrence_pattern">Repeat Pattern</Label>
                  <Select value={formData.recurrence_pattern} onValueChange={(v) => setFormData(p => ({...p, recurrence_pattern: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getAvailableRecurrencePatterns().map(pattern => <SelectItem key={pattern.value} value={pattern.value}>{pattern.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {!['daily', 'weekdays'].includes(formData.recurrence_pattern) && (
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_interval">Repeat Every</Label>
                    <div className="flex items-center space-x-2">
                      <Input id="recurrence_interval" type="number" min="1" max="12" value={formData.recurrence_interval} onChange={(e) => setFormData(p => ({ ...p, recurrence_interval: parseInt(e.target.value) || 1 }))} className="w-20" />
                      <span className="text-sm text-gray-600">{formData.recurrence_pattern === 'weekly' ? 'week(s)' : formData.recurrence_pattern === 'monthly' ? 'month(s)' : formData.recurrence_pattern === 'yearly' ? 'year(s)' : 'interval(s)'}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>End Recurrence</Label>
                  <Select value={formData.recurrence_end_type} onValueChange={(v) => setFormData(p => ({...p, recurrence_end_type: v, recurrence_end_date: v !== 'date' ? '' : p.recurrence_end_date}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="date">On specific date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.recurrence_end_type === 'date' && (
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_end_date">End Date</Label>
                    <Input id="recurrence_end_date" type="date" value={formData.recurrence_end_date} onChange={(e) => setFormData(p => ({ ...p, recurrence_end_date: e.target.value }))} min={formData.deadline_date} />
                  </div>
                )}
                {upcomingDates.length > 0 && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Upcoming Dates Preview:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      {upcomingDates.map((date, index) => (
                        <li key={index}>
                          {date.toLocaleDateString(undefined, {
                            weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
          {task && (
            <div className="bg-muted p-3 rounded text-sm">
              <div className="flex justify-between items-center">
                <span>Created by: {task.created_by_name}</span>
                <span>Created: {new Date(task.created_at).toLocaleString()}</span>
              </div>
              {task.completed_at && (
                <div className="mt-1 text-green-600">
                  Completed: {new Date(task.completed_at).toLocaleString()}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Updating...' : 'Update Task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskDialog;