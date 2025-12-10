// components/dialogs/CreateProjectDialog.jsx
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Checkbox } from "@/components/ui/checkbox";

const CreateProjectDialog = ({ open, onOpenChange, onProjectCreated, users, projects, currentUser, preselectedParentId = null }) => {
  const [formData, setFormData] = useState({
    project_name: '',
    project_description: '',
    parent_project_id: null
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, parent_project_id: preselectedParentId || '' }));
    }
  }, [open, preselectedParentId]);

  const handleMemberCheckedChange = (checked, userId) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, { user_id: userId, role: 'viewer' }]);
    } else {
      setSelectedMembers(selectedMembers.filter(member => member.user_id !== userId));
    }
  };

  const handleRoleChange = (role, userId) => {
    setSelectedMembers(prevMembers =>
      prevMembers.map(member =>
        member.user_id === userId ? { ...member, role } : member
      )
    );
  };

  const resetForm = () => {
    setFormData({ project_name: '', project_description: '', parent_project_id: '' });
    setSelectedMembers([]);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.project_name.trim()) {
      setError('Project name is required.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await api.post('/projects', { ...formData, members: selectedMembers });
      onProjectCreated();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project.');
    } finally {
      setIsLoading(false);
    }
  };

  const assignableUsers = users?.filter(user => user.id !== currentUser?.id);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{preselectedParentId ? 'Create Child Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>Fill in the details for your new project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="create-project-form" className="space-y-4 pt-4">
          
          <div className="space-y-2">
            <Label htmlFor="parent_project_id">Parent Project (Optional)</Label>
            <Select 
              value={String(formData.parent_project_id || '')} 
              onValueChange={(v) => setFormData({...formData, parent_project_id: v === 'null' ? null : v})} 
              disabled={!!preselectedParentId}
            >
              <SelectTrigger><SelectValue placeholder="None (Top-Level Project)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value='null'>None (Top-Level Project)</SelectItem>
                {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_name">Project Name *</Label>
            <Input id="project_name" value={formData.project_name} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_description">Description</Label>
            <Textarea id="project_description" value={formData.project_description} onChange={(e) => setFormData({ ...formData, project_description: e.target.value })} rows={3} />
          </div>
          
          <div className="space-y-3">
            <Label>Assign Members</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-3">
              {assignableUsers?.map(user => {
                const isSelected = selectedMembers.some(m => m.user_id === user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`member-${user.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleMemberCheckedChange(checked, user.id)}
                      />
                      <label htmlFor={`member-${user.id}`} className="text-sm font-normal cursor-pointer">
                        {user.first_name} {user.last_name}
                      </label>
                    </div>
                    {isSelected && (
                      <Select
                        value={selectedMembers.find(m => m.user_id === user.id)?.role || 'viewer'}
                        onValueChange={(role) => handleRoleChange(role, user.id)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="create-project-form" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;