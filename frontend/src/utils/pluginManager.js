// frontend/utils/pluginManager.js
import { loadPlugins } from './loadPlugins'

let allPlugins = []
let activePlugins = {}

export const initPluginManager = async () => {
  allPlugins = await loadPlugins()

  const saved = JSON.parse(localStorage.getItem('enabledPlugins') || '{}')

  allPlugins.forEach(plugin => {
    const enabled = saved[plugin.id] ?? plugin.enabledByDefault
    if (enabled) enablePlugin(plugin.id, false)
  })

  return allPlugins
}

export const enablePlugin = (pluginId, save = true) => {
  const plugin = allPlugins.find(p => p.id === pluginId)
  if (!plugin || activePlugins[pluginId]) return

  plugin.onLoad?.()
  activePlugins[pluginId] = plugin

  if (save) savePluginState(pluginId, true)
}

export const disablePlugin = (pluginId, save = true) => {
  const plugin = activePlugins[pluginId]
  if (!plugin) return

  plugin.onUnload?.()
  delete activePlugins[pluginId]

  if (save) savePluginState(pluginId, false)
}

export const savePluginState = (pluginId, isEnabled) => {
  const saved = JSON.parse(localStorage.getItem('enabledPlugins') || '{}')
  saved[pluginId] = isEnabled
  localStorage.setItem('enabledPlugins', JSON.stringify(saved))
}

export const getAllPlugins = () => allPlugins
export const getActivePlugins = () => Object.values(activePlugins)