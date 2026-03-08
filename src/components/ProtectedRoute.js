import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Redirects to /login if not authenticated
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="splash">Loading...</div>
  if (!user)   return <Navigate to="/login" replace />

  return children
}

// Redirects to /dashboard if role doesn't have access to a module
export function RoleRoute({ module, children }) {
  const { can, loading } = useAuth()

  if (loading)    return <div className="splash">Loading...</div>
  if (!can(module)) return <Navigate to="/dashboard" replace />

  return children
}
