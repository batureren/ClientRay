// components/tabs/TasksTab.jsx
import { useState, useEffect, Fragment } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Plus, MoreHorizontal, CheckCircle, AlertCircle, User, Building, Users, Edit, Trash2, Calendar, FolderKanban, View, Search, CalendarIcon, Repeat, ChevronLeft, ChevronRight, Loader2, ListTodo } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import CreateTaskDialog from '../dialogs/CreateTaskDialog'
import EditTaskDialog from '../dialogs/EditTaskDialog'
import OpenTaskDialog from '../dialogs/OpenTaskDialog'
import ManageRecurringTasksDialog from '../dialogs/ManageRecurringTasksDialog'
import api from '@/services/api';

const TasksTab = ({ user, users, onTaskUpdate, viewTask }) => {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [projectTree, setProjectTree] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterProject, setFilterProject] = useState('all');
  
  // Date range picker state
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Build project tree structure
  const buildProjectTree = (projects) => {
    const projectMap = new Map();
    const rootProjects = [];

    projects.forEach(project => {
      projectMap.set(project.id, { ...project, children: [] });
    });

    projects.forEach(project => {
      if (project.parent_project_id) {
        const parent = projectMap.get(project.parent_project_id);
        if (parent) {
          parent.children.push(projectMap.get(project.id));
        }
      } else {
        rootProjects.push(projectMap.get(project.id));
      }
    });

    return rootProjects;
  };

  const getDateRange = () => {
    const today = new Date();
    const formatDateForAPI = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (dateFilter) {
      case 'today': {
        const todayStr = formatDateForAPI(today);
        return { startDate: todayStr, endDate: todayStr };
      }
      case 'weekly': {
        const dayOfWeek = today.getDay(); 
        const sundayStart = new Date(today);
        sundayStart.setDate(today.getDate() - dayOfWeek);
        const saturdayEnd = new Date(sundayStart);
        saturdayEnd.setDate(sundayStart.getDate() + 6);
        return {
          startDate: formatDateForAPI(sundayStart),
          endDate: formatDateForAPI(saturdayEnd),
        };
      }
      case 'monthly': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          startDate: formatDateForAPI(monthStart),
          endDate: formatDateForAPI(monthEnd),
        };
      }
      case 'custom':
        return customDateRange;
      default:
        return { startDate: '', endDate: '' };
    }
  };

  const fetchTasksAndProjects = async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      // Add pagination parameters
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      
      if (searchTerm) queryParams.append('search', searchTerm);
      
      const dateRange = getDateRange();
      if (dateRange.startDate && dateRange.endDate) {
        queryParams.append('startDate', dateRange.startDate);
        queryParams.append('endDate', dateRange.endDate);
      } else if (dateFilter !== 'all' && dateFilter !== 'custom') {
        queryParams.append('dateFilter', dateFilter);
      }
      
      if (filterProject !== 'all') queryParams.append('projectId', filterProject);
      if (filterStatus !== 'all') queryParams.append('status', filterStatus);
      if (filterAssignee !== 'all') queryParams.append('assigneeId', filterAssignee);

      const [tasksResponse, projectsData] = await Promise.all([
        api.get(`/tasks?${queryParams.toString()}`),
        api.get('/projects')
      ]);
      
      // Handle paginated response
      if (tasksResponse.data.data && tasksResponse.data.pagination) {
        setTasks(tasksResponse.data.data);
        setTotalItems(tasksResponse.data.pagination.total);
        setTotalPages(tasksResponse.data.pagination.totalPages);
        setCurrentPage(tasksResponse.data.pagination.currentPage);
      } else {
        // Fallback for non-paginated response
        setTasks(Array.isArray(tasksResponse.data) ? tasksResponse.data : []);
        setTotalItems(Array.isArray(tasksResponse.data) ? tasksResponse.data.length : 0);
        setTotalPages(1);
      }
      
      setProjects(projectsData.data);
      const tree = buildProjectTree(projectsData.data);
      setProjectTree(tree);
    } catch (error) {
      console.error('Error fetching data:', error);
      setTasks([]);
      setTotalItems(0);
      setTotalPages(0);
    }
    setLoading(false);
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setCurrentPage(1);
      fetchTasksAndProjects(1, itemsPerPage);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, dateFilter, filterProject, filterStatus, filterAssignee, customDateRange]);

  useEffect(() => {
    if (viewTask) {
      setSelectedTask(viewTask)
      setShowViewDialog(true)
    }
  }, [viewTask])

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchTasksAndProjects(page, itemsPerPage);
  };

  const handleItemsPerPageChange = (value) => {
    const newLimit = parseInt(value);
    setItemsPerPage(newLimit);
    setCurrentPage(1);
    fetchTasksAndProjects(1, newLimit);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchTasksAndProjects(newPage, itemsPerPage);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchTasksAndProjects(newPage, itemsPerPage);
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

  const handleTaskCreated = () => {
    setShowCreateDialog(false)
    handleTaskUpdated()
  }

  const handleTaskUpdated = () => {
    setShowEditDialog(false)
    setSelectedTask(null)
    fetchTasksAndProjects(currentPage, itemsPerPage)
    onTaskUpdate()
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}`, { task_status: 'completed', completed_at: new Date().toISOString() });
      handleTaskUpdated();
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      handleTaskUpdated();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleDateFilterChange = (newFilter) => {
    setDateFilter(newFilter);
    if (newFilter !== 'custom') {
      setShowDatePicker(false);
    }
  };

  const handleCustomDateApply = () => {
    if (customDateRange.startDate && customDateRange.endDate) {
      setDateFilter('custom');
      setShowDatePicker(false);
    }
  };

  const clearCustomDates = () => {
    setCustomDateRange({ startDate: '', endDate: '' });
    setDateFilter('all');
    setShowDatePicker(false);
  };

  const getPriorityBadge = (priority) => {
    const colors = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };
    return <Badge className={colors[priority]}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = { pending: 'bg-gray-100 text-gray-800', in_progress: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
    return <Badge className={colors[status]}>{status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}</Badge>;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const isOverdue = date < new Date() && date.setHours(0,0,0,0) !== new Date().setHours(0,0,0,0);
    return { formatted: date.toLocaleString(), isOverdue };
  };

  const getRecurrenceTooltip = (task) => {
    if (!task.is_recurring) return '';
    let text = `Repeats ${task.recurrence_pattern}`;
    if (task.recurrence_interval > 1) {
        text += ` every ${task.recurrence_interval} interval(s)`;
    }
    if (task.recurrence_end_date) {
        text += ` until ${new Date(task.recurrence_end_date).toLocaleDateString()}`;
    }
    return text;
  }

  const getTaskRelationDisplay = (task) => {
    const iconStyle = "h-4 w-4 shrink-0";
    let mainDisplay, secondaryDisplay;

    if (task.project_name) {
      mainDisplay = (
        <div className="flex items-center gap-2 font-medium text-purple-700">
          <FolderKanban className={iconStyle} />
          <span className="truncate" title={task.project_name}>{task.project_name}</span>
        </div>
      );
      if (task.lead_name) secondaryDisplay = `Lead: ${task.lead_name}`;
      else if (task.account_name) secondaryDisplay = `Account: ${task.account_name}`;
    } else if (task.lead_name) {
      mainDisplay = <div className="flex items-center gap-2"><Users className={`${iconStyle} text-blue-600`} /><span>Lead: {task.lead_name}</span></div>;
    } else if (task.account_name) {
      mainDisplay = <div className="flex items-center gap-2"><Building className={`${iconStyle} text-green-600`} /><span>Account: {task.account_name}</span></div>;
    } else {
      mainDisplay = <div className="flex items-center gap-2"><User className={`${iconStyle} text-gray-600`} /><span>General Task</span></div>;
    }

    return (
      <div className="flex flex-col">
        {mainDisplay}
        {secondaryDisplay && <div className="text-xs text-muted-foreground ml-6 truncate" title={secondaryDisplay}>{secondaryDisplay}</div>}
      </div>
    );
  };
  
  const getAssigneeDisplay = (task) => {
    const primaryUser = users?.find(u => u.id === task.assigned_to);
    const primaryName = primaryUser ? `${primaryUser.first_name} ${primaryUser.last_name}` : 'Unknown';
    if (task.has_multiple_assignees && task.all_assignees_ids) {
      const numOthers = task.all_assignees_ids.split(',').length - 1;
      if (numOthers > 0) return `${primaryName} + ${numOthers} others`;
    }
    return primaryName;
  };

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

  const MobileTaskCard = ({ task }) => {
    const deadlineInfo = formatDate(task.deadline_date);
    const isOverdue = deadlineInfo.isOverdue && !['completed', 'cancelled'].includes(task.task_status);
    return (
      <Card className="mb-4">
        <CardHeader className="pb-4 overflow-hidden">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-semibold leading-tight truncate pr-2">
                {task.is_recurring ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Repeat className="h-4 w-4 mr-2 inline-block text-blue-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getRecurrenceTooltip(task)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ): null}
                {task.task_name}
              </CardTitle>
              <div className="flex flex-col gap-1 items-end flex-shrink-0">
                {getPriorityBadge(task.task_priority)}
                {getStatusBadge(task.task_status)}
                {getSubtasksBadge(task)}
              </div>
            </div>
            <CardDescription className="text-sm line-clamp-2">{task.task_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">{getTaskRelationDisplay(task)}</div>
          <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> <span>{getAssigneeDisplay(task)}</span></div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span className={isOverdue ? 'text-red-600' : ''}>
              Due: {deadlineInfo.formatted} {isOverdue && <AlertCircle className="h-4 w-4 inline ml-1" />}
            </span>
          </div>
        </CardContent>
         <div className="p-4 pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full">Actions <MoreHorizontal className="h-4 w-4 ml-2" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}><View className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                {task.task_status !== 'completed' && <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}><CheckCircle className="h-4 w-4 mr-2" />Complete</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowEditDialog(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </Card>
    );
  };
  
  const myTasks = tasks.filter(task => {
    if (!user || !task.all_assignees_ids) return task.assigned_to === user?.id;
    return task.all_assignees_ids.split(',').map(id => parseInt(id, 10)).includes(user.id);
  });

  const renderTasksContent = (tasksList, isMyTasks = false) => {
    if (tasksList.length === 0) return <p className="text-muted-foreground text-center py-8">No tasks found.</p>;
    return (
      <>
        <div className="block md:hidden">{tasksList.map((task) => <MobileTaskCard key={task.id} task={task} />)}</div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Priority & Status</TableHead>
                {!isMyTasks && <TableHead>Assigned To</TableHead>}
                <TableHead>Deadline</TableHead>
                <TableHead>Related To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksList.map((task) => {
                const deadlineInfo = formatDate(task.deadline_date);
                const isOverdue = deadlineInfo.isOverdue && !['completed', 'cancelled'].includes(task.task_status);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="max-w-xs">
                      <div className="font-medium truncate flex items-center">
                        {task.is_recurring ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Repeat className="h-4 w-4 mr-2 text-blue-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{getRecurrenceTooltip(task)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ): null}
                        {task.task_name}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{task.task_description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getPriorityBadge(task.task_priority)}
                        {getStatusBadge(task.task_status)}
                        {getSubtasksBadge(task)}
                      </div>
                    </TableCell>
                    {!isMyTasks && <TableCell>{getAssigneeDisplay(task)}</TableCell>}
                    <TableCell className={isOverdue ? 'text-red-600' : ''}>{deadlineInfo.formatted}{isOverdue && <AlertCircle className="h-4 w-4 inline ml-1" />}</TableCell>
                    <TableCell>{getTaskRelationDisplay(task)}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}><View className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                            {task.task_status !== 'completed' && <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}><CheckCircle className="h-4 w-4 mr-2" />Complete</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => { setSelectedTask(task); setShowEditDialog(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };
  
  const renderProjectOptions = (projects, level = 0) => {
    return projects.map(project => (
      <Fragment key={project.id}>
        <SelectItem value={project.id.toString()} style={{ paddingLeft: `${level * 1.25}rem` }}>
          <div className="flex items-center">
            {level > 0 && <span className="text-muted-foreground mr-2">└─</span>}
            <span>{project.project_name}</span>
            <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
              ({project.completed_tasks}/{project.total_tasks})
            </span>
          </div>
        </SelectItem>
        {project.children && project.children.length > 0 && renderProjectOptions(project.children, level + 1)}
      </Fragment>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-2xl font-semibold">Tasks Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRecurringDialog(true)}>
            <Repeat className="h-4 w-4 mr-2" />
            Manage Recurring
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
             <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-full sm:w-auto" />
             </div>
             <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter by assignee" /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Assignees</SelectItem>
                   {users && users.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.first_name} {u.last_name}
                    </SelectItem>
                   ))}
                </SelectContent>
             </Select>
             <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter by project" /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Projects</SelectItem>
                   {renderProjectOptions(projectTree)}
                </SelectContent>
             </Select>
             <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
             </Select>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 rounded-md border p-1 bg-muted">
                <Button 
                  size="sm" 
                  variant={dateFilter === 'all' ? '' : 'ghost'} 
                  className={`${dateFilter === 'all' ? 'border border-white' : ''}`} 
                  onClick={() => handleDateFilterChange('all')}
                >
                  All
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'today' ? '' : 'ghost'} 
                  className={`${dateFilter === 'today' ? 'border border-white' : ''}`} 
                  onClick={() => handleDateFilterChange('today')}
                >
                  Today
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'weekly' ? '' : 'ghost'} 
                  className={`${dateFilter === 'weekly' ? 'border border-white' : ''}`} 
                  onClick={() => handleDateFilterChange('weekly')}
                >
                  Week
                </Button>
                <Button 
                  size="sm" 
                  variant={dateFilter === 'monthly' ? '' : 'ghost'} 
                  className={`${dateFilter === 'monthly' ? 'border border-white' : ''}`} 
                  onClick={() => handleDateFilterChange('monthly')}
                >
                  Month
                </Button>
            </div>
            
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button 
                  variant={dateFilter === 'custom' ? 'default' : 'outline'} 
                  size="sm"
                  className={`gap-2 ${dateFilter === 'custom' ? 'border-primary' : ''}`}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dateFilter === 'custom' && customDateRange.startDate && customDateRange.endDate 
                    ? `${new Date(customDateRange.startDate).toLocaleDateString()} - ${new Date(customDateRange.endDate).toLocaleDateString()}`
                    : 'Custom Range'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={customDateRange.startDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input
                      type="date"
                      value={customDateRange.endDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearCustomDates}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCustomDateApply}
                      disabled={!customDateRange.startDate || !customDateRange.endDate}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {loading ? (
                  <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
                ) : (
                  `Showing ${totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} tasks`
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Per page</label>
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
          <Accordion type="multiple" collapsible className="w-full" defaultValue={["my-tasks"]}>
            <AccordionItem value="my-tasks" className="border-none">
                <AccordionTrigger className="p-6 hover:no-underline border-b">
                  <div className="text-left">
                    <CardTitle>My Tasks ({myTasks.length})</CardTitle>
                    <CardDescription className="mt-1">Tasks assigned directly to you or your team.</CardDescription>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    {renderTasksContent(myTasks, true)}
                  </CardContent>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="all-tasks" className="border-none">
                <AccordionTrigger className="p-6 hover:no-underline">
                  <div className="text-left">
                    <CardTitle>All Tasks ({tasks.length})</CardTitle>
                    <CardDescription className="mt-1">All tasks in the system based on your filters.</CardDescription>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    {renderTasksContent(tasks, false)}
                  </CardContent>
                </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
      
      <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onTaskCreated={handleTaskCreated}  users={users} />
      <EditTaskDialog open={showEditDialog} onOpenChange={setShowEditDialog} task={selectedTask} onTaskUpdate={handleTaskUpdated}  users={users} />
      <OpenTaskDialog open={showViewDialog} onOpenChange={setShowViewDialog} onClose={() => setSelectedTask(null)} users={users} task={selectedTask}  />
      <ManageRecurringTasksDialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}  user={user} />
    </div>
  )
}
export default TasksTab