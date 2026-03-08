import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// ─── ROLE DEFINITIONS ─────────────────────────────────────────────────────────
export const ROLES = {
  OWNER:   'owner',
  MANAGER: 'manager',
  CAPTAIN: 'captain',
  BILLER:  'biller',
}

// What each role can access
export const ROLE_PERMISSIONS = {
  owner: {
    dashboard: true,   orders: true,   tables: true,
    billing: true,     menu: true,     inventory: true,
    reports: true,     settings: true, staff: true,
    kds: true,
  },
  manager: {
    dashboard: true,   orders: true,   tables: true,
    billing: true,     menu: true,     inventory: true,
    reports: true,     settings: false, staff: false,
    kds: true,
  },
  captain: {
    dashboard: true,   orders: true,   tables: 'own',
    billing: false,    menu: false,    inventory: false,
    reports: false,    settings: false, staff: false,
    kds: false,
  },
  biller: {
    dashboard: true,   orders: 'view', tables: true,
    billing: true,     menu: false,    inventory: false,
    reports: false,    settings: false, staff: false,
    kds: false,
  },
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)  // role, name, etc from our staff table
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role, avatar_url, is_active')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Check if current role has permission for a module
  function can(module) {
    if (!profile?.role) return false
    return !!ROLE_PERMISSIONS[profile.role]?.[module]
  }

  const value = { user, profile, loading, signIn, signOut, can, ROLES }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
