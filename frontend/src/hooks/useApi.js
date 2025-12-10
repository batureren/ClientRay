// hooks/useApi.js
import { useState, useCallback } from 'react'

const API_BASE = '/api'

// Import the same refresh promise from useAuth to prevent conflicts
let refreshPromise = null

export const useApi = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Get auth headers
  const getAuthHeaders = (isFormData = false) => {
    const token = localStorage.getItem('auth_token')
    const headers = {}
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }
    
    return headers
  }

  // Refresh token function (shared with useAuth)
  const refreshToken = async () => {
    if (refreshPromise) {
      return await refreshPromise
    }

    const token = localStorage.getItem('auth_token')
    if (!token) return false

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
          const errorData = await response.json()
          throw new Error(errorData.error || 'Token refresh failed')
        }
        
        const data = await response.json()
        
        // Update stored token and user data
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user_data', JSON.stringify(data.user))
        
        // Dispatch custom event to notify useAuth about the update
        window.dispatchEvent(new CustomEvent('tokenRefreshed', { 
          detail: { user: data.user, token: data.token } 
        }))
        
        console.log('Token refreshed successfully')
        return true
        
      } catch (error) {
        console.error('Token refresh failed:', error)
        return false
      } finally {
        refreshPromise = null
      }
    })()

    return await refreshPromise
  }

  const apiCall = async (endpoint, options = {}, retryCount = 0) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const isFormData = options.body instanceof FormData
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          ...getAuthHeaders(isFormData),
          ...options.headers,
        },
        ...options,
      })
      
      // Handle 401 - Unauthorized
      if (response.status === 401 && retryCount === 0) {
        console.log('Token expired, attempting refresh...')
        const refreshSuccess = await refreshToken()
        
        if (refreshSuccess) {
          // Retry the original request with new token
          console.log('Retrying request with refreshed token...')
          return await apiCall(endpoint, options, 1) 
        } else {
          console.log('Authentication failed, logging out...')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
          window.dispatchEvent(new CustomEvent('authenticationFailed'))
          throw new Error('Authentication failed')
        }
      }
      
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
        window.dispatchEvent(new CustomEvent('authenticationFailed'))
        throw new Error('Authentication failed')
      }
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error)
      setError(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Specific method for deleting leads with better error handling
  const deleteLead = async (leadId) => {
    try {
      const result = await apiCall(`/leads/${leadId}`, { method: 'DELETE' })
      console.log('Lead deleted successfully:', result)
      return result
    } catch (error) {
      console.error('Failed to delete lead:', error)
      throw error
    }
  }

  // Method for batch deleting leads
  const deleteLeads = async (leadIds) => {
    try {
      const result = await apiCall('/leads/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids: leadIds })
      })
      console.log('Batch delete result:', result)
      return result
    } catch (error) {
      console.error('Failed to batch delete leads:', error)
      throw error
    }
  }

  // Heartbeat function to keep session alive
  const heartbeat = useCallback(async () => {
    try {
      await apiCall('/auth/verify')
      return true
    } catch (error) {
      console.error('Heartbeat failed:', error)
      return false
    }
  }, [])

  return {
    get: (endpoint) => apiCall(endpoint),
    post: (endpoint, data) => apiCall(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    put: (endpoint, data) => apiCall(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    // Updated delete method to support request body
    delete: (endpoint, data) => apiCall(endpoint, {
      method: 'DELETE',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    }),
    deleteLead,
    deleteLeads,
    heartbeat,
    refreshToken,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}