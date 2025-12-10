// components/tabs/ProjectsTab.jsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Plus, Settings, ChevronDown, ChevronRight, FolderOpen, Folder } from 'lucide-react';
import CreateProjectDialog from '../dialogs/CreateProjectDialog';
import EditProjectDialog from '../dialogs/EditProjectDialog';
import api from '@/services/api';

const ProjectCard = ({ project, children, level = 0, onManageClick, onToggleExpand, isExpanded, expandedProjects }) => {
  const percentage = project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0;
  const hasChildren = children && children.length > 0;
  const indentClass = level > 0 ? `ml-${level * 6}` : '';
  
  return (
    <div className={`${indentClass}`}>
      <Card className="flex flex-col mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleExpand(project.id)}
                  className="p-1 h-6 w-6"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              ) : (
                <div className="w-6" />
              )}
              {hasChildren ? (
                isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 bg-blue-500 rounded-sm" />
              )}
              <div>
                <CardTitle className="truncate text-base">{project.project_name}</CardTitle>
                {level > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Child Project
                  </div>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onManageClick(project)}>
              <Settings className="h-4 w-4 mr-1" />
              Manage
            </Button>
          </div>
          <CardDescription>Owner: {project.owner_name}</CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Task Progress</p>
            <div className="flex items-center gap-2">
              <Progress value={percentage} className="flex-1" />
              <span className="text-sm font-medium min-w-[45px]">{Math.round(percentage)}%</span>
            </div>
            <p className="text-xs text-right text-muted-foreground">
              {project.completed_tasks} / {project.total_tasks} Tasks Completed
            </p>
          </div>
          
          {hasChildren && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                {children.length} child project{children.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Render child projects */}
      {hasChildren && isExpanded && (
        <div className="ml-4 border-l-2 border-gray-200 pl-4">
          {children.map(child => (
            <ProjectTreeNode
              key={child.id}
              project={child}
              children={child.children}object
              level={level + 1}
              onManageClick={onManageClick}
              onToggleExpand={onToggleExpand}
              expandedProjects={expandedProjects}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectTreeNode = ({ project, children, level, onManageClick, onToggleExpand, expandedProjects }) => {
  const isExpanded = expandedProjects.includes(project.id);
  
  return (
    <ProjectCard
      project={project}
      children={children}
      level={level}
      onManageClick={onManageClick}
      onToggleExpand={onToggleExpand}
      isExpanded={isExpanded}
      expandedProjects={expandedProjects} 
    />
  );
};

const ProjectsTab = ({ users, user }) => {
  const [allProjects, setAllProjects] = useState([]);
  const [topLevelProjects, setTopLevelProjects] = useState([]);
  const [projectTree, setProjectTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [viewMode, setViewMode] = useState('hierarchical'); // 'hierarchical' or 'grid'

  // Build project tree structure
  const buildProjectTree = (projects) => {
    const projectMap = new Map();
    const rootProjects = [];

    // Create a map of all projects
    projects.forEach(project => {
      projectMap.set(project.id, { ...project, children: [] });
    });

    // Build the tree structure
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

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/projects');
      setAllProjects(data.data);
      setTopLevelProjects(data.data.filter(p => !p.parent_project_id));
      const tree = buildProjectTree(data.data);
      setProjectTree(tree);
      
      // Auto-expand projects with children
      const projectsWithChildren = data.data.filter(p => 
        data.data.some(child => child.parent_project_id === p.id)
      );
      setExpandedProjects(new Set(projectsWithChildren.map(p => p.id)));
      
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    fetchProjects(); 
  }, []);

  const handleProjectUpdate = () => { 
    fetchProjects(); 
  };

  const handleManageClick = (project) => { 
    setSelectedProject(project); 
    setShowManageDialog(true); 
  };

  const handleToggleExpand = (projectId) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const renderProjectTree = (projects, level = 0) => {
    return projects.map(projectNode => (
      <ProjectTreeNode
        key={projectNode.id}
        project={projectNode}
        children={projectNode.children}
        level={level}
        onManageClick={handleManageClick}
        onToggleExpand={handleToggleExpand}
        expandedProjects={Array.from(expandedProjects)}
      />
    ));
  };

  const renderGridView = () => {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {topLevelProjects.map(project => {
          const percentage = project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0;
          return (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="truncate">{project.project_name}</CardTitle>
                <CardDescription>Owner: {project.owner_name}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Task Progress</p>
                  <div className="flex items-center gap-2">
                    <Progress value={percentage} />
                    <span className="text-sm font-medium">{Math.round(percentage)}%</span>
                  </div>
                  <p className="text-xs text-right text-muted-foreground">
                    {project.completed_tasks} / {project.total_tasks} Tasks Completed
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => handleManageClick(project)}>
                  <Settings className="h-4 w-4 mr-2" />Manage
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isLoading) return <div>Loading projects...</div>;

  const totalProjects = allProjects.length;
  const childProjects = allProjects.filter(p => p.parent_project_id).length;
  const topLevelCount = totalProjects - childProjects;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalProjects} total ({topLevelCount} top-level, {childProjects} child projects)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'hierarchical' ? 'default' : 'outline'}
            onClick={() => setViewMode('hierarchical')}
            size="sm"
          >
            Tree View
          </Button>
          <Button 
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
            size="sm"
          >
            Grid View
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />Create Project
          </Button>
        </div>
      </div>

      {totalProjects === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects found.</p>
        </div>
      ) : (
        <div>
          {viewMode === 'hierarchical' ? (
            <div className="space-y-4">
              {renderProjectTree(projectTree)}
            </div>
          ) : (
            renderGridView()
          )}
        </div>
      )}

      <CreateProjectDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
        onProjectCreated={() => { 
          setShowCreateDialog(false); 
          fetchProjects(); 
        }} 
         
        users={users}
        currentUser={user} 
        projects={allProjects} 
      />
      
      {selectedProject && (
        <EditProjectDialog 
          open={showManageDialog} 
          onOpenChange={setShowManageDialog} 
          projectInitial={selectedProject} 
          onProjectUpdate={handleProjectUpdate} 
           
          users={users} 
          currentUser={user} 
          allProjects={allProjects} 
        />
      )}
    </div>
  );
};

export default ProjectsTab;