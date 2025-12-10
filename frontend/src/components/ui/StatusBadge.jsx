import { Badge } from '@/components/ui/badge.jsx'

export const getStatusBadge = (status) => {
  if (typeof status !== 'string') return null; // or return a fallback Badge

  const variants = {
    new: 'default',
    contacted: 'secondary',
    qualified: 'outline',
    converted: 'default',
    lost: 'destructive'
  }

  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1)

  return <Badge variant={variants[status] || 'default'}>{formattedStatus}</Badge>
}