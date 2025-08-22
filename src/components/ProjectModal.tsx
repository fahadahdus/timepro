import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { Project, ProjectEntry } from '../lib/supabase'
import { format } from 'date-fns'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    project_id: string
    location: 'remote' | 'onsite'
    man_days: number
    description: string
    travel_chargeable: boolean
  }) => void
  projects: Project[]
  date: string
  editingProject?: ProjectEntry
  smartDefaults?: {
    lastLocation: 'remote' | 'onsite'
    recentProjects: string[]
    projectDefaults: Map<string, {
      location: 'remote' | 'onsite'
      man_days: number
      travel_chargeable: boolean
    }>
  }
}

export function ProjectModal({ isOpen, onClose, onSave, projects, date, editingProject, smartDefaults }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    project_id: '',
    location: 'remote' as 'remote' | 'onsite',
    man_days: 1,
    description: '',
    travel_chargeable: false
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (editingProject) {
      setFormData({
        project_id: editingProject.project_id,
        location: editingProject.location,
        man_days: editingProject.man_days,
        description: editingProject.description || '',
        travel_chargeable: editingProject.travel_chargeable
      })
    } else {
      setFormData({
        project_id: '',
        location: 'remote',
        man_days: 1,
        description: '',
        travel_chargeable: false
      })
    }
    setErrors({})
  }, [editingProject, isOpen])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Smart prefilling when project is selected
  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      // Check if we have learned preferences for this project
      const learnedDefaults = smartDefaults?.projectDefaults?.get(projectId)
      
      // Apply smart defaults based on project configuration or learned preferences
      const projectSmartDefaults = learnedDefaults || {
        location: project.billing_type === 'fixed_price' ? 'remote' : (smartDefaults?.lastLocation || 'onsite'),
        travel_chargeable: project.travel_billable || false,
        man_days: project.billing_type === 'fixed_price' ? 1 : 0.5
      }
      
      setFormData(prev => ({
        ...prev,
        project_id: projectId,
        location: projectSmartDefaults.location as 'remote' | 'onsite',
        travel_chargeable: projectSmartDefaults.travel_chargeable,
        man_days: projectSmartDefaults.man_days
      }))
      
      // Clear project selection error
      if (errors.project_id) {
        setErrors(prev => ({ ...prev, project_id: '' }))
      }
    } else {
      handleInputChange('project_id', projectId)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.project_id) {
      newErrors.project_id = 'Please select a project'
    }
    
    if (formData.man_days <= 0) {
      newErrors.man_days = 'Man-days must be greater than 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  const selectedProject = projects.find(p => p.id === formData.project_id)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {editingProject ? 'Edit Project Entry' : 'Add Project Entry'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Select
                label="Project"
                value={formData.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                error={errors.project_id}
                variant="floating"
                options={[
                  { value: '', label: 'Select a project...' },
                  // Show recent projects first if available
                  ...(smartDefaults?.recentProjects || []).slice(0, 3).map(projectId => {
                    const project = projects.find(p => p.id === projectId)
                    return project ? {
                      value: project.id,
                      label: `⭐ ${project.name} (${project.code})`
                    } : null
                  }).filter(Boolean) as { value: string; label: string }[],
                  // Then show all other projects
                  ...projects
                    .filter(project => !(smartDefaults?.recentProjects || []).includes(project.id))
                    .map(project => ({
                      value: project.id,
                      label: `${project.name} (${project.code})`
                    }))
                ]}
              />
              
              {smartDefaults?.recentProjects && smartDefaults.recentProjects.length > 0 && (
                <div className="mt-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-foreground mb-2">Recently Used Projects</h4>
                    <div className="flex flex-wrap gap-2">
                      {smartDefaults.recentProjects.slice(0, 3).map((projectId) => {
                        const project = projects.find(p => p.id === projectId)
                        if (!project) return null
                        return (
                          <button
                            key={projectId}
                            type="button"
                            onClick={() => handleProjectChange(projectId)}
                            className="px-3 py-1 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                          >
                            {project.name} ({project.code})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {selectedProject && (
                <div className="md:col-span-2">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-foreground mb-2">Project Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Billing Type:</span>
                        <span className="ml-2 font-medium capitalize">
                          {selectedProject.billing_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hourly Rate:</span>
                        <span className="ml-2 font-medium">${selectedProject.hourly_rate}</span>
                      </div>
                      {selectedProject.budget_days > 0 && (
                        <div>
                          <span className="text-muted-foreground">Budget Days:</span>
                          <span className="ml-2 font-medium">{selectedProject.budget_days}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Travel Billable:</span>
                        <span className="ml-2 font-medium">
                          {selectedProject.travel_billable ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Select
              label="Work Location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value as 'remote' | 'onsite')}
              variant="floating"
              options={[
                { value: 'remote', label: 'Remote' },
                { value: 'onsite', label: 'On-site' }
              ]}
            />
            
            <Input
              type="number"
              label="Man-days"
              value={formData.man_days.toString()}
              onChange={(e) => handleInputChange('man_days', parseFloat(e.target.value) || 0)}
              error={errors.man_days}
              variant="floating"
              min="0"
              step="0.25"
            />
            
            <div className="md:col-span-2">
              <textarea
                className="modern-input w-full h-24 resize-none"
                placeholder="Description of work performed..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
              <label className="floating-label">Description (Optional)</label>
            </div>
            
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="travel_chargeable"
                  checked={formData.travel_chargeable}
                  onChange={(e) => handleInputChange('travel_chargeable', e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <label htmlFor="travel_chargeable" className="text-sm font-medium text-foreground">
                  Travel is chargeable for this project
                </label>
              </div>
              {selectedProject?.travel_billable && (
                <p className="text-xs text-muted-foreground mt-1">
                  This project allows billable travel expenses
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={onClose}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="min-h-[44px]"
          >
            {editingProject ? 'Update Project' : 'Add Project'}
          </Button>
        </div>
      </div>
    </div>
  )
}
