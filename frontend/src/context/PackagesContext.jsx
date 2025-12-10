import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '@/services/api'

const PackagesContext = createContext()

export const usePackages = () => {
  const context = useContext(PackagesContext)
  if (!context) {
    throw new Error('usePackages must be used within a PackagesProvider')
  }
  return context
}

export const PackagesProvider = ({ children }) => {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enabledPackages, setEnabledPackages] = useState(new Set())
  const [initialized, setInitialized] = useState(false)

  // Fetch all packages
  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use api instance instead of fetch - it has auth headers and interceptors
      const response = await api.get('/packages')
      const data = response.data
      
      setPackages(data)
      
      // Update enabled packages set for quick lookups
      const enabled = new Set(
        data.filter(pkg => pkg.is_enabled && pkg.status === 'active').map(pkg => pkg.name)
      )
      setEnabledPackages(enabled)
      
      if (!initialized) {
        setInitialized(true)
      }
      
    } catch (err) {
      console.error('Error fetching packages:', err)
      setError(err.message)
      
      if (!initialized) {
        setInitialized(true)
      }
    } finally {
      setLoading(false)
    }
  }, [initialized])

  // Fetch specific package details
  const fetchPackage = async (name) => {
    try {
      const response = await api.get(`/packages/${name}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching package ${name}:`, error)
      throw error
    }
  }

  // Update package configuration
  const updatePackage = async (name, data) => {
    console.log(`Updating package: ${name}`, data)
    
    try {
      const response = await api.put(`/packages/${name}`, data)
      
      console.log('Update response:', response.data)
      
      // Refresh packages list
      console.log('Refreshing packages list...')
      await fetchPackages()
      
      return response.data
      
    } catch (error) {
      console.error(`Error updating package ${name}:`, error)
      
      // Provide more specific error messages based on common issues
      if (error.response) {
        // Server responded with error status
        const status = error.response.status
        const errorMessage = error.response.data?.error || error.response.data?.message || error.message
        
        if (status === 404) {
          throw new Error('Package not found')
        } else if (status === 400) {
          throw new Error(`Invalid package configuration: ${errorMessage}`)
        } else if (status === 401) {
          throw new Error('Authentication required')
        } else if (status === 500) {
          throw new Error('Server error: Please check server logs')
        } else {
          throw new Error(errorMessage)
        }
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Network error: Unable to connect to server')
      } else {
        // Something else happened
        throw error
      }
    }
  }

  // Test package connection
  const testPackage = async (name) => {
    try {
      const response = await api.post(`/packages/${name}/test`)
      
      // Refresh packages to get updated status
      await fetchPackages()
      
      return response.data
    } catch (error) {
      console.error(`Error testing package ${name}:`, error)
      throw error
    }
  }

  // Get package logs
  const getPackageLogs = async (name, limit = 50, offset = 0) => {
    try {
      const response = await api.get(`/packages/${name}/logs`, {
        params: { limit, offset }
      })
      return response.data
    } catch (error) {
      console.error(`Error fetching logs for package ${name}:`, error)
      throw error
    }
  }

  // Check if a specific package is enabled and active
  const isPackageEnabled = useCallback((packageName) => {
    return enabledPackages.has(packageName)
  }, [enabledPackages])

  // Get active package configuration for runtime use
  const getPackageConfig = useCallback((packageName) => {
    const pkg = packages.find(p => p.name === packageName)
    if (!pkg || !pkg.is_enabled || pkg.status !== 'active') {
      return null
    }
    
    return {
      name: pkg.name,
      displayName: pkg.display_name,
      config: pkg.config ? JSON.parse(pkg.config) : {},
      status: pkg.status,
      lastSync: pkg.last_sync,
      version: pkg.version
    }
  }, [packages])

  // Execute API call through a package (helper function)
  const executePackageAPI = async (packageName, endpoint, options = {}) => {
    if (!isPackageEnabled(packageName)) {
      throw new Error(`Package ${packageName} is not enabled or active`)
    }

    const config = getPackageConfig(packageName)
    if (!config) {
      throw new Error(`Package ${packageName} configuration not found`)
    }

    return {
      packageName,
      endpoint,
      options,
      config: config.config,
      timestamp: new Date().toISOString()
    }
  }

  // Get enabled packages by category
  const getEnabledPackagesByCategory = useCallback((category) => {
    return packages.filter(pkg => 
      pkg.category === category && 
      pkg.is_enabled && 
      pkg.status === 'active'
    )
  }, [packages])

  // Get package statistics
  const getPackageStats = useCallback(() => {
    const stats = {
      total: packages.length,
      enabled: enabledPackages.size,
      disabled: packages.length - enabledPackages.size,
      byCategory: {},
      byStatus: {
        active: 0,
        inactive: 0,
        error: 0,
        pending: 0
      }
    }

    packages.forEach(pkg => {
      // Category stats
      if (!stats.byCategory[pkg.category]) {
        stats.byCategory[pkg.category] = { total: 0, enabled: 0 }
      }
      stats.byCategory[pkg.category].total++
      if (pkg.is_enabled && pkg.status === 'active') {
        stats.byCategory[pkg.category].enabled++
      }

      // Status stats
      if (stats.byStatus[pkg.status] !== undefined) {
        stats.byStatus[pkg.status]++
      }
    })

    return stats
  }, [packages, enabledPackages])

  // Initialize packages on mount - but wait a bit for auth to be ready
  useEffect(() => {
    // Small delay to let auth initialize
    const timer = setTimeout(() => {
      fetchPackages()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [fetchPackages])

  // Auto-refresh packages every 5 minutes (only if initialized)
  useEffect(() => {
    if (!initialized) return
    
    const interval = setInterval(fetchPackages, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPackages, initialized])

  const contextValue = {
    // State
    packages,
    loading,
    error,
    enabledPackages,
    initialized,

    // Actions
    fetchPackages,
    fetchPackage,
    updatePackage,
    testPackage,
    getPackageLogs,

    // Utilities
    isPackageEnabled,
    getPackageConfig,
    executePackageAPI,
    getEnabledPackagesByCategory,
    getPackageStats,

    // Refresh function for manual updates
    refresh: fetchPackages
  }

  return (
    <PackagesContext.Provider value={contextValue}>
      {children}
    </PackagesContext.Provider>
  )
}