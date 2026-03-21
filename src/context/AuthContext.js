import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const ROLES = {
  OWNER:   'owner',
  MANAGER: 'manager',
  CAPTAIN: 'captain',
}

export const ROLE_PERMISSIONS = {
  owner: {
    dashboard: true,  orders: true,   tables: true,
    billing:   true,  menu:   true,   inventory: true,
    reports:   true,  settings: true, staff: true,
    kds:       true,
  },
  manager: {
    dashboard: true,  orders: true,   tables: true,
    billing:   true,  menu:   true,   inventory: true,
    reports:   true,  settings: true, staff: false,
    kds:       true,
    reportsMaxDays: 7,   // manager can only see up to 7 days of reports
  },
  captain: {
    dashboard: true,  orders: true,   tables: true,
    billing:   true,  menu:   false,  inventory: false,
    reports:   false, settings: false, staff: false,
    kds:       false,
  },
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

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

  function can(module) {
    if (!profile?.role) return false
    return !!ROLE_PERMISSIONS[profile.role]?.[module]
  }

  // Returns max days for reports (null = unlimited)
  function reportsMaxDays() {
    return ROLE_PERMISSIONS[profile?.role]?.reportsMaxDays ?? null
  }

  const value = { user, profile, loading, signIn, signOut, can, reportsMaxDays, ROLES }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)