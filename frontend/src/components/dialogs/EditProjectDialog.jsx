// components/dialogs/EditProjectDialog.jsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Folder, CheckCircle, Circle, UserPlus } from 'lucide-react';
import CreateProjectDialog from './CreateProjectDialog';
import CreateTaskDialog from './CreateTaskDialog';
import ConfirmationDialog from './ConfirmationDialog'; // Import the confirmation dialog
import api from '@/services/api';

const EditProjectDialog = ({ open, onOpenChange, projectInitial, onProjectUpdate, users, currentUser, allProjects }) => {
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showCreateChildDialog, setShowCreateChildDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  // State for member management form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');

  // State for the confirmation dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);

  const fetchProjectDetails = async () => {
    if (!projectInitial?.id) return;
    setIsLoading(true);
    try {
      const data = await api.get(`/projects/${projectInitial.id}/details`);
      setProject(data.data);
      setIsOwner(data.data.owner_id === currentUser.id);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (open) {
      fetchProjectDetails();
    }
  }, [open, projectInitial]);

  const handleRefresh = () => {
    fetchProjectDetails();
    onProjectUpdate();
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await api.post(`/projects/${project.id}/members`, {
        user_id: selectedUserId,
        role: selectedRole,
      });
      // Reset form and refresh data
      setSelectedUserId('');
      setSelectedRole('viewer');
      handleRefresh();
    } catch (error) {
      console.error("Failed to add member:", error);
      alert(error.response?.data?.error || 'An error occurred while adding the member.');
    }
  };
  
  // Triggers the confirmation dialog to open
  const promptRemoveMember = (member) => {
    setMemberToRemove(member);
    setIsConfirmOpen(true);
  };

  // Executes the actual deletion after user confirmation
  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    
    try {
      await api.delete(`/projects/${project.id}/members/${memberToRemove.id}`);
      handleRefresh();
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert(error.response?.data?.error || 'An error occurred while removing the member.');
    } finally {
      setMemberToRemove(null);
      setIsConfirmOpen(false);
    }
  };

  const availableUsers = useMemo(() => {
    if (!project || !users) return [];
    const memberIds = new Set(project.members.map(m => m.id));
    return users.filter(user => !memberIds.has(user.id));
  }, [project, users]);
  
  if (isLoading || !project) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle></DialogTitle></DialogHeader>
        Loading...
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[725px]">
          <DialogHeader>
            <DialogTitle>Manage: {project.project_name}</DialogTitle>
            <DialogDescription>Owner: {project.owner_name}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="tasks" className="pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tasks">Tasks ({project.tasks.length})</TabsTrigger>
              <TabsTrigger value="child_projects">Child Projects ({project.child_projects.length})</TabsTrigger>
              <TabsTrigger value="members">Members ({project.members.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4 pt-4">
              <Button onClick={() => setShowCreateTaskDialog(true)}><Plus className="h-4 w-4 mr-2"/>Add Task to this Project</Button>
              <div className="border rounded-md p-2 max-h-80 overflow-y-auto">
                {project.tasks.length > 0 ? project.tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div className="flex items-center gap-2">
                        {task.task_status === 'completed' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                        <span>{task.task_name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Assignee: {task.assignee_fname} {task.assignee_lname}</span>
                  </div>
                )) : <p className="text-center text-sm text-muted-foreground py-4">No tasks in this project yet.</p>}
              </div>
            </TabsContent>

            <TabsContent value="child_projects" className="space-y-4 pt-4">
              <Button onClick={() => setShowCreateChildDialog(true)}><Plus className="h-4 w-4 mr-2"/>Add Child Project</Button>
               <div className="border rounded-md p-2 max-h-80 overflow-y-auto">
                 {project.child_projects.length > 0 ? project.child_projects.map(child => (
                   <div key={child.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded"><Folder className="h-4 w-4 text-muted-foreground"/><span>{child.project_name}</span></div>
                 )) : <p className="text-center text-sm text-muted-foreground py-4">No child projects yet.</p>}
               </div>
            </TabsContent>
            
            <TabsContent value="members" className="space-y-4 pt-4">
                {isOwner && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 p-4 border rounded-lg bg-muted/50">
                        <h3 className="text-md font-semibold mr-auto whitespace-nowrap">Add New Member</h3>
                        <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableUsers.map(user => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                        {user.first_name} {user.last_name} ({user.username})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedRole} value={selectedRole} defaultValue="viewer">
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAddMember} disabled={!selectedUserId} className="w-full sm:w-auto">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </div>
                )}
                <div className="border rounded-md max-h-80 overflow-y-auto">
                    {project.members.length > 0 ? project.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-b-0">
                        <div>
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.id === project.owner_id && (
                              <span className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted rounded-md">OWNER</span>
                          )}
                          {isOwner && member.id !== project.owner_id && (
                              <Button variant="ghost" size="icon" onClick={() => promptRemoveMember(member)} aria-label="Remove member">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          )}
                        </div>
                    </div>
                    )) : <p className="text-center text-sm text-muted-foreground py-4">This project has no members yet.</p>}
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      <CreateProjectDialog
        open={showCreateChildDialog}
        onOpenChange={setShowCreateChildDialog}
        onProjectCreated={() => { setShowCreateChildDialog(false); handleRefresh(); }}
        
        users={users}
        projects={allProjects.filter(p => p.id !== project.id)}
        preselectedParentId={project.id}
      />
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={() => { setShowCreateTaskDialog(false); handleRefresh(); }}
        
        users={users}
        preselectedProjectId={project.id}
        disableProjectSelection={true}
      />

      {/* Confirmation Dialog for removing a member */}
      {memberToRemove && (
        <ConfirmationDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          title="Remove Member?"
          description={`Are you sure you want to remove ${memberToRemove.first_name} ${memberToRemove.last_name} from this project? This action cannot be undone.`}
          onConfirm={handleConfirmRemove}
          confirmText="Yes, Remove Member"
        />
      )}
    </>
  );
};

export default EditProjectDialog;