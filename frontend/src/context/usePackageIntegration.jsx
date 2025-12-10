//src/context/usePackageIntegration.jsx

import { useState, useCallback } from 'react'
import { usePackages } from './PackagesContext'

export const usePackageIntegration = () => {
  const { isPackageEnabled, getPackageConfig, executePackageAPI } = usePackages()
  const [loading, setLoading] = useState({})
  const [errors, setErrors] = useState({})

  // Generic API call function
  const callPackageAPI = useCallback(async (packageName, endpoint, options = {}) => {
    if (!isPackageEnabled(packageName)) {
      throw new Error(`${packageName} is not enabled or configured`)
    }

    setLoading(prev => ({ ...prev, [packageName]: true }))
    setErrors(prev => ({ ...prev, [packageName]: null }))

    try {
      const response = await fetch(`/api/packages/${packageName}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint, options })
      })

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      setErrors(prev => ({ ...prev, [packageName]: error.message }))
      throw error
    } finally {
      setLoading(prev => ({ ...prev, [packageName]: false }))
    }
  }, [isPackageEnabled])

  // Calendly Integration
  const calendly = {
    isEnabled: () => isPackageEnabled('calendly'),
    
    getAvailability: async (userUri, startTime, endTime) => {
      return await callPackageAPI('calendly', 'get-availability', {
        userUri,
        startTime,
        endTime
      })
    },

    createMeeting: async (eventTypeUri, startTime, inviteeEmail, inviteeName) => {
      return await callPackageAPI('calendly', 'create-meeting', {
        eventTypeUri,
        startTime,
        inviteeEmail,
        inviteeName
      })
    },

    getMeetings: async (userUri, startTime, endTime) => {
      return await callPackageAPI('calendly', 'get-meetings', {
        userUri,
        startTime,
        endTime
      })
    },

    cancelMeeting: async (meetingUri, reason = '') => {
      return await callPackageAPI('calendly', 'cancel-meeting', {
        meetingUri,
        reason
      })
    },

    getEventTypes: async (userUri) => {
      return await callPackageAPI('calendly', 'get-event-types', {
        userUri
      })
    },

    getUser: async () => {
      return await callPackageAPI('calendly', 'get-user', {})
    },

    getInvitees: async (eventUri) => {
      return await callPackageAPI('calendly', 'get-invitees', {
        eventUri
      })
    }
  }

  // Get integration status for UI
  const getIntegrationStatus = () => {
    return {
      calendly: {
        enabled: calendly.isEnabled(),
        loading: loading.calendly || false,
        error: errors.calendly || null
      }
    }
  }

  // Clear errors
  const clearError = (packageName) => {
    setErrors(prev => ({ ...prev, [packageName]: null }))
  }

  const clearAllErrors = () => {
    setErrors({})
  }

  return {
    // Calendly integration
    calendly,
    
    // Utility functions
    getIntegrationStatus,
    clearError,
    clearAllErrors,
    
    // Generic API caller
    callPackageAPI,
    
    // Loading and error states
    loading,
    errors
  }
}