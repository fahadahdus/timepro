import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  refreshSessionIfNeeded: () => Promise<boolean>
  isAdmin: boolean
  isConsultant: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper function to load user profile
  const loadUserProfile = async (authUser: any) => {
    if (!authUser?.email) {
      setUser(null)
      return
    }

    try {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle()

      if (error) {
        console.error('Error loading user profile:', error)
        setUser(null)
      } else {
        setUser(userProfile)
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error)
      setUser(null)
    }
  }

  // Helper function to refresh session when needed
  const refreshSessionIfNeeded = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        return false
      }

      if (session) {
        // Check if session is about to expire (within 5 minutes)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
        const timeUntilExpiry = expiresAt - Date.now()
        
        if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
          console.log('Session expiring soon, refreshing...')
          const { data, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError)
            return false
          }
          
          if (data.session) {
            console.log('Session refreshed successfully')
            return true
          }
        }
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error in refreshSessionIfNeeded:', error)
      return false
    }
  }

  useEffect(() => {
    // Load user on mount (one-time check)
    async function loadUser() {
      setLoading(true)
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        if (error || !authUser) {
          setUser(null)
        } else {
          await loadUserProfile(authUser)
        }
      } catch (error) {
        console.error('Error in loadUser:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    // Set up auth listener - KEEP SIMPLE, avoid any async operations in callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // NEVER use any async operations in callback
        if (session?.user) {
          // Load user profile in a separate async function outside the callback
          loadUserProfile(session.user)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      
      if (error) {
        console.error('Sign in error:', error)
        throw error
      }
      
      return data
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw new Error(error.message || 'Login failed. Please check your credentials.')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const isAdmin = user?.role === 'super_admin'
  const isConsultant = user?.role === 'consultant'

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshSessionIfNeeded, isAdmin, isConsultant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}