import React, { useState, useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ProjectModal } from '../components/ProjectModal'
import { ExpenseModal } from '../components/ExpenseModal'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Week, DayEntry, ProjectEntry, CostEntry, Project } from '../lib/supabase'
import { format, startOfWeek, addDays, parseISO, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, Save, Copy, Clock, Plus, Trash2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { clsx } from 'clsx'
import { useIsMobile } from '../hooks/use-mobile'

interface TimesheetFormData {
  week: Week | null
  dayEntries: Record<string, DayEntry>
  projectEntries: Record<string, ProjectEntry[]>
  costEntries: Record<string, CostEntry[]>
}

export function TimesheetPage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday start
  )
  const [data, setData] = useState<TimesheetFormData>({
    week: null,
    dayEntries: {},
    projectEntries: {},
    costEntries: {}
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const [autoSave, setAutoSave] = useState(true)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [currentModalDate, setCurrentModalDate] = useState<string>('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [smartDefaults, setSmartDefaults] = useState({
    lastLocation: 'remote' as 'remote' | 'onsite',
    lastCity: '',
    lastCountry: '',
    recentProjects: [] as string[],
    recentExpenseTypes: [] as ('travel' | 'accommodation' | 'meal' | 'other')[],
    projectDefaults: new Map<string, {
      location: 'remote' | 'onsite'
      man_days: number
      travel_chargeable: boolean
    }>()
  })
  const [showQuickActions, setShowQuickActions] = useState(false)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
  const isReadOnly = data.week?.status === 'submitted' || data.week?.status === 'approved' || data.week?.status === 'rejected'

  // Load projects
  useEffect(() => {
    loadProjects()
  }, [])

  // Load smart defaults from localStorage on mount
  useEffect(() => {
    const savedDefaults = localStorage.getItem('timesheet-smart-defaults')
    if (savedDefaults) {
      try {
        const parsed = JSON.parse(savedDefaults)
        setSmartDefaults(prev => ({
          ...prev,
          ...parsed,
          projectDefaults: new Map(parsed.projectDefaults || [])
        }))
      } catch (error) {
        console.warn('Failed to parse saved smart defaults:', error)
      }
    }
  }, [])

  // Save smart defaults to localStorage when they change
  useEffect(() => {
    const toSave = {
      ...smartDefaults,
      projectDefaults: Array.from(smartDefaults.projectDefaults.entries())
    }
    localStorage.setItem('timesheet-smart-defaults', JSON.stringify(toSave))
  }, [smartDefaults])

  // Load week data when week changes
  useEffect(() => {
    if (user) {
      loadWeekData()
    }
  }, [currentWeekStart, user])

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && !isReadOnly && !loading) {
      const hasData = Object.keys(data.dayEntries).length > 0 || Object.values(data.dayEntries).some(entry => entry.time_in || entry.time_out)
      if (hasData) {
        const saveTimer = setTimeout(() => {
          handleSave()
        }, 3000) // Increased delay to avoid too frequent saves
        
        return () => clearTimeout(saveTimer)
      }
    }
  }, [data, autoSave, isReadOnly, loading])

  const loadProjects = async () => {
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select(`
        *,
        clients!projects_client_id_fkey(
          name
        )
      `)
      .eq('active', true)
      .order('name')

    if (error) {
      console.error('Error loading projects:', error)
    } else {
      setProjects(projectsData || [])
    }
  }

  const loadWeekData = async () => {
    if (!user) return
    
    setLoading(true)
    
    try {
      // Load week
      const { data: weekData } = await supabase
        .from('weeks')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .maybeSingle()

      // Create a placeholder week object if none exists
      let currentWeek = weekData || {
        id: null,
        user_id: user.id,
        week_start: weekStartStr,
        status: 'draft',
        submitted_at: null,
        approved_at: null,
        approved_by: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // For existing weeks, load entries
      const dayEntriesRecord: Record<string, DayEntry> = {}
      const projectEntriesRecord: Record<string, ProjectEntry[]> = {}
      const costEntriesRecord: Record<string, CostEntry[]> = {}

      // Create empty day entries for the whole week
      weekDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        dayEntriesRecord[dateStr] = {
          id: '',
          week_id: currentWeek.id || '',
          date: dateStr,
          time_in: null,
          time_out: null,
          status: 'active',
          allowance_amount: 0,
          work_from: null,
          city: null,
          country: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        projectEntriesRecord[dateStr] = []
        costEntriesRecord[dateStr] = []
      })

      // If week exists, fetch actual day entries
      if (currentWeek.id) {
        // Load day entries
        const { data: dayEntriesData } = await supabase
          .from('day_entries')
          .select('*')
          .eq('week_id', currentWeek.id)
          .order('date')

        if (dayEntriesData && dayEntriesData.length > 0) {
          for (const dayEntry of dayEntriesData) {
            dayEntriesRecord[dayEntry.date] = dayEntry
            
            // Load project entries for this day
            const { data: projectEntries } = await supabase
              .from('project_entries')
              .select('*')
              .eq('day_entry_id', dayEntry.id)
            
            projectEntriesRecord[dayEntry.date] = projectEntries || []
            
            // Load cost entries for this day
            const { data: costEntries } = await supabase
              .from('cost_entries')
              .select('*')
              .eq('day_entry_id', dayEntry.id)
            
            costEntriesRecord[dayEntry.date] = costEntries || []
          }
        }
      }

      setData({
        week: currentWeek,
        dayEntries: dayEntriesRecord,
        projectEntries: projectEntriesRecord,
        costEntries: costEntriesRecord
      })
      
      // Auto-expand days with data
      const newExpandedDays: Record<string, boolean> = {}
      Object.keys(dayEntriesRecord).forEach(date => {
        const entry = dayEntriesRecord[date]
        if (entry?.time_in || entry?.time_out || entry?.status !== 'active') {
          newExpandedDays[date] = true
        }
      })
      setExpandedDays(newExpandedDays)
      
    } catch (error) {
      console.error('Error loading week data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || isReadOnly || loading) return
    
    setSaving(true)
    
    try {
      // Create or update week
      let week = data.week
      if (!week) {
        const { data: newWeek, error } = await supabase
          .from('weeks')
          .insert({
            user_id: user.id,
            week_start: weekStartStr,
            status: 'draft'
          })
          .select()
          .single()
        
        if (error) throw error
        week = newWeek
        setData(prev => ({ ...prev, week }))
      }

      // Save day entries with actual data
      for (const [date, dayEntry] of Object.entries(data.dayEntries)) {
        // Only save entries that have actual data
        const hasData = dayEntry.time_in || dayEntry.time_out || dayEntry.status !== 'active' || 
                       dayEntry.work_from || dayEntry.city || dayEntry.country
        
        if (!hasData) continue
        
        if (dayEntry.id) {
          // Update existing
          const { error } = await supabase
            .from('day_entries')
            .update({
              time_in: dayEntry.time_in,
              time_out: dayEntry.time_out,
              status: dayEntry.status,
              allowance_amount: dayEntry.allowance_amount,
              work_from: dayEntry.work_from,
              city: dayEntry.city,
              country: dayEntry.country
            })
            .eq('id', dayEntry.id)
          
          if (error) throw error
        } else {
          // Create new
          const { data: newDayEntry, error } = await supabase
            .from('day_entries')
            .insert({
              week_id: week!.id,
              date,
              time_in: dayEntry.time_in,
              time_out: dayEntry.time_out,
              status: dayEntry.status || 'active',
              allowance_amount: dayEntry.allowance_amount || 0,
              work_from: dayEntry.work_from,
              city: dayEntry.city,
              country: dayEntry.country
            })
            .select()
            .single()
          
          if (error) throw error
          
          setData(prev => ({
            ...prev,
            dayEntries: {
              ...prev.dayEntries,
              [date]: newDayEntry
            }
          }))
        }
      }
      
      console.log('Timesheet saved successfully')
      
    } catch (error) {
      console.error('Error saving timesheet:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDayEntryChange = (date: string, field: string, value: any) => {
    setData(prev => ({
      ...prev,
      dayEntries: {
        ...prev.dayEntries,
        [date]: {
          ...(prev.dayEntries[date] || {
            id: '',
            week_id: '',
            date,
            time_in: null,
            time_out: null,
            status: 'active' as const,
            allowance_amount: 0,
            work_from: null,
            city: null,
            country: null,
            created_at: '',
            updated_at: ''
          }),
          [field]: value
        }
      }
    }))
    
    // Smart defaults learning
    if (field === 'city' && value) {
      setSmartDefaults(prev => ({ ...prev, lastCity: value }))
    }
    if (field === 'country' && value) {
      setSmartDefaults(prev => ({ ...prev, lastCountry: value }))
    }
    
    // Handle day status changes - implement business rules
    if (field === 'status') {
      const dayEntry = prev => prev.dayEntries[date] || {}
      
      // If changing to day_off or vacation, clear time entries
      if (value === 'day_off' || value === 'vacation') {
        setData(prev => ({
          ...prev,
          dayEntries: {
            ...prev.dayEntries,
            [date]: {
              ...dayEntry(prev),
              status: value,
              time_in: null,
              time_out: null,
              allowance_amount: 0
            }
          }
        }))
      }
      
      // If changing to travel, set default allowance
      if (value === 'travel') {
        setData(prev => ({
          ...prev,
          dayEntries: {
            ...prev.dayEntries,
            [date]: {
              ...dayEntry(prev),
              status: value,
              allowance_amount: 50 // Default travel allowance
            }
          }
        }))
      }
    }
  }

  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }))
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => 
      direction === 'prev' 
        ? addDays(prev, -7)
        : addDays(prev, 7)
    )
  }

  const applyPreset = (preset: 'weekdays' | 'yesterday' | 'lastWeek') => {
    if (isReadOnly) return
    
    if (preset === 'weekdays') {
      applyWeekdayTemplate()
    }
    
    if (preset === 'yesterday') {
      const yesterday = addDays(currentWeekStart, -1)
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
      
      weekDays.slice(0, 5).forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        copyFromPreviousDay(dateStr)
      })
    }
    
    if (preset === 'lastWeek') {
      const lastWeekStart = addDays(currentWeekStart, -7)
      
      weekDays.forEach((day, index) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const lastWeekDate = addDays(lastWeekStart, index)
        const lastWeekDateStr = format(lastWeekDate, 'yyyy-MM-dd')
        
        // Would need to fetch last week's data - simplified for now
        handleDayEntryChange(dateStr, 'time_in', '08:00')
        handleDayEntryChange(dateStr, 'time_out', '18:00')
        handleDayEntryChange(dateStr, 'status', 'active')
        setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
      })
      
      setTimeout(() => {
        handleSave()
      }, 500)
    }
  }

  // Project and Expense Modal Handlers
  const openProjectModal = (dateStr: string, projectId?: string) => {
    setCurrentModalDate(dateStr)
    setEditingProjectId(projectId || null)
    setShowProjectModal(true)
  }

  const openExpenseModal = (dateStr: string, expenseId?: string) => {
    setCurrentModalDate(dateStr)
    setEditingExpenseId(expenseId || null)
    setShowExpenseModal(true)
  }

  const closeModals = () => {
    setShowProjectModal(false)
    setShowExpenseModal(false)
    setCurrentModalDate('')
    setEditingProjectId(null)
    setEditingExpenseId(null)
  }

  const saveProjectEntry = async (projectData: {
    project_id: string
    location: 'remote' | 'onsite'
    man_days: number
    description: string
    travel_chargeable: boolean
  }) => {
    if (!user || !currentModalDate) return

    try {
      const dayEntry = data.dayEntries[currentModalDate]
      if (!dayEntry?.id) {
        // If dayEntry doesn't exist, create it first
        const { data: newDayEntry, error: dayError } = await supabase
          .from('day_entries')
          .insert({
            week_id: data.week?.id || '',
            date: currentModalDate,
            status: 'active',
            allowance_amount: 0
          })
          .select()
          .single()

        if (dayError) throw dayError
        
        // Update local state with new day entry
        setData(prev => ({
          ...prev,
          dayEntries: {
            ...prev.dayEntries,
            [currentModalDate]: newDayEntry
          }
        }))
        
        // Use the new day entry for the project entry
        const { error } = await supabase
          .from('project_entries')
          .insert({
            ...projectData,
            day_entry_id: newDayEntry.id,
            invoiced: false
          })
        
        if (error) throw error
      } else {
        if (editingProjectId) {
          // Update existing project entry
          const { error } = await supabase
            .from('project_entries')
            .update(projectData)
            .eq('id', editingProjectId)
          
          if (error) throw error
        } else {
          // Create new project entry
          const { error } = await supabase
            .from('project_entries')
            .insert({
              ...projectData,
              day_entry_id: dayEntry.id,
              invoiced: false
            })
          
          if (error) throw error
        }
      }

      // Update smart defaults with learned preferences
      setSmartDefaults(prev => ({
        ...prev,
        lastLocation: projectData.location,
        recentProjects: [
          projectData.project_id,
          ...prev.recentProjects.filter(p => p !== projectData.project_id)
        ].slice(0, 5), // Keep only the 5 most recent
        projectDefaults: new Map([
          ...prev.projectDefaults,
          [projectData.project_id, {
            location: projectData.location,
            man_days: projectData.man_days,
            travel_chargeable: projectData.travel_chargeable
          }]
        ])
      }))

      // Reload week data to refresh project entries
      await loadWeekData()
      closeModals()
    } catch (error) {
      console.error('Error saving project entry:', error)
    }
  }

  const saveCostEntry = async (costData: {
    type: 'travel' | 'accommodation' | 'meal' | 'other'
    distance_km?: number
    gross_amount: number
    vat_percentage: number
    chargeable: boolean
    notes?: string
  }) => {
    if (!user || !currentModalDate) return

    try {
      const dayEntry = data.dayEntries[currentModalDate]
      if (!dayEntry?.id) {
        // If dayEntry doesn't exist, create it first
        const { data: newDayEntry, error: dayError } = await supabase
          .from('day_entries')
          .insert({
            week_id: data.week?.id || '',
            date: currentModalDate,
            status: 'active',
            allowance_amount: 0
          })
          .select()
          .single()

        if (dayError) throw dayError
        
        // Update local state with new day entry
        setData(prev => ({
          ...prev,
          dayEntries: {
            ...prev.dayEntries,
            [currentModalDate]: newDayEntry
          }
        }))
        
        // Calculate net amount
        const net_amount = costData.gross_amount / (1 + costData.vat_percentage / 100)

        const entryData = {
          ...costData,
          net_amount,
          distance_km: costData.distance_km || null,
          notes: costData.notes || null
        }

        // Use the new day entry for the cost entry
        const { error } = await supabase
          .from('cost_entries')
          .insert({
            ...entryData,
            day_entry_id: newDayEntry.id,
            invoiced: false
          })
        
        if (error) throw error
      } else {
        // Calculate net amount
        const net_amount = costData.gross_amount / (1 + costData.vat_percentage / 100)

        const entryData = {
          ...costData,
          net_amount,
          distance_km: costData.distance_km || null,
          notes: costData.notes || null
        }

        if (editingExpenseId) {
          // Update existing cost entry
          const { error } = await supabase
            .from('cost_entries')
            .update(entryData)
            .eq('id', editingExpenseId)
          
          if (error) throw error
        } else {
          // Create new cost entry
          const { error } = await supabase
            .from('cost_entries')
            .insert({
              ...entryData,
              day_entry_id: dayEntry.id,
              invoiced: false
            })
          
          if (error) throw error
        }
      }

      // Update smart defaults with learned preferences
      setSmartDefaults(prev => ({
        ...prev,
        recentExpenseTypes: [
          costData.type,
          ...prev.recentExpenseTypes.filter(t => t !== costData.type)
        ].slice(0, 4) // Keep only the 4 most recent expense types
      }))

      // Reload week data to refresh cost entries
      await loadWeekData()
      closeModals()
    } catch (error) {
      console.error('Error saving cost entry:', error)
    }
  }

  const deleteProjectEntry = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('project_entries')
        .delete()
        .eq('id', projectId)
      
      if (error) throw error
      await loadWeekData()
    } catch (error) {
      console.error('Error deleting project entry:', error)
    }
  }

  const deleteCostEntry = async (costId: string) => {
    try {
      const { error } = await supabase
        .from('cost_entries')
        .delete()
        .eq('id', costId)
      
      if (error) throw error
      await loadWeekData()
    } catch (error) {
      console.error('Error deleting cost entry:', error)
    }
  }

  // Smart prefilling and workflow optimization functions
  const copyFromPreviousDay = (dateStr: string) => {
    const currentDate = new Date(dateStr)
    const previousDate = new Date(currentDate)
    previousDate.setDate(currentDate.getDate() - 1)
    const prevDateStr = format(previousDate, 'yyyy-MM-dd')
    
    const prevDayEntry = data.dayEntries[prevDateStr]
    if (prevDayEntry) {
      handleDayEntryChange(dateStr, 'time_in', prevDayEntry.time_in)
      handleDayEntryChange(dateStr, 'time_out', prevDayEntry.time_out)
      handleDayEntryChange(dateStr, 'work_from', prevDayEntry.work_from)
      handleDayEntryChange(dateStr, 'city', prevDayEntry.city)
      handleDayEntryChange(dateStr, 'country', prevDayEntry.country)
      
      // Auto-expand the day
      setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
    }
  }
  
  const applyWeekdayTemplate = () => {
    weekDays.slice(0, 5).forEach(day => { // Mon-Fri
      const dateStr = format(day, 'yyyy-MM-dd')
      handleDayEntryChange(dateStr, 'time_in', '08:00')
      handleDayEntryChange(dateStr, 'time_out', '18:00')
      handleDayEntryChange(dateStr, 'status', 'active')
      handleDayEntryChange(dateStr, 'work_from', smartDefaults.lastCity || 'Office')
      handleDayEntryChange(dateStr, 'city', smartDefaults.lastCity)
      handleDayEntryChange(dateStr, 'country', smartDefaults.lastCountry)
      
      // Auto-expand the days
      setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
    })
    
    // Auto-save after template is applied
    setTimeout(() => {
      handleSave()
    }, 500)
  }
  
  const getProjectDefaults = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return {}
    
    // Return smart defaults based on project configuration
    return {
      location: project.billing_type === 'fixed_price' ? 'remote' : smartDefaults.lastLocation,
      travel_chargeable: project.travel_billable,
      man_days: 1
    }
  }

  const isFormDisabled = (dateStr: string) => {
    const dayEntry = data.dayEntries[dateStr]
    return dayEntry?.status === 'day_off' || dayEntry?.status === 'vacation'
  }

  const showAllowanceField = (dateStr: string) => {
    const dayEntry = data.dayEntries[dateStr]
    return dayEntry?.status === 'travel'
  }

  const submitWeek = async () => {
    if (!data.week) return
    
    try {
      await supabase
        .from('weeks')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', data.week.id)
      
      // Reload data
      loadWeekData()
    } catch (error) {
      console.error('Error submitting week:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className={clsx(
        "flex items-center justify-between mb-6 sm:mb-8",
        {
          "flex-col space-y-4": isMobile,
          "flex-row": !isMobile,
        }
      )}>
        <div className={clsx(
          "flex items-center",
          {
            "flex-col space-y-3": isMobile,
            "space-x-6": !isMobile,
          }
        )}>
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-accent/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <h1 className={clsx(
                "font-bold text-foreground tracking-tight",
                {
                  "text-2xl": isMobile,
                  "text-3xl": !isMobile,
                }
              )}>
                Week of {format(currentWeekStart, 'MMM d, yyyy')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {format(currentWeekStart, 'yyyy')} • Week {format(currentWeekStart, 'w')}
              </p>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-accent/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          {data.week && (
            <div className={clsx(
              'px-3 py-1.5 text-xs font-semibold rounded-full border-2',
              {
                'bg-muted/50 text-muted-foreground border-muted': data.week.status === 'draft',
                'bg-info/10 text-info border-info/20': data.week.status === 'submitted',
                'bg-success/10 text-success border-success/20': data.week.status === 'approved',
                'bg-destructive/10 text-destructive border-destructive/20': data.week.status === 'rejected',
              }
            )}>
              {data.week.status.charAt(0).toUpperCase() + data.week.status.slice(1)}
            </div>
          )}
        </div>
        
        <div className={clsx(
          "flex items-center",
          {
            "flex-col space-y-3 w-full": isMobile,
            "space-x-3": !isMobile,
          }
        )}>
          {!isReadOnly && (
            <>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => applyPreset('weekdays')}
                icon={<Clock className="h-4 w-4" />}
                className={clsx(
                  "shadow-sm",
                  {
                    "w-full": isMobile,
                  }
                )}
              >
                Mon-Fri 8-18
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowQuickActions(!showQuickActions)}
                className={clsx(
                  "shadow-sm",
                  {
                    "w-full": isMobile,
                  }
                )}
              >
                <Copy className="h-4 w-4 mr-1" />
                Quick Fill
              </Button>
              
              {showQuickActions && (
                <div className={clsx(
                  "flex",
                  {
                    "flex-col space-y-2 w-full": isMobile,
                    "space-x-2": !isMobile,
                  }
                )}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => applyPreset('yesterday')}
                    className="text-xs"
                  >
                    Copy Yesterday
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => applyPreset('lastWeek')}
                    className="text-xs"
                  >
                    Copy Last Week
                  </Button>
                </div>
              )}
              
              <Button 
                variant="primary" 
                onClick={handleSave}
                loading={saving}
                disabled={isReadOnly || loading}
                icon={<Save className="h-4 w-4" />}
                className={clsx(
                  "shadow-lg",
                  {
                    "w-full": isMobile,
                  }
                )}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              
              {data.week?.status === 'draft' && (
                <Button 
                  variant="success" 
                  onClick={submitWeek}
                  className={clsx(
                    "shadow-lg",
                    {
                      "w-full": isMobile,
                    }
                  )}
                >
                  Submit Week
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Timesheet Grid */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground font-medium">Loading timesheet...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const dayEntry = data.dayEntries[dateStr]
                const isExpanded = expandedDays[dateStr]
                const hasData = dayEntry && (dayEntry.time_in || dayEntry.time_out)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                
                return (
                  <div key={dateStr} className={clsx(
                    'border rounded-xl overflow-hidden transition-all duration-200',
                    {
                      'border-border bg-card': !isWeekend,
                      'border-muted bg-muted/30': isWeekend,
                      'shadow-md': isExpanded,
                      'hover:shadow-sm': !isExpanded,
                    }
                  )}>
                    <div 
                      className="p-4 cursor-pointer hover:bg-accent/30 transition-colors duration-200 active:bg-accent/50 interactive"
                      onClick={() => toggleDayExpansion(dateStr)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleDayExpansion(dateStr)
                        }
                      }}
                    >
                      <div className={clsx(
                        "flex items-center",
                        {
                          "flex-col space-y-4": isMobile,
                          "justify-between": !isMobile,
                        }
                      )}>
                        <div className={clsx(
                          "flex items-center",
                          {
                            "flex-col space-y-4 w-full": isMobile,
                            "space-x-6": !isMobile,
                          }
                        )}>
                          <div className={clsx(
                            "flex-shrink-0",
                            {
                              "text-center": isMobile,
                              "w-24": !isMobile,
                            }
                          )}>
                            <div className={clsx(
                              'font-semibold text-lg',
                              {
                                'text-foreground': !isWeekend,
                                'text-muted-foreground': isWeekend,
                              }
                            )}>
                              {format(day, 'EEE')}
                            </div>
                            <div className={clsx(
                              'text-sm',
                              {
                                'text-muted-foreground': !isWeekend,
                                'text-muted-foreground/70': isWeekend,
                              }
                            )}>
                              {format(day, 'MMM d')}
                            </div>
                          </div>
                          
                          <div className={clsx(
                            "flex items-center",
                            {
                              "flex-col space-y-3 w-full": isMobile,
                              "space-x-4": !isMobile,
                            }
                          )}>
                            <div className={clsx(
                              "flex items-center",
                              {
                                "flex-col space-y-2 w-full": isMobile,
                                "space-x-4": !isMobile,
                              }
                            )}>
                              <div className={clsx(
                                "flex items-center",
                                {
                                  "space-x-2 w-full justify-center": isMobile,
                                  "space-x-4": !isMobile,
                                }
                              )}>
                                <Input
                                  type="time"
                                  value={dayEntry?.time_in || ''}
                                  onChange={(e) => {
                                    handleDayEntryChange(dateStr, 'time_in', e.target.value)
                                    // Auto-expand if time is entered
                                    if (e.target.value && !isExpanded) {
                                      setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
                                    }
                                  }}
                                  className={clsx(
                                    "premium-focus",
                                    {
                                      "flex-1": isMobile,
                                      "w-28": !isMobile,
                                    }
                                  )}
                                  disabled={isReadOnly || isFormDisabled(dateStr)}
                                  onClick={(e) => e.stopPropagation()}
                                  label={isMobile ? "Start" : undefined}
                                  variant={isMobile ? "floating" : "default"}
                                />
                                <span className="text-muted-foreground font-medium text-sm">to</span>
                                <Input
                                  type="time"
                                  value={dayEntry?.time_out || ''}
                                  onChange={(e) => {
                                    handleDayEntryChange(dateStr, 'time_out', e.target.value)
                                    // Auto-expand if time is entered
                                    if (e.target.value && !isExpanded) {
                                      setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
                                    }
                                  }}
                                  className={clsx(
                                    "premium-focus",
                                    {
                                      "flex-1": isMobile,
                                      "w-28": !isMobile,
                                    }
                                  )}
                                  disabled={isReadOnly || isFormDisabled(dateStr)}
                                  onClick={(e) => e.stopPropagation()}
                                  label={isMobile ? "End" : undefined}
                                  variant={isMobile ? "floating" : "default"}
                                />
                              </div>
                              
                              <Select
                                value={dayEntry?.status || 'active'}
                                onChange={(e) => {
                                  handleDayEntryChange(dateStr, 'status', e.target.value)
                                  // Auto-expand if status is changed
                                  if (!isExpanded) {
                                    setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
                                  }
                                }}
                                className={clsx(
                                  "premium-focus",
                                  {
                                    "w-full": isMobile,
                                    "w-36": !isMobile,
                                  }
                                )}
                                disabled={isReadOnly}
                                onClick={(e) => e.stopPropagation()}
                                options={[
                                  { value: 'active', label: 'Active' },
                                  { value: 'day_off', label: 'Day Off' },
                                  { value: 'vacation', label: 'Vacation' },
                                  { value: 'travel', label: 'Travel' }
                                ]}
                                label={isMobile ? "Status" : undefined}
                                variant={isMobile ? "floating" : "default"}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className={clsx(
                          "flex items-center",
                          {
                            "justify-center space-x-4 mt-2": isMobile,
                            "space-x-4": !isMobile,
                          }
                        )}>
                          {hasData && (
                            <div className="text-center">
                              <span className="text-sm font-semibold text-primary">
                                {dayEntry?.time_in && dayEntry?.time_out && 
                                  `${Math.abs(new Date(`1970-01-01T${dayEntry.time_out}:00`).getTime() - 
                                              new Date(`1970-01-01T${dayEntry.time_in}:00`).getTime()) / (1000 * 60 * 60)}h`
                                }
                              </span>
                              <p className="text-xs text-muted-foreground">hours</p>
                            </div>
                          )}
                          <div className={clsx(
                            'transition-transform duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center',
                            {
                              'rotate-180': isExpanded,
                            }
                          )}>
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Day Details */}
                    {isExpanded && (
                      <div className="border-t border-border/50 bg-card/50 p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Input
                            label="Work From"
                            value={dayEntry?.work_from || ''}
                            onChange={(e) => handleDayEntryChange(dateStr, 'work_from', e.target.value)}
                            placeholder="e.g., Office, Home, Client Site"
                            disabled={isReadOnly}
                            variant="floating"
                          />
                          <Input
                            label="City"
                            value={dayEntry?.city || ''}
                            onChange={(e) => handleDayEntryChange(dateStr, 'city', e.target.value)}
                            placeholder="Enter city"
                            disabled={isReadOnly}
                            variant="floating"
                          />
                          <Input
                            label="Country"
                            value={dayEntry?.country || ''}
                            onChange={(e) => handleDayEntryChange(dateStr, 'country', e.target.value)}
                            placeholder="Enter country"
                            disabled={isReadOnly}
                            variant="floating"
                          />
                        </div>
                        
                        {/* Project Entries */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">Project Work</h4>
                              <p className="text-xs text-muted-foreground">Track your project activities for this day</p>
                            </div>
                            {!isReadOnly && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="interactive"
                                onClick={() => openProjectModal(dateStr)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Project
                              </Button>
                            )}
                          </div>
                          
                          {/* Display existing project entries */}
                          {data.projectEntries[dateStr] && data.projectEntries[dateStr].length > 0 ? (
                            <div className="space-y-3">
                              {data.projectEntries[dateStr].map((projectEntry: ProjectEntry) => {
                                const project = projects.find(p => p.id === projectEntry.project_id)
                                return (
                                  <div key={projectEntry.id} className="bg-card border border-border rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <span className="text-sm font-semibold text-foreground">
                                            {project?.name || 'Unknown Project'}
                                          </span>
                                          <span className={clsx(
                                            'px-2 py-1 text-xs rounded-full font-medium',
                                            {
                                              'bg-blue-100 text-blue-800': projectEntry.location === 'remote',
                                              'bg-orange-100 text-orange-800': projectEntry.location === 'onsite',
                                            }
                                          )}>
                                            {projectEntry.location === 'remote' ? 'Remote' : 'On-site'}
                                          </span>
                                          {projectEntry.travel_chargeable && (
                                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                              Travel Billable
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-1">
                                          <span className="font-medium">{projectEntry.man_days} man-days</span>
                                        </div>
                                        {projectEntry.description && (
                                          <p className="text-sm text-muted-foreground">{projectEntry.description}</p>
                                        )}
                                      </div>
                                      {!isReadOnly && (
                                        <div className="flex items-center space-x-2 ml-4">
                                          <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => openProjectModal(dateStr, projectEntry.id)}
                                            className="text-muted-foreground hover:text-foreground"
                                          >
                                            Edit
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => deleteProjectEntry(projectEntry.id)}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="bg-muted/30 rounded-lg p-6 text-center border border-dashed border-muted">
                              <div className="text-muted-foreground">
                                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium mb-1">No project entries yet</p>
                                <p className="text-xs">Click "Add Project" to start tracking your work</p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Cost Entries */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">Travel & Expenses</h4>
                              <p className="text-xs text-muted-foreground">Log your business expenses for this day</p>
                            </div>
                            {!isReadOnly && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="interactive"
                                onClick={() => openExpenseModal(dateStr)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Expense
                              </Button>
                            )}
                          </div>
                          
                          {/* Display existing cost entries */}
                          {data.costEntries[dateStr] && data.costEntries[dateStr].length > 0 ? (
                            <div className="space-y-3">
                              {data.costEntries[dateStr].map((costEntry: CostEntry) => (
                                <div key={costEntry.id} className="bg-card border border-border rounded-lg p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className={clsx(
                                          'px-2 py-1 text-xs rounded-full font-medium capitalize',
                                          {
                                            'bg-blue-100 text-blue-800': costEntry.type === 'travel',
                                            'bg-purple-100 text-purple-800': costEntry.type === 'accommodation',
                                            'bg-green-100 text-green-800': costEntry.type === 'meal',
                                            'bg-gray-100 text-gray-800': costEntry.type === 'other',
                                          }
                                        )}>
                                          {costEntry.type}
                                        </span>
                                        {costEntry.chargeable && (
                                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                            Chargeable
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                                        <span className="font-medium">
                                          ${costEntry.gross_amount.toFixed(2)} 
                                          <span className="text-xs">(incl. {costEntry.vat_percentage}% VAT)</span>
                                        </span>
                                        {costEntry.distance_km && (
                                          <span>{costEntry.distance_km} km</span>
                                        )}
                                      </div>
                                      {costEntry.notes && (
                                        <p className="text-sm text-muted-foreground">{costEntry.notes}</p>
                                      )}
                                    </div>
                                    {!isReadOnly && (
                                      <div className="flex items-center space-x-2 ml-4">
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          onClick={() => openExpenseModal(dateStr, costEntry.id)}
                                          className="text-muted-foreground hover:text-foreground"
                                        >
                                          Edit
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          onClick={() => deleteCostEntry(costEntry.id)}
                                          className="text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-muted/30 rounded-lg p-6 text-center border border-dashed border-muted">
                              <div className="text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium mb-1">No expenses recorded</p>
                                <p className="text-xs">Add travel costs, meals, or other business expenses</p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Summary */}
                        <div className="flex justify-between items-center pt-4 border-t border-border/30">
                          <div className="text-sm text-muted-foreground">
                            Daily summary for {format(day, 'EEEE, MMMM d')}
                          </div>
                          <div className="text-sm font-semibold">
                            <span className="text-muted-foreground">Daily Allowance: </span>
                            <span className={clsx(
                              'font-bold',
                              {
                                'text-success': dayEntry?.allowance_amount && dayEntry.allowance_amount > 0,
                                'text-muted-foreground': !dayEntry?.allowance_amount || dayEntry.allowance_amount === 0,
                              }
                            )}>
                              {dayEntry?.allowance_amount ? `$${dayEntry.allowance_amount.toFixed(2)}` : '$0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Project Modal */}
      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={closeModals}
          onSave={saveProjectEntry}
          projects={projects}
          date={currentModalDate}
          editingProject={editingProjectId ? data.projectEntries[currentModalDate]?.find(p => p.id === editingProjectId) : undefined}
          smartDefaults={smartDefaults}
        />
      )}
      
      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={closeModals}
          onSave={saveCostEntry}
          date={currentModalDate}
          editingExpense={editingExpenseId ? data.costEntries[currentModalDate]?.find(c => c.id === editingExpenseId) : undefined}
          recentExpenseTypes={smartDefaults.recentExpenseTypes}
        />
      )}
      
      </div>
    </div>
  )
}