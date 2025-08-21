import React, { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'
import { Clock, Mail, Lock, AlertCircle } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password) {
      setError('Please enter both email and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      await signIn(email.trim(), password)
      // Success! The AuthContext will handle navigation
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'Login failed. Please check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />
      
      <div className="relative max-w-md w-full space-y-8">
        {/* Login Card */}
        <div className="modern-card glass-card p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="company-logo company-logo-login" />
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight mb-3">
              Welcome Back
            </h2>
            <p className="text-base text-muted-foreground font-medium">
              Sign in to manage your timesheets
            </p>
          </div>
          
          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 animate-in fade-in duration-300">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-6">
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('') // Clear error on input change
                }}
                placeholder=" "
                required
                autoComplete="email"
                variant="floating"
                className="premium-focus"
                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('') // Clear error on input change
                }}
                placeholder=" "
                required
                autoComplete="current-password"
                variant="floating"
                className="premium-focus"
                icon={<Lock className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
                variant="primary"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>

            {/* Test Credentials Helper */}
            <div className="bg-info/10 border border-info/20 rounded-lg p-4">
              <div className="text-center">
                <p className="text-xs text-info font-medium mb-1">Test Credentials</p>
                <p className="text-xs font-semibold mb-1">Admin User:</p>
                <p className="text-xs text-muted-foreground">Email: admin@timesheet.com</p>
                <p className="text-xs text-muted-foreground mb-2">Password: Admin123!</p>
                <p className="text-xs font-semibold mb-1">Consultant User:</p>
                <p className="text-xs text-muted-foreground">Email: consultant@timesheet.com</p>
                <p className="text-xs text-muted-foreground">Password: Consultant123!</p>
              </div>
            </div>
          </form>
        </div>
        
        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            SCHWARZENBERG.TECH Timesheet System
          </p>
        </div>
      </div>
    </div>
  )
}