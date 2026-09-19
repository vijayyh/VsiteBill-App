import { Navigate } from 'react-router-dom'
import { useSession, type Role } from '../lib/session'

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useSession()

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />

  return <>{children}</>
}
