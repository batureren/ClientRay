// hooks/useAuth.js
import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api'

// Global refresh promise to prevent multiple simultaneous refresh attempts
let refreshPromise = null

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const refreshIntervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const isMountedRef = useRef(true)

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      updateActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
    }
  }, [updateActivity])

  const logout = useCallback(() => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    // Clear global refresh promise
    refreshPromise = null

    const token = localStorage.getItem('auth_token')
    
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    
    if (isMountedRef.current) {
      setUser(null)
      setError(null)
    }

    // Call server logout endpoint (don't await)
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => console.error('Logout request failed:', err))
    }
  }, [])

  const verifyToken = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.status === 401) {
        // Token is expired or invalid, try to refresh
        const refreshSuccess = await refreshToken()
        return refreshSuccess
      }
      
      if (!response.ok) {
        throw new Error('Token verification failed')
      }
      
      const data = await response.json()
      
      if (isMountedRef.current) {
        setUser(data.user)
        localStorage.setItem('user_data', JSON.stringify(data.user))
      }
      return true
    } catch (error) {
      console.error('Token verification failed:', error)
      logout()
      return false
    }
  }, [logout])

  const refreshToken = useCallback(async () => {
    if (refreshPromise) {
      return await refreshPromise
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      console.log('No token found, cannot refresh')
      return false
    }

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Token refresh failed')
        }
        
        const data = await response.json()
        
        // Update stored token and user data
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user_data', JSON.stringify(data.user))
        
        if (isMountedRef.current) {
          setUser(data.user)
        }
        
        console.log('Token refreshed successfully')
        return true
        
      } catch (error) {
        console.error('Token refresh failed:', error)
        logout()
        return false
      } finally {
        refreshPromise = null
      }
    })()

    return await refreshPromise
  }, [logout])

  const startTokenRefresh = useCallback(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Refresh token every 45 minutes (token expires in 1 hour)
    refreshIntervalRef.current = setInterval(async () => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivityRef.current
      const maxInactiveTime = 30 * 60 * 1000

      if (timeSinceActivity > maxInactiveTime) {
        console.log('User inactive for too long, logging out')
        logout()
        return
      }

      console.log('Periodic token refresh...')
      await refreshToken()
    }, 45 * 60 * 1000)
  }, [logout, refreshToken])

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token')
      const userData = localStorage.getItem('user_data')
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData)
          if (isMountedRef.current) {
            setUser(parsedUser)
          }
          // Verify token is still valid
          await verifyToken(token)
          // Start refresh interval
          startTokenRefresh()
        } catch (error) {
          console.error('Error parsing stored user data:', error)
          logout()
        }
      }
      
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [verifyToken, startTokenRefresh, logout])

  const login = async (credentials) => {
    if (!isMountedRef.current) return { success: false, error: 'Component unmounted' }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      
      // Store token and user data
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_data', JSON.stringify(data.user))
      
      if (isMountedRef.current) {
        setUser(data.user)
      }
      
      updateActivity() // Mark as active
      startTokenRefresh() // Start the refresh cycle
      
      return { success: true, user: data.user }
      
    } catch (error) {
      console.error('Login error:', error)
      if (isMountedRef.current) {
        setError(error.message)
      }
      return { success: false, error: error.message }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }, [])

  const isAuthenticated = useCallback(() => {
    return !!user && !!localStorage.getItem('auth_token')
  }, [user])

  const hasRole = useCallback((role) => {
    return user && user.role === role
  }, [user])

  const hasPermission = useCallback((permission) => {
    if (!user) return false
    
    // Admin has all permissions
    if (user.role === 'admin') return true
    
    // Define role-based permissions
    const rolePermissions = {
      manager: ['read', 'write', 'delete', 'export'],
      user: ['read', 'write'],
    }
    
    return rolePermissions[user.role]?.includes(permission) || false
  }, [user])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    isAuthenticated,
    hasRole,
    hasPermission,
    getAuthHeader,
    clearError: () => setError(null)
  }
}