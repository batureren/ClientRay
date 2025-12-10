// frontend/pages/MainPage.jsx

import React, { useState, useRef, useEffect, Suspense, lazy } from 'react'
import { Users, Building, Package, Database, ClipboardPlus, ListChecks, LayoutDashboard, Mail, Folder, Target, Newspaper } from 'lucide-react'
import Widget from '../components/Widget'
import UserHeader from '../components/userHeader'
import Login from '../components/Login'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import api from '@/services/api';

// Tab components
const LeadsTab = lazy(() => import('../components/tabs/LeadsTab'))
const AccountsTab = lazy(() => import('../components/tabs/AccountsTab'))
const ProductsTab = lazy(() => import('../components/tabs/ProductsTab'))
const TasksTab = lazy(() => import('../components/tabs/TasksTab'))
const ExportDataTab = lazy(() => import('../components/tabs/ExportDataTab'))
const DashboardTab = lazy(() => import('../components/tabs/DashboardTab'))
const ReportsTab = lazy(() => import('../components/tabs/ReportsTab'))
// const EmailTab = lazy(() => import('../components/tabs/EmailTab'))
const DocsTab = lazy(() => import('../components/tabs/DocsTab'))
const CampaignsTab = lazy(() => import('../components/tabs/CampaignsTab'))
const InvoicesTab = lazy(() => import('../components/tabs/InvoicesTab'))

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    <Icon className="h-4 w-4" />
    <span className="text-sm font-medium">{label}</span>
  </button>
)

// Tab Group Component
const TabGroup = ({ title, children }) => (
  <div className="space-y-2">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
      {title}
    </h3>
    <div className="flex flex-wrap gap-1">
      {children}
    </div>
  </div>
)

function App() {
  const { t } = useTranslation()
  const abortControllers = useRef({});
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'leads')
  
  const [leads, setLeads] = useState([]) 
  const [accounts, setAccounts] = useState([])
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0)
  const [viewTask, setViewTask] = useState(null)

  const {
    user,
    isLoading: authLoading,
    error: authError,
    login,
    logout,
    isAuthenticated,
    hasPermission,
  } = useAuth()

  // Trigger task refresh
  const triggerTaskRefresh = () => {
    setTaskRefreshTrigger(prev => prev + 1)
  }

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
    setAccounts([])
    setProducts([])
    setLeads([])
    setActiveTab('leads')
  }

  // Handle task notification clicks
  const handleTaskNotificationClick = (task, action) => {
    if (action === 'view-all') {
      setActiveTab('tasks')
      setViewTask(null)
    } else if (task) {
      setActiveTab('tasks')
      setViewTask(task)
    }
  }

  const fetchProducts = async () => {
    if (!hasPermission('read')) return;

    abortControllers.current.products?.abort();
    const controller = new AbortController();
    abortControllers.current.products = controller;

    try {
      const response = await api.get('/products', { signal: controller.signal });
      
      if (!controller.signal.aborted) {
        setProducts(response.data);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Products request aborted');
      } else {
        console.error('Error fetching products:', error);
      }
    }
  };

  const fetchLeads = async () => {
    if (!hasPermission('read')) return;

    abortControllers.current.leads?.abort();
    const controller = new AbortController();
    abortControllers.current.leads = controller;

    try {
      const response = await api.get('/leads', { signal: controller.signal });
      setLeads(response.data.data || response.data);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Leads request aborted');
      } else {
        console.error('Error fetching leads:', error);
      }
    }
  };

  const fetchAccounts = async () => {
    if (!hasPermission('read')) return;

    abortControllers.current.accounts?.abort();
    const controller = new AbortController();
    abortControllers.current.accounts = controller;

    try {
      const response = await api.get('/accounts', { signal: controller.signal });
      setAccounts(response.data.data || response.data);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Accounts request aborted');
      } else {
        console.error('Error fetching accounts:', error);
      }
    }
  };

  const fetchedOnce = useRef(false);

  const fetchUsers = async () => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    try {
      const response = await api.get('/users');
      setUsers(response.data);
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

    if (activeTab === 'products' || activeTab === 'accounts') {
      fetchProducts();
    } else if (activeTab === 'database') {
      fetchLeads();
      fetchAccounts();
    }

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
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

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
          onTaskClick={handleTaskNotificationClick}
          refreshTrigger={taskRefreshTrigger}
          onLogout={handleLogout}
        />
        <Widget />

        {/* Organized Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Sales & CRM */}
            <TabGroup title={t('navigation.categories.sales', 'Sales & CRM')}>
              <TabButton
                active={activeTab === 'leads'}
                onClick={() => setActiveTab('leads')}
                icon={Users}
                label={t('navigation.leads')}
              />
              <TabButton
                active={activeTab === 'accounts'}
                onClick={() => setActiveTab('accounts')}
                icon={Building}
                label={t('navigation.accounts')}
              />
              <TabButton
                active={activeTab === 'campaign'}
                onClick={() => setActiveTab('campaign')}
                icon={Target}
                label={t('navigation.campaign')}
              />
            </TabGroup>

            {/* Operations */}
            <TabGroup title={t('navigation.categories.operations', 'Operations')}>
              <TabButton
                active={activeTab === 'products'}
                onClick={() => setActiveTab('products')}
                icon={Package}
                label={t('navigation.products')}
              />
              <TabButton
                active={activeTab === 'tasks'}
                onClick={() => setActiveTab('tasks')}
                icon={ListChecks}
                label={t('navigation.tasks')}
              />
              <TabButton
                active={activeTab === 'docs'}
                onClick={() => setActiveTab('docs')}
                icon={Folder}
                label={t('navigation.docs')}
              />
              <TabButton
                active={activeTab === 'invoices'}
                onClick={() => setActiveTab('invoices')}
                icon={Newspaper}
                label={t('navigation.invoices')}
              />
            </TabGroup>

            {/* Analytics */}
            <TabGroup title={t('navigation.categories.analytics', 'Analytics')}>
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                icon={LayoutDashboard}
                label={t('navigation.dashboard')}
              />
              <TabButton
                active={activeTab === 'reports'}
                onClick={() => setActiveTab('reports')}
                icon={ClipboardPlus}
                label={t('navigation.reports')}
              />
              <TabButton
                  active={activeTab === 'database'}
                  onClick={() => setActiveTab('database')}
                  icon={Database}
                  label={t('navigation.database')}
              />
            </TabGroup>
          </div>
        </div>

        {/* Tab Content */}
        <Suspense fallback={<div className="p-4 text-center">Loading tab...</div>}>
          {activeTab === 'leads' && (
            <LeadsTab 
              users={users}
              user={user}
              canEdit={hasPermission('write')}
              canDelete={hasPermission('delete')}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountsTab 
              products={products}
              users={users}
              user={user}
              canEdit={hasPermission('write')}
              canDelete={hasPermission('delete')}
            />
          )}
          {activeTab === 'docs' && (
            <DocsTab/>
          )}
          {activeTab === 'products' && (
            <ProductsTab 
              products={products} 
              onRefresh={fetchProducts}
              canEdit={hasPermission('write')}
              canDelete={hasPermission('delete')}
            />
          )}
          {activeTab === 'campaign' && (
            <CampaignsTab 
              user={user}
              users={users}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksTab 
              user={user}
              users={users}
              canEdit={hasPermission('write')}
              canDelete={hasPermission('delete')}
              onTaskUpdate={triggerTaskRefresh}
              viewTask={viewTask}
            />
          )}
          {activeTab === 'dashboard' && (
            <DashboardTab
              canView={hasPermission('read')}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsTab 
              canView={hasPermission('read')}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoicesTab user={user}/>
          )}
          {activeTab === 'database' && hasPermission('export') && (
            <ExportDataTab 
              leads={leads}
              accounts={accounts}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}

export default App