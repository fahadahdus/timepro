import React, { useState, useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { supabase, Project } from '../lib/supabase'
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react'
import { clsx } from 'clsx'

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    client_id: '',
    billing_type: 'TNM',
    hourly_rate: '',
    budget: '',
    description: '',
    active: true
  })

  useEffect(() => {
    loadProjects()
    loadClients()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients!projects_client_id_fkey(
            id,
            name
          )
        `)
        .order('name')
      
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('active', true)
        .order('name')
      
      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const projectData = {
        name: formData.name,
        code: formData.code,
        client_id: formData.client_id,
        billing_type: formData.billing_type,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        description: formData.description || null,
        active: formData.active
      }

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData)
        
        if (error) throw error
      }

      resetForm()
      loadProjects()
    } catch (error: any) {
      console.error('Error saving project:', error)
      alert(error.message || 'Error saving project')
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      code: project.code,
      client_id: project.client_id || '',
      billing_type: project.billing_type || 'time_and_material',
      hourly_rate: project.hourly_rate?.toString() || '',
      budget: project.budget_amount?.toString() || '',
      description: '',
      active: project.active
    })
    setShowCreateModal(true)
  }

  const handleDelete = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete project "${project.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)
      
      if (error) throw error
      loadProjects()
    } catch (error: any) {
      console.error('Error deleting project:', error)
      alert(error.message || 'Error deleting project')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      client_id: '',
      billing_type: 'time_and_material',
      hourly_rate: '',
      budget: '',
      description: '',
      active: true
    })
    setEditingProject(null)
    setShowCreateModal(false)
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && project.active) ||
                         (filterStatus === 'inactive' && !project.active)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Projects Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage project codes, billing types, and rates
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          icon={<Plus className="h-4 w-4" />}
          variant="primary"
          className="shadow-lg"
        >
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="modern-card glass-card p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
              className="max-w-sm"
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Projects' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' }
            ]}
            className="w-40"
          />
        </div>
      </div>

      {/* Projects Table */}
      <div className="modern-card glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading projects...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Project</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Code</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Client</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Billing</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Rate</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{project.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-accent/50 px-2 py-1 rounded text-sm font-mono">
                        {project.code}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {(project as any).clients?.name || 'No Client'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        {
                          'bg-blue-100 text-blue-700': project.billing_type === 'time_and_material',
                          'bg-green-100 text-green-700': project.billing_type === 'fixed_price'
                        }
                      )}>
                        {project.billing_type === 'time_and_material' ? 'Time & Material' : 'Fixed Price'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {project.hourly_rate ? `$${project.hourly_rate}/hr` : 'Not set'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        {
                          'bg-success/10 text-success': project.active,
                          'bg-muted text-muted-foreground': !project.active
                        }
                      )}>
                        {project.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(project)}
                          icon={<Edit2 className="h-4 w-4" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(project)}
                          icon={<Trash2 className="h-4 w-4" />}
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProjects.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No projects found</p>
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
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Project Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              
              <Input
                label="Project Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                placeholder=" "
              />
              
              <Select
                label="Client"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                options={[
                  { value: '', label: 'Select Client' },
                  ...clients.map(client => ({
                    value: client.id,
                    label: client.name
                  }))
                ]}
              />
              
              <Select
                label="Billing Type"
                value={formData.billing_type}
                onChange={(e) => setFormData({ ...formData, billing_type: e.target.value })}
                options={[
                  { value: 'time_and_material', label: 'Time & Materials' },
                  { value: 'fixed_price', label: 'Fixed Price' }
                ]}
              />
              
              <Input
                label="Hourly Rate"
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder=" "
              />
              
              <Input
                label="Budget"
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder=" "
              />
              
              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder=" "
              />
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="active" className="text-sm text-foreground">
                  Active Project
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
                >
                  {editingProject ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}