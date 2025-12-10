// src/plugins/WeatherWidget.jsx
import { useEffect, useState } from 'react'

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        )
        const data = await res.json()
        setWeather(data.current_weather)
      } catch (err) {
        setError('Failed to fetch weather data')
      } finally {
        setLoading(false)
      }
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        fetchWeather(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setError('Permission denied or unable to retrieve location')
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>
  if (!weather) return <div className="text-sm text-red-500">Weather unavailable</div>

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
      <span>🌡 {weather.temperature}°C</span>
      <span>💨 {weather.windspeed} km/h</span>
    </div>
  )
}