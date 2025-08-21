import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  isAdmin: boolean
  isConsultant: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        if (error || !authUser) {
          setUser(null)
          return
        }

        // Get user profile from our users table
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle()

        if (profileError) {
          console.error('Error loading user profile:', profileError)
          setUser(null)
          return
        }

        setUser(userProfile)
      } catch (error) {
        console.error('Error in loadUser:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          try {
            // Get user profile from our users table
            const { data: userProfile, error } = await supabase
              .from('users')
              .select('*')
              .eq('email', session.user.email)
              .maybeSingle()
            
            if (error) {
              console.error('Error loading user profile in auth listener:', error)
              setUser(null)
            } else {
              setUser(userProfile)
            }
          } catch (error) {
            console.error('Error in auth state change listener:', error)
            setUser(null)
          }
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
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAdmin, isConsultant }}>
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