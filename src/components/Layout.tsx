import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Clock, Users, Settings, BarChart3, CheckSquare, User } from 'lucide-react'
import { clsx } from 'clsx'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, isConsultant } = useAuth()
  const location = useLocation()

  const navigation = [
    // Consultant-only navigation
    { name: 'My Timesheets', href: '/consultant/timesheets', icon: Clock, show: isConsultant, description: 'Manage your weekly timesheets' },
    { name: 'Timesheet History', href: '/consultant/history', icon: BarChart3, show: isConsultant, description: 'View your submitted timesheets' },
    
    // Super Admin-only navigation
    { name: 'Projects', href: '/admin/projects', icon: BarChart3, show: isAdmin, description: 'Manage projects and codes' },
    { name: 'Approvals', href: '/admin/approvals', icon: CheckSquare, show: isAdmin, description: 'Review and approve timesheets' },
    { name: 'Users', href: '/admin/users', icon: Users, show: isAdmin, description: 'Manage consultant users' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, show: isAdmin, description: 'Configure rates and system settings' },
  ].filter(item => item.show)

  const isCurrentPath = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-3">
                <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="company-logo company-logo-header" />
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-3 px-4 py-2 rounded-lg bg-card/50 border border-border/50">
                <div className="p-1.5 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'super_admin' ? 'Administrator' : 'Consultant'}
                  </p>
                </div>
              </div>
              
              {/* Sign Out Button */}
              <button
                onClick={signOut}
                className="interactive p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 group"
                title="Sign out"
              >
                <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 min-h-screen glass-card border-r border-border/50 custom-scrollbar">
          <div className="p-6">
            {/* Sidebar Logo */}
            <div className="flex justify-center mb-6">
              <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="company-logo company-logo-sidebar" />
            </div>
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const current = isCurrentPath(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 interactive',
                      {
                        'bg-primary text-primary-foreground shadow-lg shadow-primary/25': current,
                        'text-muted-foreground hover:text-foreground hover:bg-accent/50': !current,
                      }
                    )}
                    title={item.description}
                  >
                    <Icon
                      className={clsx(
                        'mr-3 h-5 w-5 transition-all duration-200',
                        {
                          'text-primary-foreground': current,
                          'text-muted-foreground group-hover:text-foreground group-hover:scale-110': !current,
                        }
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      {!current && (
                        <p className="text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {current && (
                      <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}