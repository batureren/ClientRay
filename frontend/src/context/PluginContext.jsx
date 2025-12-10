import { createContext, useContext, useEffect, useState } from 'react'
import { plugins as allPlugins } from '../plugins/pluginRegistry'

const PluginContext = createContext()

export function PluginProvider({ children }) {
  // Load enabled plugins from localStorage with error handling
  const [enabledPlugins, setEnabledPlugins] = useState(() => {
    try {
      const stored = localStorage.getItem('enabledPlugins')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate that parsed is an object
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      }
    } catch (error) {
      console.error('Error loading enabled plugins from localStorage:', error)
    }
    
    // Default all plugins enabled state
    const defaults = {}
    allPlugins.forEach(p => {
      defaults[p.id] = p.enabledByDefault ?? false
    })
    return defaults
  })

  const [initialized, setInitialized] = useState(false)

  // Save changes to localStorage with error handling
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      return
    }

    try {
      localStorage.setItem('enabledPlugins', JSON.stringify(enabledPlugins))
    } catch (error) {
      console.error('Error saving enabled plugins to localStorage:', error)
    }
  }, [enabledPlugins, initialized])

  // Toggle plugin enabled state
  const togglePlugin = (id) => {
    setEnabledPlugins(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Set specific plugin state
  const setPluginEnabled = (id, enabled) => {
    setEnabledPlugins(prev => ({
      ...prev,
      [id]: enabled,
    }))
  }

  // Enable all plugins
  const enableAllPlugins = () => {
    const allEnabled = {}
    allPlugins.forEach(p => {
      allEnabled[p.id] = true
    })
    setEnabledPlugins(allEnabled)
  }

  // Disable all plugins
  const disableAllPlugins = () => {
    const allDisabled = {}
    allPlugins.forEach(p => {
      allDisabled[p.id] = false
    })
    setEnabledPlugins(allDisabled)
  }

  // Reset to defaults
  const resetToDefaults = () => {
    const defaults = {}
    allPlugins.forEach(p => {
      defaults[p.id] = p.enabledByDefault ?? false
    })
    setEnabledPlugins(defaults)
  }

  // Filter only enabled plugins with component
  const plugins = allPlugins
    .filter(p => enabledPlugins[p.id] && p.component)
    .map(p => p.component)

  // Get enabled plugin count
  const enabledCount = Object.values(enabledPlugins).filter(Boolean).length

  const contextValue = {
    enabledPlugins,
    togglePlugin,
    setPluginEnabled,
    enableAllPlugins,
    disableAllPlugins,
    resetToDefaults,
    plugins,
    allPlugins,
    enabledCount,
    totalCount: allPlugins.length
  }

  return (
    <PluginContext.Provider value={contextValue}>
      {children}
    </PluginContext.Provider>
  )
}

export function usePlugins() {
  const context = useContext(PluginContext)
  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider')
  }
  return context
}