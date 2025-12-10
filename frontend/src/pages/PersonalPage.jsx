// frontend/pages/PersonalPage.jsx

import React, { useState, useRef, useEffect, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { StickyNote, Calendar, CircuitBoard } from 'lucide-react'
import Widget from '../components/Widget'
import UserHeader from '../components/userHeader'
import Login from '../components/Login'
import api from '@/services/api';
import { useAuth } from '../hooks/useAuth'

// Lazy load tab components
const NotesTab = lazy(() => import('../components/tabs/NotesTab'))
const CalendarTab = lazy(() => import('../components/tabs/CalendarTab'))
const ProjectsTab = lazy(() => import('../components/tabs/ProjectsTab'))

function PersonalPage() {
  const { t } = useTranslation()
  
  const abortControllers = useRef({});
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activePersonalTab') || 'notes')
  const [users, setUsers] = useState([])

  const {
    user,
    isLoading: authLoading,
    error: authError,
    login,
    logout,
    isAuthenticated,
  } = useAuth()

  // Handle login
  const handleLogin = async (credentials) => {
    const result = await login(credentials)
    if (result.success) {
      console.log('Login successful')
    }
  }

  // Handle logout
  const handleLogout = () => {
    logout()
    setActiveTab('notes')
  }

const fetchedOnce = useRef(false);

const fetchUsers = async () => {
  if (fetchedOnce.current) return;
  fetchedOnce.current = true;

  try {
    const data = await api.get('/users');
    setUsers(data.data);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

// Fetch data when user changes or authenticated
useEffect(() => {
  Object.entries(abortControllers.current).forEach(([key, controller]) => {
    if (key !== 'users') {
      controller.abort();
    }
  });
  abortControllers.current = {};

  if (!isAuthenticated()) return;

  if (users.length === 0) {
    fetchUsers();
  }
}, [activeTab, user]);

useEffect(() => {
  return () => {
    Object.values(abortControllers.current).forEach(controller => {
      controller.abort();
    });
  };
}, []);

  useEffect(() => {
    localStorage.setItem('activePersonalTab', activeTab)
  }, [activeTab])

  // Loading screen while auth status is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated()) {
    return (
      <Login 
        onLogin={handleLogin}
        isLoading={authLoading}
        error={authError}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <UserHeader 
          user={user}
          
          onLogout={handleLogout}
          isPersonalPage={true}
        />
        <div className="flex justify-between items-center mb-6">
          <Widget />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                {t('personal.notes')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('personal.calendar')}
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <CircuitBoard className="h-4 w-4" />
                {t('personal.projects')}
              </TabsTrigger>
          </TabsList>

          <Suspense fallback={<div className="p-4 text-center">{t('common.loading')}</div>}>
            {activeTab === 'notes' && (
              <NotesTab 
                
                user={user}
                users={users}
              />
            )}
            {activeTab === 'calendar' && (
              <CalendarTab 
                
                user={user}
                users={users}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsTab 
                
                users={users}
                user={user}
              />
            )}
          </Suspense>
        </Tabs>
      </div>
    </div>
  )
}

export default PersonalPage