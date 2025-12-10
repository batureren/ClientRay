// utils/loadPlugins.js
export const loadPlugins = async () => {
  const context = import.meta.glob('../plugins/*.{js,jsx,ts,tsx}', { eager: true })
  return Object.values(context)
    .map(mod => mod.default)
    .filter(fn => typeof fn === 'function')
}