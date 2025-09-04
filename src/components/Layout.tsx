import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Clock, Users, BarChart3, CheckSquare, User, Menu, X, Settings, Calculator, MapPin, DollarSign, Receipt } from 'lucide-react'
import { clsx } from 'clsx'
import { useIsMobile } from '../hooks/use-mobile'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, isConsultant } = useAuth()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const navigation = [
    // Consultant-only navigation
    { name: 'My Timesheets', href: '/consultant/timesheets', icon: Clock, show: isConsultant, description: 'Manage your weekly timesheets' },
    { name: 'Timesheet History', href: '/consultant/history', icon: BarChart3, show: isConsultant, description: 'View your submitted timesheets' },
    
    // Super Admin-only navigation
    { name: 'Projects', href: '/admin/projects', icon: BarChart3, show: isAdmin, description: 'Manage projects and codes' },
    { name: 'Approvals', href: '/admin/approvals', icon: CheckSquare, show: isAdmin, description: 'Review and approve timesheets' },
    { name: 'Users', href: '/admin/users', icon: Users, show: isAdmin, description: 'Manage consultant users' },
    { name: 'VAT Configuration', href: '/admin/vat-settings', icon: Calculator, show: isAdmin, description: 'Configure VAT rates for expense types' },
    { name: 'Country Rates', href: '/admin/country-rates', icon: MapPin, show: isAdmin, description: 'Manage daily allowance rates by country' },
    { name: 'Currency Settings', href: '/admin/currency-settings', icon: DollarSign, show: isAdmin, description: 'Configure default application currency' },
    { name: 'Travel Reports', href: '/admin/travel-reports', icon: Receipt, show: isAdmin, description: 'Generate and send travel expense reports' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, show: isAdmin, description: 'Configure rates and system settings' },
  ].filter(item => item.show)

  const isCurrentPath = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {/* Mobile hamburger menu */}
              {isMobile && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="interactive p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}
              
              <Link to="/" className="flex items-center space-x-3">
                <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="h-8 w-auto" />
              </Link>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2 sm:space-x-3 px-2 sm:px-4 py-2 rounded-lg bg-card/50 border border-border/50">
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
                {/* Mobile: Show only role */}
                <div className="sm:hidden">
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'super_admin' ? 'Admin' : 'User'}
                  </p>
                </div>
              </div>
              
              {/* Sign Out Button */}
              <button
                onClick={signOut}
                className="interactive p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 group min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <nav className={clsx(
          "min-h-screen glass-card border-r border-border/50 custom-scrollbar transition-all duration-300",
          {
            "w-64": !isMobile,
            "hidden": isMobile,
          }
        )}>
          <div className="p-6">
            {/* Sidebar Logo */}
            <div className="flex justify-center mb-6">
              <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="h-12 w-auto" />
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
                      'group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 interactive min-h-[48px]',
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
        
        {/* Mobile Sidebar Drawer */}
        <nav className={clsx(
          "fixed top-0 left-0 h-full w-80 glass-card border-r border-border/50 custom-scrollbar transition-all duration-300 z-50 lg:hidden",
          {
            "translate-x-0": isMobile && isSidebarOpen,
            "-translate-x-full": isMobile && !isSidebarOpen,
          }
        )}>
          <div className="p-6">
            {/* Mobile sidebar header */}
            <div className="flex items-center justify-between mb-6">
              <img src="/images/logo.png" alt="SCHWARZENBERG.TECH Logo" className="h-10 w-auto" />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="interactive p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* User info in mobile sidebar */}
            <div className="mb-6 p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'super_admin' ? 'Administrator' : 'Consultant'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const current = isCurrentPath(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={clsx(
                      'group flex items-center px-4 py-4 text-sm font-medium rounded-xl transition-all duration-200 interactive min-h-[52px]',
                      {
                        'bg-primary text-primary-foreground shadow-lg shadow-primary/25': current,
                        'text-muted-foreground hover:text-foreground hover:bg-accent/50': !current,
                      }
                    )}
                  >
                    <Icon
                      className={clsx(
                        'mr-4 h-6 w-6 transition-all duration-200',
                        {
                          'text-primary-foreground': current,
                          'text-muted-foreground group-hover:text-foreground group-hover:scale-110': !current,
                        }
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-base">{item.name}</p>
                      <p className="text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    {current && (
                      <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                    )}
                  </Link>
                )
              })}
            </div>
            
            {/* Sign out in mobile sidebar */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <button
                onClick={() => {
                  setIsSidebarOpen(false)
                  signOut()
                }}
                className="interactive w-full flex items-center px-4 py-4 text-sm font-medium rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 min-h-[52px]"
              >
                <LogOut className="mr-4 h-6 w-6" />
                <span className="text-base">Sign Out</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}