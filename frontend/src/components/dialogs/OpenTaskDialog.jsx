// components/dialogs/OpenTaskDialog.jsx
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import EditTaskDialog from './EditTaskDialog.jsx';
import {
  User,
  Calendar,
  Building,
  Users,
  MessageCircle,
  Send,
  AlertCircle,
  AtSign,
  Eye,
  Clock,
  CheckCircle2,
  Repeat,
  Pencil,
  Plus,
  X,
  ListTodo,
} from 'lucide-react';
import api from '@/services/api';

const OpenTaskDialog = ({
  open,
  onOpenChange,
  task,
  users,
  onClose,
}) => {
  const [taskData, setTaskData] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const textareaRef = useRef(null);
  const subtaskInputRef = useRef(null);

  const fetchTaskDetails = async () => {
    if (!task?.id || !open) return;

    setIsLoading(true);
    try {
      const [taskDetails, taskComments, taskAssignees, taskSubtasks] = await Promise.all([
        api.get(`/tasks/${task.id}/details`),
        api.get(`/tasks/${task.id}/comments`),
        api.get(`/tasks/${task.id}/assignees`),
        api.get(`/tasks/${task.id}/subtasks`),
      ]);

      setTaskData(taskDetails.data);
      setComments(taskComments.data);
      setAssignees(taskAssignees.data);
      setSubtasks(taskSubtasks.data);
    } catch (error) {
      console.error('Error fetching task details:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [task?.id, open]);

  useEffect(() => {
    if (!open) {
      setTaskData(null);
      setComments([]);
      setNewComment('');
      setAssignees([]);
      setSubtasks([]);
      setNewSubtask('');
      setIsAddingSubtask(false);
      setMentionSuggestions([]);
      setShowMentions(false);
      setCursorPosition(0);
      setIsEditDialogOpen(false);
    }
  }, [open]);
  
  const handleTaskUpdate = () => {
    setIsEditDialogOpen(false);
    fetchTaskDetails();
  };

  const handleDialogChange = (newOpen) => {
    onOpenChange(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !taskData) return;

    try {
      const mentionPattern = /@(\w+)/g;
      const mentions = [];
      let match;
      while ((match = mentionPattern.exec(newComment)) !== null) {
        const mentionedUser = users?.find(
          (u) => u.username === match[1] || `${u.first_name}${u.last_name}`.toLowerCase() === match[1].toLowerCase()
        );
        if (mentionedUser && !mentions.includes(mentionedUser.id)) {
          mentions.push(mentionedUser.id);
        }
      }

      await api.post(`/tasks/${taskData.id}/comments`, {
        content: newComment,
        mentions: mentions,
      });

      setNewComment('');
      setShowMentions(false);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleCommentChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewComment(value);
    setCursorPosition(position);

    const beforeCursor = value.substring(0, position);
    const atMatch = beforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const searchTerm = atMatch[1].toLowerCase();
      const filtered = users
        ?.filter((u) => {
          const username = u.username?.toLowerCase() || '';
          const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
          return username.startsWith(searchTerm) || fullName.startsWith(searchTerm);
        })
        .slice(0, 5) || [];
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
      setMentionSuggestions([]);
    }
  };

  const insertMention = (selectedUser) => {
    const beforeCursor = newComment.substring(0, cursorPosition);
    const afterCursor = newComment.substring(cursorPosition);
    const beforeAt = beforeCursor.substring(0, beforeCursor.lastIndexOf('@'));
    const mention = `@${selectedUser.username || selectedUser.first_name}`;

    const newValue = `${beforeAt}${mention} ${afterCursor}`;
    setNewComment(newValue);
    setShowMentions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPosition = beforeAt.length + mention.length + 1;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !taskData) return;

    try {
      await api.post(`/tasks/${taskData.id}/subtasks`, {
        title: newSubtask,
      });

      setNewSubtask('');
      setIsAddingSubtask(false);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    if (!taskData) return;

    try {
      await api.put(`/tasks/${taskData.id}/subtasks/${subtaskId}`, {
        is_completed: !currentStatus,
      });

      fetchTaskDetails();
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!taskData) return;

    try {
      await api.delete(`/tasks/${taskData.id}/subtasks/${subtaskId}`);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  useEffect(() => {
    if (isAddingSubtask && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [isAddingSubtask]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  const getRecurrenceDescription = (task) => {
    if (!task || !task.is_recurring) return null;
  
    const patterns = {
      daily: 'day', weekdays: 'weekday', weekly: 'week',
      biweekly: '2 weeks', monthly: 'month', quarterly: 'quarter', yearly: 'year',
    };
  
    const patternLabel = patterns[task.recurrence_pattern];
    if (!patternLabel) return 'Custom recurrence';
  
    if (task.recurrence_pattern === 'biweekly') return 'Repeats every 2 weeks';
    if (task.recurrence_pattern === 'weekdays') return 'Repeats every weekday';
  
    const interval = task.recurrence_interval || 1;
    const plural = interval > 1 ? 's' : '';
    
    return `Repeats every ${interval > 1 ? interval + ' ' : ''}${patternLabel}${plural}`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 hover:bg-green-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'pending': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 hover:bg-red-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const isOverdue =
    taskData &&
    new Date(taskData.deadline_date) < new Date() &&
    !['completed', 'cancelled'].includes(taskData.task_status);

  const contentHeight = 'h-[calc(85vh-80px)]';

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="!max-w-none !w-[95vw] sm:!w-[90vw] lg:!w-[85vw] xl:!w-[80vw] max-h-[85vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Task Details
              </DialogTitle>
              {taskData && (
                <Button variant="outline" size="sm" className="!mr-5" onClick={() => setIsEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Task
                </Button>
              )}
            </div>
            <DialogDescription>
              Manage task information and communication.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className={`flex justify-center items-center ${contentHeight}`}>
              <div className="text-muted-foreground">Loading task details...</div>
            </div>
          ) : taskData ? (
            <div className={`${contentHeight} overflow-y-auto lg:overflow-y-hidden`}>
              <div className="lg:flex lg:flex-row lg:h-full">
                <ScrollArea className="lg:flex-1 lg:h-full">
                  <div className="p-6 space-y-8">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-semibold break-words">
                          {taskData.task_name}
                        </h3>
                        <p className="text-muted-foreground mt-2 break-words whitespace-pre-wrap">
                          {taskData.task_description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4 border-t">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                            <User className="h-4 w-4" />
                            Created By
                          </span>
                          <span className="text-sm">
                            {taskData.created_by_name || 'Unknown'}
                          </span>
                        </div>

                        {(taskData.lead_name || taskData.account_name) && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                              {taskData.lead_name ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                              Related To
                            </span>
                            <span className="text-sm">
                              {taskData.lead_name ? `Lead: ${taskData.lead_name}` : `Account: ${taskData.account_name}`}
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-sm font-medium text-muted-foreground mb-1 block">
                            Priority
                          </span>
                          <Badge className={getPriorityColor(taskData.task_priority)}>
                            {taskData.task_priority?.charAt(0).toUpperCase() + taskData.task_priority?.slice(1)}
                          </Badge>
                        </div>

                        <div>
                          <span className="text-sm font-medium text-muted-foreground mb-1 block">
                            Status
                          </span>
                          <Badge className={getStatusColor(taskData.task_status)}>
                            {taskData.task_status?.replace('_', ' ').charAt(0).toUpperCase() + taskData.task_status?.replace('_', ' ').slice(1)}
                          </Badge>
                          {taskData.project_name ? (
                            <Badge className="ml-2">
                              {taskData.project_name}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <ListTodo className="h-4 w-4 text-muted-foreground" />
                          Subtasks ({subtasks.filter(s => s.is_completed).length}/{subtasks.length})
                        </h4>
                        {!isAddingSubtask && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsAddingSubtask(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subtask
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {subtasks.length === 0 && !isAddingSubtask ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No subtasks yet. Break down this task into smaller steps.
                          </p>
                        ) : (
                          subtasks.map((subtask) => (
                            <div 
                              key={subtask.id} 
                              className="flex items-start gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors group"
                            >
                              <Checkbox
                                checked={subtask.is_completed}
                                onCheckedChange={() => handleToggleSubtask(subtask.id, subtask.is_completed)}
                                className="mt-0.5 data-[state=checked]:bg-green-400 data-[state=checked]:border-none"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm break-words ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                  {subtask.title}
                                </p>
                                {subtask.is_completed && subtask.completed_by_name ? (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Completed by {subtask.completed_by_name} • {formatDate(subtask.completed_at)}
                                  </p>
                                ) : null}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                onClick={() => handleDeleteSubtask(subtask.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                        
                        {isAddingSubtask && (
                          <div className="flex gap-2 p-3 border rounded-md bg-card">
                            <Input
                              ref={subtaskInputRef}
                              placeholder="Enter subtask title..."
                              value={newSubtask}
                              onChange={(e) => setNewSubtask(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddSubtask();
                                } else if (e.key === 'Escape') {
                                  setIsAddingSubtask(false);
                                  setNewSubtask('');
                                }
                              }}
                              className="flex-1"
                            />
                            <Button 
                              size="sm" 
                              onClick={handleAddSubtask}
                              disabled={!newSubtask.trim()}
                            >
                              Add
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setIsAddingSubtask(false);
                                setNewSubtask('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          Assigned To ({assignees.length})
                        </h4>
                        <div className="space-y-3">
                          {assignees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No one assigned yet.</p>
                          ) : (
                            assignees.map((assignee) => {
                              const user = users.find(u => u.id === assignee.user_id);
                              const profilePictureUrl = user?.profile_picture ? `${import.meta.env.VITE_BASE_URL}/uploads/profiles/${user.profile_picture}` : null;
                              return (
                                <div key={assignee.user_id} className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={profilePictureUrl} alt={`${assignee.first_name} ${assignee.last_name}`} />
                                    <AvatarFallback>{assignee.first_name?.charAt(0)}{assignee.last_name?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="text-sm font-medium">{assignee.first_name} {assignee.last_name}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(assignee.assigned_at)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          Timeline
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{formatDate(taskData.created_at)}</span>
                          </div>
                          <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">Updated:</span>
                            <span>{formatDate(taskData.updated_at)}</span>
                          </div>
                          <div className={`grid grid-cols-[100px_1fr] gap-2 text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                            <span className="text-muted-foreground">Deadline:</span>
                            <span className="flex items-center gap-2">
                              {formatDate(taskData.deadline_date)}
                              {isOverdue && <AlertCircle className="h-4 w-4" />}
                            </span>
                          </div>
                          {taskData.completed_at && (
                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm text-green-600">
                              <span className="text-muted-foreground">Completed:</span>
                              <span className="flex items-center gap-2">
                                {formatDate(taskData.completed_at)}
                                <CheckCircle2 className="h-4 w-4" />
                              </span>
                            </div>
                          )}
                          {taskData.is_recurring ? (
                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm pt-3 mt-3 border-t border-dashed">
                              <span className="text-muted-foreground flex items-center">
                                <Repeat className="h-4 w-4 mr-2" />
                                Recurring:
                              </span>
                              <div>
                                <span className="font-medium">{getRecurrenceDescription(taskData)}</span>
                                {taskData.next_occurrence ? (
                                  <div className="text-xs text-muted-foreground">
                                    Next instance on: {new Date(taskData.next_occurrence).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">
                                    This was the last instance in the series.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col border-t lg:border-t-0 lg:border-l">
                  <div className="p-4 border-b bg-muted/30">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Activity ({comments.length})
                    </h3>
                  </div>

                  <ScrollArea className="flex-1 p-4 lg:max-h-96">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No comments yet. Start the conversation below.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {comments.map((comment) => {
                          const user = users.find(u => u.id === comment.user_id);
                          const profilePictureUrl = user?.profile_picture ? `${import.meta.env.VITE_BASE_URL}/uploads/profiles/${user.profile_picture}` : null;
                          return (
                            <div key={comment.id} className="flex gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={profilePictureUrl} alt={`${comment.user_first_name} ${comment.user_last_name}`} />
                                <AvatarFallback>{comment.user_first_name?.charAt(0)}{comment.user_last_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-medium text-sm">{comment.user_first_name} {comment.user_last_name}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                                </div>
                                <div className="text-sm break-words whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                                  {comment.content}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="p-4 border-t bg-background">
                    <Card className="border-none shadow-none">
                      <CardContent className="p-0">
                        <div className="space-y-3">
                          <div className="relative">
                            <Textarea
                              ref={textareaRef}
                              placeholder="Add a comment... Use @ to mention."
                              value={newComment}
                              onChange={handleCommentChange}
                              className="min-h-[100px] resize-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                                  e.preventDefault();
                                  handleCommentSubmit();
                                }
                              }}
                            />
                            {showMentions && mentionSuggestions.length > 0 && (
                              <div className="absolute bottom-full left-0 right-0 bg-white border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto mb-1">
                                {mentionSuggestions.map((u) => {
                                  const profilePictureUrl = u.profile_picture ? `${import.meta.env.VITE_BASE_URL}/uploads/profiles/${u.profile_picture}` : null;
                                  return (
                                    <div
                                      key={u.id}
                                      className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                                      onClick={() => insertMention(u)}
                                    >
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={profilePictureUrl} alt={`${u.first_name} ${u.last_name}`} />
                                        <AvatarFallback>{u.first_name?.charAt(0)}{u.last_name?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="text-sm font-medium">{u.first_name} {u.last_name}</div>
                                        <div className="text-xs text-muted-foreground">@{u.username || u.first_name}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <AtSign className="h-3 w-3" />
                              Shift+Enter for new line
                            </div>
                            <Button size="sm" onClick={handleCommentSubmit} disabled={!newComment.trim()}>
                              <Send className="h-4 w-4 mr-2" />
                              Post
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-center py-8 px-6 text-muted-foreground ${contentHeight}`}>
              Task not found.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {taskData && (
        <EditTaskDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          task={taskData}
          onTaskUpdate={handleTaskUpdate}
          
          users={users}
        />
      )}
    </>
  );
};

export default OpenTaskDialog;