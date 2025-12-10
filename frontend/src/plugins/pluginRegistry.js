// src/plugins/pluginRegistry.js
import WeatherWidget from './WeatherWidget.jsx'
// import OtherPlugin from './OtherPlugin.jsx'

export const plugins = [
  {
    id: 'weather-widget',
    name: 'Weather Widget',
    description: 'Displays current weather based on your location.',
    enabledByDefault: true,
    component: WeatherWidget,
  },
  // Add more plugins here like:
  // {
  //   id: 'other-plugin',
  //   name: 'Other Plugin',
  //   description: 'Some other plugin.',
  //   enabledByDefault: false,
  //   component: OtherPlugin,
  // },
]