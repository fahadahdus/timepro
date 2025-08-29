import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { TimesheetPage } from './pages/TimesheetPage'
import { TimesheetHistoryPage } from './pages/TimesheetHistoryPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { VatSettingsPage } from './pages/VatSettingsPage'
import { CountryRatesPage } from './pages/CountryRatesPage'
import { CurrencySettingsPage } from './pages/CurrencySettingsPage'

const queryClient = new QueryClient()

function ProtectedRoute({ children, requireAdmin = false, requireConsultant = false }: { 
  children: React.ReactNode
  requireAdmin?: boolean
  requireConsultant?: boolean
}) {
  const { user, loading, isAdmin, isConsultant } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  // Role-based access control
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/consultant/timesheets" replace />
  }
  
  if (requireConsultant && !isConsultant) {
    return <Navigate to="/admin/projects" replace />
  }
  
  return <Layout>{children}</Layout>
}

function AppContent() {
  const { user, isAdmin, isConsultant } = useAuth()
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? (
          isAdmin ? <Navigate to="/admin/projects" replace /> : <Navigate to="/consultant/timesheets" replace />
        ) : <LoginPage />} 
      />
      
      {/* Consultant Routes */}
      <Route path="/consultant/timesheets" element={
        <ProtectedRoute requireConsultant={true}>
          <TimesheetPage />
        </ProtectedRoute>
      } />
      
      <Route path="/consultant/history" element={
        <ProtectedRoute requireConsultant={true}>
          <TimesheetHistoryPage />
        </ProtectedRoute>
      } />
      
      {/* Super Admin Routes */}
      <Route path="/admin/projects" element={
        <ProtectedRoute requireAdmin={true}>
          <ProjectsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/approvals" element={
        <ProtectedRoute requireAdmin={true}>
          <ApprovalsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users" element={
        <ProtectedRoute requireAdmin={true}>
          <UsersPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/settings" element={
        <ProtectedRoute requireAdmin={true}>
          <SettingsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/vat-settings" element={
        <ProtectedRoute requireAdmin={true}>
          <VatSettingsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/country-rates" element={
        <ProtectedRoute requireAdmin={true}>
          <CountryRatesPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/currency-settings" element={
        <ProtectedRoute requireAdmin={true}>
          <CurrencySettingsPage />
        </ProtectedRoute>
      } />
      
      {/* Redirect to role-specific home page */}
      <Route path="/" element={
        user ? (
          isAdmin ? <Navigate to="/admin/projects" replace /> : <Navigate to="/consultant/timesheets" replace />
        ) : <Navigate to="/login" replace />
      } />
      
      {/* Fallback redirects based on role */}
      <Route path="*" element={
        user ? (
          isAdmin ? <Navigate to="/admin/projects" replace /> : <Navigate to="/consultant/timesheets" replace />
        ) : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <NotificationProvider>
            <Router>
              <AppContent />
            </Router>
          </NotificationProvider>
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App