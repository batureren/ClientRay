// components/dialogs/CreateTaskDialog.jsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';
import api from '@/services/api';

// Helper function for client-side date calculation preview
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

const CreateTaskDialog = ({ 
  open, 
  onOpenChange, 
  onTaskCreated, 
  users, 
  relatedTo = null, 
  relatedType = null, 
  preselectedProjectId = null, 
  disableProjectSelection = false 
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [projects, setProjects] = useState([])
  const [formData, setFormData] = useState({
    task_name: '',
    task_description: '',
    task_priority: 'medium',
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
  })
  
  const [availableAssignees, setAvailableAssignees] = useState(users);
  const [relatedSearch, setRelatedSearch] = useState('');
  const [relatedOptions, setRelatedOptions] = useState({ leads: [], accounts: [] });
  const [selectedRelated, setSelectedRelated] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
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
  if (open) {
    api.get("/projects")
      .then(response => setProjects(response.data))
      .catch(err => console.error("Error fetching projects:", err));
  }
}, [open]);

  useEffect(() => {
    if (open) {
      if (relatedTo && relatedType) {
        const name = relatedType === 'lead' ? `${relatedTo.first_name} ${relatedTo.last_name}` : relatedTo.account_name;
        setSelectedRelated({ id: relatedTo.id, name, type: relatedType });
      } else {
        setSelectedRelated(null);
      }
      if (preselectedProjectId) {
        setFormData(prev => ({ ...prev, project_id: preselectedProjectId.toString() }));
      }
    }
  }, [open, relatedTo, relatedType, preselectedProjectId]);

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
    if (!popoverOpen || relatedTo) return;
    const fetchRelated = async () => {
      if (relatedSearch.length < 1) {
        setRelatedOptions({ leads: [], accounts: [] });
        return;
      }
      try {
        const [leadRes, accountRes] = await Promise.all([
          api.get(`/leads?search=${relatedSearch}&limit=5`),
          api.get(`/accounts?search=${relatedSearch}&limit=5`)
        ]);
        setRelatedOptions({ leads: leadRes.data.data || [], accounts: accountRes.data.data || [] });
      } catch (error) { console.error("Error searching:", error); }
    };
    const debounce = setTimeout(fetchRelated, 300);
    return () => clearTimeout(debounce);
  }, [relatedSearch, popoverOpen, relatedTo]);

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
  
  const resetForm = () => {
     setFormData({ 
        task_name: '', 
        task_description: '', 
        task_priority: 'medium', 
        assigned_to: '', 
        additional_assignees: [], 
        deadline_date: '', 
        deadline_time: '09:00', 
        project_id: preselectedProjectId ? preselectedProjectId.toString() : '__GENERAL__',
        is_recurring: false,
        recurrence_pattern: 'weekly',
        recurrence_interval: 1,
        recurrence_end_date: '',
        recurrence_end_type: 'never'
    });
     setRelatedSearch('');
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task_name.trim() || !formData.assigned_to || !formData.deadline_date) {
      alert('Please fill in all required fields');
      return;
    }
    setIsLoading(true);
    try {
      const taskData = {
        ...formData,
        lead_id: selectedRelated?.type === 'lead' ? selectedRelated.id : null,
        account_id: selectedRelated?.type === 'account' ? selectedRelated.id : null,
        project_id: formData.project_id === '__GENERAL__' ? null : formData.project_id,
        deadline_date: `${formData.deadline_date} ${formData.deadline_time}:00`,
        assigned_to: parseInt(formData.assigned_to),
        additional_assignees: formData.additional_assignees.map(id => parseInt(id)),
        recurrence_end_date: formData.recurrence_end_type === 'date' && formData.recurrence_end_date ? 
          `${formData.recurrence_end_date} 23:59:59` : null
      };
      await api.post('/tasks', taskData);
      onTaskCreated();
      onOpenChange(false); // Close dialog on success
      resetForm();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
    setIsLoading(false);
  }

  const getSelectedProjectName = () => {
    if (formData.project_id === '__GENERAL__') return 'General Task (No Project)';
    const project = projects.find(p => p.id.toString() === formData.project_id);
    return project ? project.project_name : 'Unknown Project';
  };

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
      return `Some recurrence options are disabled due to the close deadline date: ${unavailablePatterns.map(p => p.label).join(', ')}`;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            {relatedTo ? `Create a task for ${relatedType}: ${selectedRelated?.name}` : 
             disableProjectSelection ? `Create a new task for project: ${getSelectedProjectName()}` :
             'Create a new task. Select a project to constrain assignees.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
              <Select 
                value={formData.project_id} 
                onValueChange={(v) => setFormData(p => ({...p, project_id: v}))}
                disabled={disableProjectSelection}
              >
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__GENERAL__">General Task (No Project)</SelectItem>
                  {projects?.map(proj => <SelectItem key={proj.id} value={proj.id.toString()}>{proj.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Related Lead/Account</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild disabled={!!relatedTo}>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selectedRelated ? `${selectedRelated.type.charAt(0).toUpperCase() + selectedRelated.type.slice(1)}: ${selectedRelated.name}` : "Select Lead or Account..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command>
                    <CommandInput placeholder="Search..." value={relatedSearch} onValueChange={setRelatedSearch} />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      {relatedOptions.leads.length > 0 && <CommandGroup heading="Leads">{relatedOptions.leads.map(lead => <CommandItem key={`lead-${lead.id}`} value={`${lead.first_name} ${lead.last_name}`} onSelect={() => { setSelectedRelated({ id: lead.id, name: `${lead.first_name} ${lead.last_name}`, type: 'lead' }); setPopoverOpen(false); }}>{lead.first_name} {lead.last_name}</CommandItem>)}</CommandGroup>}
                      {relatedOptions.accounts.length > 0 && <CommandGroup heading="Accounts">{relatedOptions.accounts.map(acc => <CommandItem key={`acc-${acc.id}`} value={acc.account_name} onSelect={() => { setSelectedRelated({ id: acc.id, name: acc.account_name, type: 'account' }); setPopoverOpen(false); }}>{acc.account_name}</CommandItem>)}</CommandGroup>}
                    </CommandList>
                </Command></PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Primary Assignee *</Label>
              <Select value={formData.assigned_to} onValueChange={(v) => setFormData(p => ({...p, assigned_to: v, additional_assignees: p.additional_assignees.filter(id => id !== v)}))} required>
                <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent>
                  {availableAssignees?.map(user => <SelectItem key={user.id} value={user.id.toString()}>{user.first_name} {user.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task_priority">Priority</Label>
              <Select value={formData.task_priority} onValueChange={(v) => setFormData(p => ({...p, task_priority: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Additional Assignees</Label>
            <div className="border rounded p-2 max-h-24 overflow-y-auto space-y-1">{availableAssignees?.filter(u => u.id.toString() !== formData.assigned_to).map(user => (
              <label key={user.id} className="flex items-center gap-2 text-sm font-normal"><input type="checkbox" value={user.id.toString()} checked={formData.additional_assignees.includes(user.id.toString())} onChange={(e) => { const { value, checked } = e.target; setFormData(p => ({ ...p, additional_assignees: checked ? [...p.additional_assignees, value] : p.additional_assignees.filter(id => id !== value) }))}} />{user.first_name} {user.last_name}</label>
            ))}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline_date">
                {formData.is_recurring ? 'First Deadline Date *' : 'Deadline Date *'}
              </Label>
              <Input 
                id="deadline_date" 
                type="date" 
                value={formData.deadline_date} 
                onChange={(e) => setFormData(p => ({ ...p, deadline_date: e.target.value }))} 
                required 
                min={new Date().toISOString().split('T')[0]} 
              />
              {formData.is_recurring && (
                <p className="text-xs text-muted-foreground mt-1">
                  This is the due date for the first task. Future tasks will be scheduled based on this date.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline_time">Deadline Time</Label>
              <Input id="deadline_time" type="time" value={formData.deadline_time} onChange={(e) => setFormData(p => ({ ...p, deadline_time: e.target.value }))} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Creating...' : 'Create Task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTaskDialog;