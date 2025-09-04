import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../contexts/NotificationContext'
import { Plus, Edit2, Trash2, Search, User, Mail, DollarSign } from 'lucide-react'
import { clsx } from 'clsx'

interface User {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'consultant'
  hourly_rate: number
  country_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const { success, error } = useNotifications()
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'consultant' as 'super_admin' | 'consultant',
    hourly_rate: '',
    country_code: 'US',
    is_active: true,
    password: ''
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name')
      
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const userData = {
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        role: formData.role,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : 0,
        country_code: formData.country_code,
        is_active: formData.is_active
      }

      if (editingUser) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update(userData)
          .eq('id', editingUser.id)
        
        if (updateError) throw updateError
        
        success('User updated successfully')
      } else {
        // Create new user
        if (!formData.password || formData.password.length < 8) {
          error('Password must be at least 8 characters')
          setSaving(false)
          return
        }
        
        // 1. Create auth user with Supabase Auth
        const { error: signUpError, data: authData } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              role: formData.role
            }
          }
        })
        
        if (signUpError) throw signUpError
        
        if (!authData.user) {
          throw new Error('Failed to create user')
        }
        
        // 2. Add user to the users table
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            ...userData,
            id: authData.user.id
          })
        
        if (insertError) throw insertError
        
        success('User created successfully')
      }

      resetForm()
      loadUsers()
    } catch (error: any) {
      console.error('Error saving user:', error)
      error('Failed to save user', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      hourly_rate: user.hourly_rate?.toString() || '',
      country_code: user.country_code || 'US',
      is_active: user.is_active,
      password: ''
    })
    setShowCreateModal(true)
  }

  const handleDeactivate = async (user: User) => {
    const action = user.is_active ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)
      
      if (updateError) throw updateError
      
      success(`User ${action}d successfully`)
      loadUsers()
    } catch (error: any) {
      console.error('Error updating user status:', error)
      error(`Failed to ${action} user`, error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'consultant',
      hourly_rate: '',
      country_code: 'US',
      is_active: true,
      password: ''
    })
    setEditingUser(null)
    setShowCreateModal(false)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const countries = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'AU', label: 'Australia' },
    { value: 'JP', label: 'Japan' },
    { value: 'IN', label: 'India' }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage consultant users and their permissions
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          variant="primary"
          className="shadow-lg"
        >
          <Plus className="h-4 w-4" />
          New User
        </Button>
      </div>

      {/* Filters */}
      <div className="modern-card glass-card p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
              className="max-w-sm"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'consultant', label: 'Consultants Only' },
              { value: 'super_admin', label: 'Admins Only' }
            ]}
            className="w-40"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="modern-card glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Hourly Rate</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Country</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-accent/20">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        {
                          'bg-purple-100 text-purple-700': user.role === 'super_admin',
                          'bg-blue-100 text-blue-700': user.role === 'consultant'
                        }
                      )}>
                        {user.role === 'super_admin' ? 'Super Admin' : 'Consultant'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">
                          {user.hourly_rate ? `${user.hourly_rate}/hr` : 'Not set'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-foreground">{user.country_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        {
                          'bg-success/10 text-success': user.is_active,
                          'bg-muted text-muted-foreground': !user.is_active
                        }
                      )}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(user)}
                          className={clsx({
                            'text-destructive hover:text-destructive': user.is_active,
                            'text-success hover:text-success': !user.is_active
                          })}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modern-card glass-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
              
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={!!editingUser}
              />
              
              <Select
                label="Role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'super_admin' | 'consultant' })}
                options={[
                  { value: 'consultant', label: 'Consultant' },
                  { value: 'super_admin', label: 'Super Admin' }
                ]}
              />
              
              <Input
                label="Hourly Rate"
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="0.00"
              />
              
              <Select
                label="Country"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                options={countries}
              />
              
              {!editingUser && (
                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder="Minimum 8 characters"
                />
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm text-foreground">
                  Active User
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={saving}
                >
                  {editingUser ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}