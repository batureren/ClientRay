import React, { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, AlertTriangle, List, ExternalLink, RefreshCw, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OpenTaskDialog from '../dialogs/OpenTaskDialog.jsx'
import api from '@/services/api';

const CalendarTab = ({ user, users }) => {
  // Internal App State
  const [tasks, setTasks] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [dayTasksDialogOpen, setDayTasksDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDateTasks, setSelectedDateTasks] = useState([])
  // Google Integration State
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [showCalendarEvents, setShowCalendarEvents] = useState(true)
  const [calendarEvents, setCalendarEvents] = useState([])
  const [googleTasks, setGoogleTasks] = useState([])
  const [authInitialized, setAuthInitialized] = useState(false)
  const [authError, setAuthError] = useState(null)
  const tokenClient = useRef(null)
  const gapiInited = useRef(false)
  const gisInited = useRef(false)
  // Calendly Integration State
  const [calendlyEvents, setCalendlyEvents] = useState([]);
  const [isCalendlyConnected, setIsCalendlyConnected] = useState(false);
  const [showCalendlyEvents, setShowCalendlyEvents] = useState(true);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Improved auth state management
  const getStoredGoogleAuth = () => {
    try {
      const authData = localStorage.getItem('google_calendar_auth');
      if (!authData) return null;
      
      const parsed = JSON.parse(authData);
      
      // Check if token hasn't expired (with 5 minute buffer)
      if (parsed.expiresAt && new Date().getTime() > (parsed.expiresAt - 300000)) {
        localStorage.removeItem('google_calendar_auth');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Error reading Google auth from localStorage:', error);
      localStorage.removeItem('google_calendar_auth');
      return null;
    }
  };

  const setStoredGoogleAuth = (authData) => {
    try {
      if (authData) {
        // Calculate expiration time (default 1 hour, with buffer)
        const expiresIn = authData.expires_in || 3600;
        const expiresAt = new Date().getTime() + (expiresIn * 1000);
        
        const dataToStore = {
          access_token: authData.access_token,
          expiresAt: expiresAt,
          granted: true,
          timestamp: new Date().getTime()
        };
        
        localStorage.setItem('google_calendar_auth', JSON.stringify(dataToStore));
      } else {
        localStorage.removeItem('google_calendar_auth');
      }
    } catch (error) {
      console.warn('Error storing Google auth in localStorage:', error);
    }
  };

  // Initialize Google APIs
  useEffect(() => {
    let mounted = true;
    
    const loadGoogleAPIs = async () => {
      try {
        setAuthError(null);
        
        // Load Google Identity Services
        if (!window.google) {
          const gisScript = document.createElement('script');
          gisScript.src = 'https://accounts.google.com/gsi/client';
          gisScript.async = true;
          gisScript.defer = true;
          
          await new Promise((resolve, reject) => {
            gisScript.onload = resolve;
            gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(gisScript);
          });
        }

        // Load Google API
        if (!window.gapi) {
          const gapiScript = document.createElement('script');
          gapiScript.src = 'https://apis.google.com/js/api.js';
          gapiScript.async = true;
          gapiScript.defer = true;
          
          await new Promise((resolve, reject) => {
            gapiScript.onload = resolve;
            gapiScript.onerror = () => reject(new Error('Failed to load Google API'));
            document.head.appendChild(gapiScript);
          });
        }

        if (!mounted) return;

        // Initialize GAPI client
        if (!gapiInited.current) {
          await new Promise((resolve, reject) => {
            window.gapi.load('client', async () => {
              try {
                await window.gapi.client.init({
                  apiKey: import.meta.env.VITE_APP_GOOGLE_API_KEY,
                  discoveryDocs: [
                    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
                    'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'
                  ],
                });
                gapiInited.current = true;
                resolve();
              } catch (error) {
                console.error('GAPI initialization failed:', error);
                reject(error);
              }
            });
          });
        }

        if (!mounted) return;

        // Initialize Google Identity Services
        if (!gisInited.current && window.google?.accounts?.oauth2) {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_APP_GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
            callback: (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                console.log("Google authentication successful");
                window.gapi.client.setToken(tokenResponse);
                setIsGoogleConnected(true);
                setStoredGoogleAuth(tokenResponse);
                setAuthError(null);
              } else {
                console.error("Google authentication failed:", tokenResponse);
                setIsGoogleConnected(false);
                setStoredGoogleAuth(null);
                setAuthError(tokenResponse?.error || 'Authentication failed');
              }
            },
            error_callback: (error) => {
              console.error("Google authentication error:", error);
              setIsGoogleConnected(false);
              setStoredGoogleAuth(null);
              setAuthError(error.message || 'Authentication error');
            }
          });
          gisInited.current = true;
        }

        if (mounted) {
          setAuthInitialized(true);
          
          // Try to restore previous session
          const storedAuth = getStoredGoogleAuth();
          if (storedAuth && storedAuth.access_token) {
            console.log('Restoring Google authentication from storage');
            window.gapi.client.setToken({ access_token: storedAuth.access_token });
            setIsGoogleConnected(true);
          }
        }

      } catch (error) {
        console.error('Google API initialization failed:', error);
        if (mounted) {
          setAuthError(`Initialization failed: ${error.message}`);
          setAuthInitialized(true); // Still set to true to show error state
        }
      }
    };

    loadGoogleAPIs();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Google data when connected or date changes
  useEffect(() => {
    if (isGoogleConnected && gapiInited.current) {
      refreshAllGoogleData();
    }
  }, [currentDate, isGoogleConnected]);

  const connectGoogleCalendar = () => {
    setAuthError(null);
    if (tokenClient.current) {
      try {
        tokenClient.current.requestAccessToken({ 
          prompt: '',
          include_granted_scopes: true
        });
      } catch (error) {
        console.error('Error requesting access token:', error);
        setAuthError('Failed to request access token');
      }
    } else {
      console.error('Google Token Client not initialized');
      setAuthError('Google client not initialized');
    }
  };

  const disconnectGoogleCalendar = () => {
    try {
      const token = window.gapi.client.getToken();
      if (token && token.access_token) {
        window.google.accounts.oauth2.revoke(token.access_token, () => {
          console.log('Google access revoked');
        });
      }
      
      window.gapi.client.setToken(null);
      setIsGoogleConnected(false);
      setStoredGoogleAuth(null);
      setCalendarEvents([]);
      setGoogleTasks([]);
      setAuthError(null);
      console.log('Google Calendar disconnected');
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
    }
  };

const fetchCalendarEvents = async () => {
  if (!window.gapi?.client?.calendar) {
    console.warn('Google Calendar API not available');
    return;
  }
  
  try {
    setCalendarLoading(true);
    
    // Calculate the full date range that's visible in the calendar grid
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    
    // Start date: first visible day (could be from previous month)
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    startDate.setDate(startDate.getDate() - firstDayOfMonth);
    
    // End date: last visible day (could be from next month)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), daysInMonth);
    const totalDaysShown = 42; // 6 weeks * 7 days
    const daysFromCurrentMonth = daysInMonth;
    const daysFromPrevMonth = firstDayOfMonth;
    const daysFromNextMonth = totalDaysShown - daysFromCurrentMonth - daysFromPrevMonth;
    endDate.setDate(endDate.getDate() + daysFromNextMonth);
    
    const response = await window.gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250
    });

    const events = (response.result.items || []).map(event => ({
      id: `google-event-${event.id}`,
      itemType: 'event',
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      isAllDay: !event.start.dateTime,
      location: event.location || '',
      htmlLink: event.htmlLink,
    }));
    
    setCalendarEvents(events);
    console.log(`Fetched ${events.length} calendar events for visible date range`);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    if (error.status === 401 || error.status === 403) {
      console.log('Authentication expired, disconnecting...');
      disconnectGoogleCalendar();
    }
  } finally {
    setCalendarLoading(false);
  }
};
  
const fetchGoogleTasks = async () => {
  if (!window.gapi?.client?.tasks) {
    console.warn('Google Tasks API not available');
    return;
  }
  
  try {
    const taskLists = await window.gapi.client.tasks.tasklists.list();
    if (!taskLists.result.items || taskLists.result.items.length === 0) {
      console.log('No Google task lists found');
      return;
    }
    
    const primaryTaskListId = taskLists.result.items[0].id;
    
    // Calculate the full date range that's visible in the calendar grid
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    
    // Start date: first visible day (could be from previous month)
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    startDate.setDate(startDate.getDate() - firstDayOfMonth);
    
    // End date: last visible day (could be from next month)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), daysInMonth);
    const totalDaysShown = 42; // 6 weeks * 7 days
    const daysFromCurrentMonth = daysInMonth;
    const daysFromPrevMonth = firstDayOfMonth;
    const daysFromNextMonth = totalDaysShown - daysFromCurrentMonth - daysFromPrevMonth;
    endDate.setDate(endDate.getDate() + daysFromNextMonth);

    const response = await window.gapi.client.tasks.tasks.list({
      tasklist: primaryTaskListId,
      dueMin: startDate.toISOString(),
      dueMax: endDate.toISOString(),
      showCompleted: false,
      maxResults: 100,
    });

    const tasks = (response.result.items || []).map(task => {
      const hasTime = task.due && task.due.includes('T');
      return {
        id: `google-task-${task.id}`,
        itemType: 'google_task',
        title: task.title || 'Untitled Task',
        description: task.notes || '',
        start: task.due,
        isAllDay: !hasTime,
        htmlLink: `https://mail.google.com/tasks/u/0/canvas/?pli=1&vid=${task.id}`
      };
    });
    
    setGoogleTasks(tasks);
  } catch (error) {
    console.error('Error fetching Google Tasks:', error);
    if (error.status === 401 || error.status === 403) {
      console.log('Authentication expired, disconnecting...');
      disconnectGoogleCalendar();
    }
  }
};

  const refreshAllGoogleData = () => {
    if (isGoogleConnected) {
      console.log('Refreshing Google data...');
      fetchCalendarEvents();
      fetchGoogleTasks();
    }
  };

  const fetchCalendlyEvents = async (userUri) => {
    console.log("test");
    try {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString();
      const response = await api.post('/packages/calendly/execute', {
        endpoint: 'get-meetings',
        options: {
          userUri,
          startTime: startDate,
          endTime: endDate,
        },
      });
      if (response.collection) {
        const events = response.collection.map(event => ({
          id: `calendly-${event.uri.split('/').pop()}`,
          itemType: 'calendly_event',
          title: event.name,
          start: event.start_time,
          end: event.end_time,
          isAllDay: false,
          htmlLink: false,
        }));
        setCalendlyEvents(events);
        setIsCalendlyConnected(true);
      }
    } catch (error) {
      console.error('Error fetching Calendly events:', error);
    }
  };
  
  useEffect(() => {
    const fetchCalendlyUserAndEvents = async () => {
      try {
        const response = await api.get('/packages/calendly');
        if (response.data) {
          const calendlyPackage = response.data;
          if (calendlyPackage.is_enabled && calendlyPackage.config) {
            const config = JSON.parse(calendlyPackage.config);
            if (config.default_user_uri) {
              fetchCalendlyEvents(config.default_user_uri);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching Calendly package:', error);
      }
    };
    fetchCalendlyUserAndEvents();
  }, []);

useEffect(() => {
  const fetchTasks = async () => {
    try {
      
      // Calculate date range (same as before)
      const firstDayOfMonth = getFirstDayOfMonth(currentDate);
      const daysInMonth = getDaysInMonth(currentDate);
      
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      startDate.setDate(startDate.getDate() - firstDayOfMonth);
      
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), daysInMonth);
      const totalDaysShown = 42;
      const daysFromCurrentMonth = daysInMonth;
      const daysFromPrevMonth = firstDayOfMonth;
      const daysFromNextMonth = totalDaysShown - daysFromCurrentMonth - daysFromPrevMonth;
      endDate.setDate(endDate.getDate() + daysFromNextMonth);
      
      const startDateISO = startDate.toISOString().split('T')[0];
      const endDateISO = endDate.toISOString().split('T')[0];
      
      const params = new URLSearchParams({
        start_date: startDateISO,
        end_date: endDateISO
      });
      const data = await api.get(`/tasks/my?${params.toString()}`);
      
      const formattedTasks = data.data.map(task => {
        const hasTime = task.deadline_date && task.deadline_date.includes('T');
        return {
          ...task,
          itemType: 'task',
          isAllDay: !hasTime
        };
      });
      setTasks(formattedTasks);
      
      console.log(`Fetched ${formattedTasks.length} tasks for date range ${startDateISO} to ${endDateISO}`);
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (error.status === 401) {
        console.log('Main app authentication failed');
      }
    }
  };
  
  if (user?.id) {
    fetchTasks();
  }
}, [user, currentDate]);

  // Calendar helper functions
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  const isToday = (date) => isSameDay(date, new Date())
  const isPastDate = (date) => { const today = new Date(); today.setHours(23, 59, 59, 999); return date < today }
  const getTasksForDate = (date) => tasks.filter(task => task.deadline_date && isSameDay(new Date(task.deadline_date), date))
  const getEventsForDate = (date) => showCalendarEvents ? calendarEvents.filter(event => event.start && isSameDay(new Date(event.start), date)) : []
  const getGoogleTasksForDate = (date) => showCalendarEvents ? googleTasks.filter(task => task.start && isSameDay(new Date(task.start), date)) : []
  const getCalendlyEventsForDate = (date) => showCalendlyEvents ? calendlyEvents.filter(event => event.start && isSameDay(new Date(event.start), date)) : [];
  const getItemsForDate = (date) => [...getTasksForDate(date), ...getEventsForDate(date), ...getGoogleTasksForDate(date), ...getCalendlyEventsForDate(date)].sort((a, b) => (a.isAllDay ? -1 : 1));
  const getCurrentMonthTasks = () => tasks.filter(t => t.deadline_date && new Date(t.deadline_date).getMonth() === currentDate.getMonth()).sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date))
  const getCurrentMonthEvents = () => showCalendarEvents ? calendarEvents.filter(e => e.start && new Date(e.start).getMonth() === currentDate.getMonth()).sort((a, b) => new Date(a.start) - new Date(b.start)) : []
  const getCurrentMonthGoogleTasks = () => showCalendarEvents ? googleTasks.filter(t => t.start && new Date(t.start).getMonth() === currentDate.getMonth()).sort((a, b) => new Date(a.start) - new Date(b.start)) : []
  const getCurrentMonthCalendlyEvents = () => showCalendlyEvents ? calendlyEvents.filter(e => e.start && new Date(e.start).getMonth() === currentDate.getMonth()) : [];

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  
  const formatItemTimeRange = (item) => {
    if (item.isAllDay) return '';
    const dateString = item.itemType === 'task' ? item.deadline_date : item.start;
    if (!dateString) return '';
    const startTime = formatTime(dateString);
    if (item.itemType === 'event' && item.end) {
      const endTime = formatTime(item.end);
      return startTime === endTime ? startTime : `${startTime} - ${endTime}`;
    }
    return startTime;
  }

  // Click Handlers
  const handleTaskClick = (task) => { setSelectedTask(task); setTaskDialogOpen(true) }
  const handleEventClick = (event) => { if (event.htmlLink) window.open(event.htmlLink, '_blank') }
  const handleItemClick = (item) => {
    if (item.itemType === 'task') handleTaskClick(item)
    else if (item.itemType === 'event' || item.itemType === 'google_task' || item.itemType === 'calendly_event') handleEventClick(item)
  }
  const handleDayClick = (date, dayItems) => {
    if (dayItems.length === 0) return
    if (dayItems.length === 1) handleItemClick(dayItems[0])
    else { setSelectedDate(date); setSelectedDateTasks(dayItems); setDayTasksDialogOpen(true) }
  }
  const handleDialogClose = () => { setTaskDialogOpen(false); setSelectedTask(null) }
  const handleDayTasksDialogClose = () => { setDayTasksDialogOpen(false); setSelectedDate(null); setSelectedDateTasks([]) }
  const handleItemSelectFromDay = (item) => { setDayTasksDialogOpen(false); handleItemClick(item) }

  // Memoized calendar days calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []
    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i)
      days.push({ date, isCurrentMonth: false, items: getItemsForDate(date) })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      days.push({ date, isCurrentMonth: true, items: getItemsForDate(date) })
    }
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day)
      days.push({ date, isCurrentMonth: false, items: getItemsForDate(date) })
    }
    return days
  }, [currentDate, tasks, calendarEvents, googleTasks, showCalendarEvents, calendlyEvents, showCalendlyEvents])

  // Navigation and Color Helpers
  const goToPrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToToday = () => setCurrentDate(new Date())
  const getPriorityColor = (p) => ({ urgent: 'bg-red-800', high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }[p] || 'bg-slate-400')
  const getStatusColor = (s) => ({ completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', in_progress: 'bg-blue-50 text-blue-700 border-blue-200', pending: 'bg-slate-50 text-slate-700 border-slate-200' }[s] || 'bg-slate-50 text-slate-700 border-slate-200')
  const getEventColor = () => 'bg-purple-50 text-purple-700 border-purple-200'
  const getGoogleTaskColor = () => 'bg-sky-50 text-sky-700 border-sky-200'
  const getCalendlyEventColor = () => 'bg-orange-50 text-orange-700 border-orange-200';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3"><h2 className="text-lg font-semibold flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Calendar</h2><Button onClick={goToToday} variant="outline" size="sm" className="text-xs px-2 h-7">Today</Button></div>
        <div className="flex items-center justify-between sm:justify-end space-x-3 flex-wrap gap-2">
          <div className="flex items-center space-x-2">{!isGoogleConnected ? (<Button onClick={connectGoogleCalendar} variant="outline" size="sm" className="text-xs px-2 h-7" disabled={!authInitialized}>{!authInitialized ? 'Initializing...' : 'Connect Google Calendar'}</Button>) : (<div className="flex items-center space-x-1"><Button onClick={refreshAllGoogleData} variant="outline" size="sm" className="text-xs px-2 h-7" disabled={calendarLoading}>{calendarLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}</Button><Button onClick={() => setShowCalendarEvents(!showCalendarEvents)} variant="outline" size="sm" className={`text-xs px-2 h-7 ${showCalendarEvents ? 'bg-purple-100 text-purple-700' : ''}`}>Events</Button><Button onClick={disconnectGoogleCalendar} variant="outline" size="sm" className="text-xs px-2 h-7 text-red-600 hover:text-red-700">Disconnect</Button></div>)}
          {isCalendlyConnected && (
            <Button onClick={() => setShowCalendlyEvents(!showCalendlyEvents)} variant="outline" size="sm" className={`text-xs px-2 h-7 ${showCalendlyEvents ? 'bg-orange-100 text-orange-700' : ''}`}>
              Calendly
            </Button>
          )}
          </div>
          {isMobile && (<div className="flex rounded border overflow-hidden"><button onClick={() => setView('month')} className={`px-2 py-1 text-xs ${view === 'month' ? 'bg-blue-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}><CalendarIcon className="h-3 w-3" /></button><button onClick={() => setView('list')} className={`px-2 py-1 text-xs ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}><List className="h-3 w-3" /></button></div>)}
          <div className="flex items-center space-x-1"><Button onClick={goToPrevMonth} variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronLeft className="h-3 w-3" /></Button><span className="text-sm font-medium min-w-[100px] sm:min-w-[140px] text-center">{isMobile ? `${monthNames[currentDate.getMonth()].slice(0, 3)} ${currentDate.getFullYear()}` : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}</span><Button onClick={goToNextMonth} variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronRight className="h-3 w-3" /></Button></div>
        </div>
      </div>

      {/* Month View */}
      {view === 'month' ? (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-7 border-b bg-slate-50">{dayNames.map(day => (<div key={day} className="p-2 text-center text-xs font-medium text-slate-600">{day}</div>))}</div>
          <div className="grid grid-cols-7 border-b bg-slate-50 sm:hidden">{dayNames.map(day => (<div key={day} className="p-1.5 text-center text-xs font-medium text-slate-600">{day.charAt(0)}</div>))}</div>
          <div className="grid grid-cols-7">
            {calendarDays.map((dayData, index) => {
              const { date, isCurrentMonth, items: dayItems } = dayData;
              const hasOverdueTasks = dayItems.some(item => item.itemType === 'task' && item.task_status !== 'completed' && isPastDate(date));
              return (
                <div key={index} className={`min-h-[50px] sm:min-h-[90px] border-b border-r p-1 ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : ''} ${isToday(date) ? 'bg-blue-50' : ''} ${hasOverdueTasks ? 'bg-red-50' : ''}`}>
                  <div className={`text-xs font-medium mb-1 flex items-center justify-between ${isToday(date) ? 'text-blue-600 font-semibold' : ''}`}><span>{date.getDate()}</span>{hasOverdueTasks && (<AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 text-red-500" />)}</div>
                  <div className="space-y-0.5">
                    <div className="sm:hidden">{dayItems.length > 0 && (<div className="text-xs bg-blue-100 text-blue-700 px-1 rounded text-center cursor-pointer" onClick={() => handleDayClick(date, dayItems)}>{dayItems.length}</div>)}</div>
                    <div className="hidden sm:block space-y-0.5">
                      {dayItems.slice(0, 2).map(item => {
                        const isAppTask = item.itemType === 'task', isGoogleEvent = item.itemType === 'event', isGoogleTask = item.itemType === 'google_task', isCalendlyEvent = item.itemType === 'calendly_event';
                        let itemColorClass = isAppTask ? getStatusColor(item.task_status) : isGoogleEvent ? getEventColor() : isGoogleTask ? getGoogleTaskColor() : isCalendlyEvent ? getCalendlyEventColor() : '';
                        return (
                          <div key={item.id} className={`text-xs p-1 rounded border cursor-pointer hover:shadow-sm ${itemColorClass}`} title={isAppTask ? item.task_name : item.title} onClick={() => handleItemClick(item)}>
                            <div className="flex items-center space-x-1.5">{isAppTask && <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(item.task_priority)}`} />}{isGoogleEvent && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}{isGoogleTask && <CheckSquare className="h-2.5 w-2.5 text-sky-600" />}{isCalendlyEvent && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}<span className="truncate flex-1 text-xs">{isAppTask ? item.task_name : item.title}</span>{(isGoogleEvent || isGoogleTask) && (<ExternalLink className="h-2 w-2 opacity-60" />)}</div>
                            {isAppTask && item.assigned_to_name && (<div className="flex items-center mt-0.5 text-slate-500"><User className="h-2 w-2 mr-0.5" /><span className="truncate text-xs">{item.assigned_to_name.split(' ')[0]}</span></div>)}
                            {!item.isAllDay && (
<div className={`flex items-center mt-0.5 ${isAppTask ? 'text-slate-600' : isGoogleEvent ? 'text-purple-600' : 'text-sky-600'}`}>
  <Clock className="h-2 w-2 mr-0.5" />
  <span className="truncate text-xs">
    {isGoogleTask ? item.description : formatItemTimeRange(item)}
  </span>
</div>

                            )}
                          </div>
                        )
                      })}
                      {dayItems.length > 2 && (<div className="text-xs text-slate-500 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleDayClick(date, dayItems)}>+{dayItems.length - 2} more</div>)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : ( /* List View */
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <div className="p-3 border-b bg-slate-50"><h3 className="font-medium text-sm">Items for {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3></div>
          <div className="divide-y">{(() => {
            const allItems = [...getCurrentMonthTasks(), ...getCurrentMonthEvents(), ...getCurrentMonthGoogleTasks(), ...getCurrentMonthCalendlyEvents()].sort((a, b) => new Date(a.deadline_date || a.start) - new Date(b.deadline_date || b.start))
            if (allItems.length === 0) { return (<div className="p-4 text-center text-slate-500 text-sm">No items scheduled</div>)}
            return allItems.map(item => {
              const isAppTask = item.itemType === 'task', isGoogleEvent = item.itemType === 'event', isGoogleTask = item.itemType === 'google_task', isCalendlyEvent = item.itemType === 'calendly_event';
              const date = new Date(item.deadline_date || item.start);
              const isOverdue = isAppTask && item.task_status !== 'completed' && isPastDate(date);
              return (
                <div key={item.id} className="p-3 cursor-pointer hover:bg-slate-50" onClick={() => handleItemClick(item)}>
                  <div className="flex items-start space-x-2">
                    <div className="mt-1.5">{isAppTask && <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.task_priority)}`} />}{isGoogleEvent && <div className={`w-2 h-2 rounded-full bg-purple-500`} />}{isGoogleTask && <CheckSquare className="h-3 w-3 text-sky-600" />}{isCalendlyEvent && <div className="w-2 h-2 rounded-full bg-orange-500" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-0.5"><h4 className="font-medium text-slate-900 truncate text-sm">{isAppTask ? item.task_name : item.title}</h4>{isAppTask && <span className={`px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(item.task_status)}`}>{item.task_status.replace('_', ' ')}</span>}{isGoogleEvent && <span className="px-1.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border">Event</span>}{isGoogleTask && <span className="px-1.5 py-0.5 rounded-full text-xs bg-sky-100 text-sky-700 border">Task</span>}{isCalendlyEvent && <span className="px-1.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 border">Calendly</span>}{(isGoogleEvent || isGoogleTask) && <ExternalLink className="h-3 w-3 text-slate-400" />}</div>
                      <p className="text-xs text-slate-600 mb-1 line-clamp-1">{isAppTask ? item.task_description : item.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Clock className={`h-3 w-3 ${isOverdue ? 'text-red-500' : ''}`} />
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            {formatDate(date)}
                            {!item.isAllDay && ` at ${formatItemTimeRange(item)}`}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        </div>
                        {isAppTask && item.assigned_to_name && (<div className="flex items-center space-x-1"><User className="h-3 w-3" /><span>{item.assigned_to_name.split(' ')[0]}</span></div>)}
                        {isGoogleEvent && item.location && (<div className="flex items-center space-x-1"><span className="bg-slate-100 px-2 py-0.5 rounded">{item.location}</span></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          })()}</div>
        </div>
      )}

      {/* Legend & Summary */}
      <div className="bg-white p-3 rounded-lg border shadow-sm"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-red-800"></div><span>Urgent Priority</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div><span>High Priority</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span>Medium Priority</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>Low Priority</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span>Google Event</span></div><div className="flex items-center space-x-1.5"><CheckSquare className="h-3 w-3 text-sky-600" /><span>Google Task</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span>Calendly Event</span></div><div className="flex items-center space-x-1.5"><div className="w-2 h-2 bg-blue-50 border"></div><span>Today</span></div><div className="flex items-center space-x-1.5"><AlertTriangle className="h-3 w-3 text-red-500" /><span>Overdue</span></div></div></div>
      <div className="bg-white p-3 rounded-lg border shadow-sm"><h3 className="font-medium mb-2 text-sm">Summary for {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3><div className="grid grid-cols-2 sm:grid-cols-5 gap-2"><div className="text-center p-2 bg-slate-50 rounded"><div className="text-lg font-semibold text-slate-700">{tasks.filter(t=>t.task_status==='pending').length}</div><div className="text-xs text-slate-600">Pending</div></div><div className="text-center p-2 bg-blue-50 rounded"><div className="text-lg font-semibold text-blue-700">{tasks.filter(t=>t.task_status==='in_progress').length}</div><div className="text-xs text-blue-600">In Progress</div></div><div className="text-center p-2 bg-emerald-50 rounded"><div className="text-lg font-semibold text-emerald-700">{tasks.filter(t=>t.task_status==='completed').length}</div><div className="text-xs text-emerald-600">Completed</div></div><div className="text-center p-2 bg-red-50 rounded"><div className="text-lg font-semibold text-red-700">{tasks.filter(t=>t.deadline_date&&t.task_status!=='completed'&&isPastDate(new Date(t.deadline_date))).length}</div><div className="text-xs text-red-600">Overdue</div></div><div className="text-center p-2 bg-purple-50 rounded"><div className="text-lg font-semibold text-purple-700">{calendarEvents.length + googleTasks.length}</div><div className="text-xs text-purple-600">Google Items</div></div></div></div>

      {/* Connection Status Indicator */}
      {isGoogleConnected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <div className="flex items-center space-x-2 text-green-700 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Google Calendar connected - Showing {calendarEvents.length} events and {googleTasks.length} tasks</span>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <OpenTaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} task={selectedTask}  users={users} onClose={handleDialogClose} />
      {dayTasksDialogOpen && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b bg-slate-50"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3><button onClick={handleDayTasksDialogClose} className="text-slate-400 hover:text-slate-600 text-lg font-semibold">×</button></div><p className="text-sm text-slate-600 mt-1">{selectedDateTasks.length} item{selectedDateTasks.length !== 1 ? 's' : ''}</p></div>
            <div className="max-h-96 overflow-y-auto">{selectedDateTasks.map(item => {
              const isAppTask = item.itemType === 'task', isGoogleEvent = item.itemType === 'event', isGoogleTask = item.itemType === 'google_task', isCalendlyEvent = item.itemType === 'calendly_event';
              const isOverdue = isAppTask && item.task_status !== 'completed' && isPastDate(selectedDate);
              return (
                <div key={item.id} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => handleItemSelectFromDay(item)}>
                  <div className="flex items-start space-x-3">
                    <div className="mt-1.5">{isAppTask && <div className={`w-3 h-3 rounded-full ${getPriorityColor(item.task_priority)}`} />}{isGoogleEvent && <div className={`w-3 h-3 rounded-full bg-purple-500`} />}{isGoogleTask && <CheckSquare className="h-4 w-4 text-sky-600" />}{isCalendlyEvent && <div className="w-3 h-3 rounded-full bg-orange-500" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1"><h4 className="font-medium text-slate-900 truncate text-sm">{isAppTask ? item.task_name : item.title}</h4>{isAppTask && <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(item.task_status)}`}>{item.task_status.replace('_', ' ')}</span>}{isGoogleEvent && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border flex items-center gap-1">Event <ExternalLink className="h-2 w-2" /></span>}{isGoogleTask && <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-700 border flex items-center gap-1">Task <ExternalLink className="h-2 w-2" /></span>}{isCalendlyEvent && <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 border flex items-center gap-1">Calendly</span>}</div>
                      {(isAppTask ? item.task_description : item.description) && (<p className="text-xs text-slate-600 mb-2 line-clamp-2">{isAppTask ? item.task_description : item.description}</p>)}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {isOverdue && (<div className="flex items-center space-x-1 text-red-500"><AlertTriangle className="h-3 w-3" /><span className="font-medium">Overdue</span></div>)}
{isGoogleTask ? (item.description) : !item.isAllDay ? (
  <div className={`flex items-center space-x-1 ${isAppTask ? 'text-slate-600' : isGoogleEvent ? 'text-purple-600' : 'text-sky-600'}`}>
    <Clock className="h-3 w-3" />
    <span>{formatItemTimeRange(item)}</span>
  </div>) : null}
                        {isAppTask && item.assigned_to_name && (<div className="flex items-center space-x-1"><User className="h-3 w-3" /><span>{item.assigned_to_name}</span></div>)}
                        {isGoogleEvent && item.location && (<div className="flex items-center space-x-1"><span className="bg-slate-100 px-2 py-0.5 rounded">{item.location}</span></div>)}
                        {isAppTask && (item.lead_name || item.account_name) && (<div className="flex items-center space-x-1"><span className="bg-slate-100 px-2 py-0.5 rounded">{item.lead_name || item.account_name}</span></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}</div>
            <div className="p-3 border-t bg-slate-50 text-center"><p className="text-xs text-slate-600">Click an item to view details or open in Google</p></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarTab