import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ProjectModal } from '../components/ProjectModal'
import { ExpenseModal } from '../components/ExpenseModal'
import { TravelFields } from '../components/TravelFields'
import { TravelExpenseModal } from '../components/TravelExpenseModal'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Week, DayEntry, ProjectEntry, CostEntry, ExpenseEntry, TravelExpenseEntry, Project } from '../lib/supabase'
import { format, startOfWeek, addDays, parseISO, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, Save, Copy, Clock, Plus, Trash2, ChevronDown, ChevronUp, BarChart3, Receipt } from 'lucide-react'
import { clsx } from 'clsx'
import { useIsMobile } from '../hooks/use-mobile'
import { cleanupOrphanedTravelExpense } from '../utils/cleanupOrphanedTravelExpense'
// Delete the orphaned travel expense entry
import '../utils/deleteSpecificTravelExpense'

interface Country {
  id: string
  code: string
  name: string
  vat_rate: string
  currency_code: string
  is_active: boolean
}

interface TimesheetFormData {
  week: Week | null
  dayEntries: Record<string, DayEntry>
  projectEntries: Record<string, ProjectEntry[]>
  costEntries: Record<string, CostEntry[]>
  expenseEntries: Record<string, ExpenseEntry[]>
  travelExpenseEntries: Record<string, TravelExpenseEntry[]>
}

export function TimesheetPage() {
  const { user, refreshSessionIfNeeded } = useAuth()
  const isMobile = useIsMobile()
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday start
  )
  const [data, setData] = useState<TimesheetFormData>({
    week: null,
    dayEntries: {},
    projectEntries: {},
    costEntries: {},
    expenseEntries: {},
    travelExpenseEntries: {}
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [citySuggestions, setCitySuggestions] = useState<string[]>([])
  const [allowanceRates, setAllowanceRates] = useState<{[key: string]: {full_rate: number, partial_rate: number}}>({})
  const [defaultCurrency, setDefaultCurrency] = useState('EUR')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const [autoSave, setAutoSave] = useState(true)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showTravelExpenseModal, setShowTravelExpenseModal] = useState(false)
  const [currentModalDate, setCurrentModalDate] = useState<string>('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingTravelExpenseId, setEditingTravelExpenseId] = useState<string | null>(null)
  const [smartDefaults, setSmartDefaults] = useState({
    lastLocation: 'remote' as 'remote' | 'onsite',
    lastOffice: '',
    lastCity: '',
    lastCountry: '',
    recentProjects: [] as string[],
    recentOffices: [] as string[],
    recentExpenseTypes: [] as ('car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other')[],
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
    loadCountries()
    loadCitySuggestions()
    loadAllowanceRates()
    loadSystemSettings()
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
      // Clean up orphaned travel expense on page load
      cleanupOrphanedTravelExpense()
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

  const loadCountries = async () => {
    const { data: countriesData, error } = await supabase
      .from('countries')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error loading countries:', error)
    } else {
      setCountries(countriesData || [])
    }
  }

  const loadCitySuggestions = async () => {
    if (!user) return

    // Get unique cities from user's previous entries
    const { data: cityData, error } = await supabase
      .from('day_entries')
      .select('city')
      .not('city', 'is', null)
      .neq('city', '')
      .order('city')

    if (error) {
      console.error('Error loading city suggestions:', error)
    } else {
      const uniqueCities = [...new Set(cityData?.map(item => item.city).filter(Boolean))] as string[]
      setCitySuggestions(uniqueCities.slice(0, 10)) // Limit to 10 suggestions
    }
  }

  const loadAllowanceRates = async () => {
    const { data: ratesData, error } = await supabase
      .from('allowance_rates')
      .select('country, full_rate, partial_rate')
      .is('effective_to', null) // Only get active rates
      .order('country')

    if (error) {
      console.error('Error loading allowance rates:', error)
    } else if (ratesData) {
      const ratesMap: {[key: string]: {full_rate: number, partial_rate: number}} = {}
      ratesData.forEach(rate => {
        ratesMap[rate.country] = {
          full_rate: parseFloat(rate.full_rate),
          partial_rate: parseFloat(rate.partial_rate)
        }
      })
      setAllowanceRates(ratesMap)
    }
  }

  const loadSystemSettings = async () => {
    const { data: settingsData, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', 'default_currency')
      .single()

    if (error) {
      console.error('Error loading system settings:', error)
    } else if (settingsData) {
      setDefaultCurrency(settingsData.value)
    }
  }

  const calculateDailyAllowance = (dayEntry: DayEntry): number => {
    // Only calculate allowance for travel days
    if (dayEntry.status !== 'travel' || !dayEntry.country) {
      return 0
    }

    // First check if we have travel expense entries with calculated allowance
    const travelExpenses = data.travelExpenseEntries[dayEntry.date] || []
    if (travelExpenses.length > 0) {
      const totalAllowance = travelExpenses.reduce((sum, expense) => {
        return sum + (expense.allowance_amount || 0)
      }, 0)
      if (totalAllowance > 0) {
        return totalAllowance
      }
    }

    // Fallback to calculating from allowance rates
    const rates = allowanceRates[dayEntry.country]
    if (!rates) {
      return 0
    }

    // Determine if it's a full day or partial day
    // For now, we'll use full_rate if they have both time_in and time_out
    // and the day spans more than 6 hours, otherwise partial_rate
    let isFullDay = false
    
    if (dayEntry.time_in && dayEntry.time_out) {
      const timeIn = new Date(`2000-01-01 ${dayEntry.time_in}`)
      const timeOut = new Date(`2000-01-01 ${dayEntry.time_out}`)
      const hoursWorked = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
      isFullDay = hoursWorked >= 6
    } else {
      // If no times are set but it's a travel day, assume full day
      isFullDay = true
    }

    return isFullDay ? rates.full_rate : rates.partial_rate
  }

  const getCurrencySymbol = (currencyCode: string): string => {
    const symbols: {[key: string]: string} = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF'
    }
    return symbols[currencyCode] || currencyCode
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
      const expenseEntriesRecord: Record<string, ExpenseEntry[]> = {}
      const travelExpenseEntriesRecord: Record<string, TravelExpenseEntry[]> = {}

      // Create empty day entries for the whole week
      weekDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isWeekend = day.getDay() === 0 || day.getDay() === 6 // Sunday = 0, Saturday = 6
        
        dayEntriesRecord[dateStr] = {
          id: '',
          week_id: currentWeek.id || '',
          date: dateStr,
          time_in: null,
          time_out: null,
          status: isWeekend ? 'weekend' : 'office', // Default weekends to weekend, weekdays to office
          allowance_amount: 0,
          office: null,
          city: null,
          country: null,
          project_id: null,
          travel_start_time: null,
          travel_end_time: null,
          travel_from_location: null,
          travel_to_location: null,
          travel_custom_from_location: null,
          travel_custom_to_location: null,
          travel_description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        projectEntriesRecord[dateStr] = []
        costEntriesRecord[dateStr] = []
        expenseEntriesRecord[dateStr] = []
        travelExpenseEntriesRecord[dateStr] = []
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
            
            // Load travel expense entries for this day
            const { data: travelExpenseEntries } = await supabase
              .from('travel_expense_entries')
              .select('*')
              .eq('day_entry_id', dayEntry.id)
            
            travelExpenseEntriesRecord[dayEntry.date] = travelExpenseEntries || []
          }
        }
        
        // Load expense entries for the week
        const { data: expenseEntries } = await supabase
          .from('expense_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', weekDays[0].toISOString().split('T')[0])
          .lte('date', weekDays[6].toISOString().split('T')[0])
        
        if (expenseEntries) {
          for (const expenseEntry of expenseEntries) {
            if (!expenseEntriesRecord[expenseEntry.date]) {
              expenseEntriesRecord[expenseEntry.date] = []
            }
            expenseEntriesRecord[expenseEntry.date].push(expenseEntry)
          }
        }
      }

      setData({
        week: currentWeek,
        dayEntries: dayEntriesRecord,
        projectEntries: projectEntriesRecord,
        costEntries: costEntriesRecord,
        expenseEntries: expenseEntriesRecord,
        travelExpenseEntries: travelExpenseEntriesRecord
      })
      
      // Auto-expand days with data (only expand the first one found for accordion behavior)
      const newExpandedDays: Record<string, boolean> = {}
      let firstDayWithDataFound = false
      
      // Initialize all days as collapsed
      Object.keys(dayEntriesRecord).forEach(date => {
        newExpandedDays[date] = false
      })
      
      // Find the first day with data and expand only that one
      Object.keys(dayEntriesRecord).forEach(date => {
        const entry = dayEntriesRecord[date]
        const dayOfWeek = new Date(date).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const defaultStatus = isWeekend ? 'weekend' : 'office'
        
        if (!firstDayWithDataFound && (entry?.time_in || entry?.time_out || entry?.status !== defaultStatus)) {
          newExpandedDays[date] = true
          firstDayWithDataFound = true
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
    
    // Validate that we have valid data before saving
    const validationErrors: string[] = []
    
    // Check for required project selection for travel days
    Object.entries(data.dayEntries).forEach(([date, dayEntry]) => {
      if (dayEntry.status === 'travel' && !dayEntry.project_id) {
        validationErrors.push(`Project selection is required for travel day on ${date}`)
      }
    })
    
    if (validationErrors.length > 0) {
      alert(`Please complete the following required information:\n\n${validationErrors.join('\n')}`)
      return
    }
    
    setSaving(true)
    
    try {
      // Refresh session before making API calls to prevent authentication errors
      const sessionRefreshed = await refreshSessionIfNeeded()
      if (!sessionRefreshed) {
        throw new Error('Authentication session expired. Please log in again.')
      }
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
        const dayOfWeek = new Date(date).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const defaultStatus = isWeekend ? 'weekend' : 'office'
        const hasData = dayEntry.time_in || dayEntry.time_out || dayEntry.status !== defaultStatus
        
        if (!hasData) continue
        
        if (dayEntry.id) {
          // Update existing - calculate allowance amount
          const calculatedAllowance = calculateDailyAllowance(dayEntry)
          const { error } = await supabase
            .from('day_entries')
            .update({
              time_in: dayEntry.time_in,
              time_out: dayEntry.time_out,
              status: dayEntry.status,
              allowance_amount: calculatedAllowance,
              office: dayEntry.office,
              city: dayEntry.city,
              country: dayEntry.country,
              project_id: dayEntry.project_id
            })
            .eq('id', dayEntry.id)
          
          if (error) throw error
          
          // Update local state with calculated allowance
          setData(prev => ({
            ...prev,
            dayEntries: {
              ...prev.dayEntries,
              [date]: { ...dayEntry, allowance_amount: calculatedAllowance }
            }
          }))
        } else {
          // Create new - calculate allowance amount
          const calculatedAllowance = calculateDailyAllowance(dayEntry)
          const { data: newDayEntry, error } = await supabase
            .from('day_entries')
            .insert({
              week_id: week!.id,
              date,
              time_in: dayEntry.time_in,
              time_out: dayEntry.time_out,
              status: dayEntry.status || 'office',
              allowance_amount: calculatedAllowance,
              office: dayEntry.office,
              city: dayEntry.city,
              country: dayEntry.country,
              project_id: dayEntry.project_id
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
            status: 'office' as const,
            allowance_amount: 0,
            office: null,
            city: null,
            country: null,
            project_id: null,
            travel_start_time: null,
            travel_end_time: null,
            travel_from_location: null,
            travel_to_location: null,
            travel_custom_from_location: null,
            travel_custom_to_location: null,
            travel_description: null,
            created_at: '',
            updated_at: ''
          }),
          [field]: value
        }
      }
    }))
    
    // Handle day status changes - implement business rules
    if (field === 'status') {
      // If changing to travel, open the travel expense modal
      if (value === 'travel') {
        // Open travel expense modal to capture detailed travel information
        setTimeout(() => {
          openTravelExpenseModal(date)
        }, 100) // Small delay to ensure state is updated
      }
      
      // If changing to day_off, vacation, weekend, or bank_holiday, clear time entries
      if (value === 'day_off' || value === 'vacation' || value === 'weekend' || value === 'bank_holiday') {
        setData(prev => ({
          ...prev,
          dayEntries: {
            ...prev.dayEntries,
            [date]: {
              ...prev.dayEntries[date],
              status: value,
              time_in: null,
              time_out: null,
              allowance_amount: 0,
              office: null,
              city: null,
              country: null,
              project_id: null,
              travel_start_time: null,
              travel_end_time: null,
              travel_from_location: null,
              travel_to_location: null,
              travel_custom_from_location: null,
              travel_custom_to_location: null,
              travel_description: null
            }
          }
        }))
      }
      // If changing away from travel, clear travel fields
      else {
        setData(prev => {
          const currentStatus = prev.dayEntries[date]?.status
          if (currentStatus === 'travel' && value !== 'travel') {
            return {
              ...prev,
              dayEntries: {
                ...prev.dayEntries,
                [date]: {
                  ...prev.dayEntries[date],
                  status: value,
                  office: null,
                  city: null,
                  country: null,
                  travel_start_time: null,
                  travel_end_time: null,
                  travel_from_location: null,
                  travel_to_location: null,
                  travel_custom_from_location: null,
                  travel_custom_to_location: null,
                  travel_description: null
                }
              }
            }
          }
          return prev
        })
      }
    }
  }

  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => {
      const isCurrentlyExpanded = prev[date]
      
      if (isCurrentlyExpanded) {
        // If already expanded, collapse it
        return {
          ...prev,
          [date]: false
        }
      } else {
        // If not expanded, expand this one and collapse all others (accordion behavior)
        const newExpanded: Record<string, boolean> = {}
        // Set all days to false (collapsed)
        weekDays.forEach(day => {
          const dayStr = format(day, 'yyyy-MM-dd')
          newExpanded[dayStr] = false
        })
        // Set the clicked day to true (expanded)
        newExpanded[date] = true
        return newExpanded
      }
    })
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
        handleDayEntryChange(dateStr, 'status', 'office')
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

  const openTravelExpenseModal = (dateStr: string, travelExpenseId?: string) => {
    setCurrentModalDate(dateStr)
    setEditingTravelExpenseId(travelExpenseId || null)
    setShowTravelExpenseModal(true)
  }

  const closeModals = () => {
    setShowProjectModal(false)
    setShowExpenseModal(false)
    setShowTravelExpenseModal(false)
    setCurrentModalDate('')
    setEditingProjectId(null)
    setEditingExpenseId(null)
    setEditingTravelExpenseId(null)
  }

  const saveProjectEntry = async (projectData: {
    project_id: string
    location: 'remote' | 'onsite'
    man_days: number
    description: string
    travel_chargeable: boolean
    office?: string
    city?: string
    country?: string
  }) => {
    if (!user || !currentModalDate) return

    try {
      if (editingProjectId) {
        // Update existing project entry via direct database call
        const dayEntry = data.dayEntries[currentModalDate]
        if (!dayEntry?.id) return
        
        const { error } = await supabase
          .from('project_entries')
          .update(projectData)
          .eq('id', editingProjectId)
        
        if (error) throw error
      } else {
        // Refresh session before creating project entry to avoid session expiration
        console.log('Refreshing session before creating project entry...')
        const sessionRefreshed = await refreshSessionIfNeeded()
        if (!sessionRefreshed) {
          console.error('Session refresh failed')
          throw new Error('Session expired. Please log in again.')
        }
        
        // Get current session to ensure we have a valid token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No valid session token. Please log in again.')
        }
        
        // Create new project entry via edge function with explicit auth header
        const { data: result, error } = await supabase.functions.invoke('create-project-entry', {
          body: {
            date: currentModalDate,
            projectData
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
        
        if (error) {
          console.error('Edge function error:', error)
          throw new Error('Failed to create project entry')
        }
        
        if (!result.success) {
          console.error('Project creation failed:', result.error)
          throw new Error(result.error || 'Failed to create project entry')
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
      // You might want to show a user-friendly error message here
      alert('Failed to save project entry. Please try again.')
    }
  }

  const saveCostEntry = async (costData: {
    type: 'car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other'
    distance_km?: number
    gross_amount: number
    vat_percentage: number
    chargeable: boolean
    notes?: string
  }) => {
    if (!user || !currentModalDate) return

    try {
      if (editingExpenseId) {
        // Update existing cost entry via direct database call
        const dayEntry = data.dayEntries[currentModalDate]
        if (!dayEntry?.id) return
        
        const net_amount = costData.gross_amount / (1 + costData.vat_percentage / 100)
        const entryData = {
          ...costData,
          net_amount,
          distance_km: costData.distance_km || null,
          notes: costData.notes || null
        }
        
        const { error } = await supabase
          .from('cost_entries')
          .update(entryData)
          .eq('id', editingExpenseId)
        
        if (error) throw error
      } else {
        // Refresh session before creating cost entry to avoid session expiration
        console.log('Refreshing session before creating cost entry...')
        const sessionRefreshed = await refreshSessionIfNeeded()
        if (!sessionRefreshed) {
          console.error('Session refresh failed')
          throw new Error('Session expired. Please log in again.')
        }
        
        // Get current session to ensure we have a valid token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No valid session token. Please log in again.')
        }
        
        // Create new cost entry via edge function with explicit auth header
        const { data: result, error } = await supabase.functions.invoke('create-cost-entry', {
          body: {
            date: currentModalDate,
            costData
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
        
        if (error) {
          console.error('Edge function error:', error)
          throw new Error('Failed to create cost entry')
        }
        
        if (!result.success) {
          console.error('Cost entry creation failed:', result.error)
          throw new Error(result.error || 'Failed to create cost entry')
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
      // You might want to show a user-friendly error message here
      alert('Failed to save expense entry. Please try again.')
    }
  }

  const saveExpenseEntry = async (expenseData: {
    project_id: string
    expense_type: string
    date: string
    description?: string
    gross_amount: number
    vat_percentage: number
    distance_km?: number
    rate_per_km?: number
  }) => {
    if (!user) return

    // Validate that projects exist before creating expenses
    if ((data.projectEntries[currentModalDate] || []).length === 0) {
      alert('Please add at least one project before adding expenses.')
      return
    }

    try {
      // Refresh session before making API calls to prevent 401 errors
      const sessionRefreshed = await refreshSessionIfNeeded()
      if (!sessionRefreshed) {
        throw new Error('Authentication session expired. Please log in again.')
      }

      if (editingExpenseId) {
        // Update existing expense entry via direct database call
        const { error } = await supabase
          .from('expense_entries')
          .update({
            project_id: expenseData.project_id,
            expense_type: expenseData.expense_type,
            date: expenseData.date,
            description: expenseData.description || null,
            gross_amount: expenseData.gross_amount,
            vat_percentage: expenseData.vat_percentage,
            vat_amount: expenseData.gross_amount - (expenseData.gross_amount / (1 + expenseData.vat_percentage / 100)),
            net_amount: expenseData.gross_amount / (1 + expenseData.vat_percentage / 100),
            distance_km: expenseData.distance_km || null,
            rate_per_km: expenseData.rate_per_km || null
          })
          .eq('id', editingExpenseId)
        
        if (error) throw error
      } else {
        // Get current session to ensure we have a valid token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No valid session token. Please log in again.')
        }
        
        // Create new expense entry via edge function with explicit auth header
        const { data: result, error } = await supabase.functions.invoke('create-expense-entry', {
          body: expenseData,
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
        
        if (error) {
          console.error('Edge function error:', error)
          throw new Error('Failed to create expense entry')
        }
        
        if (!result.success) {
          console.error('Expense creation failed:', result.error)
          throw new Error(result.error || 'Failed to create expense entry')
        }
      }

      // Reload week data to refresh expense entries
      await loadWeekData()
      closeModals()
    } catch (error) {
      console.error('Error saving expense entry:', error)
      alert(`Failed to save expense entry: ${error.message || 'Please try again.'}`)
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

  const saveTravelExpenseEntry = async (travelExpenseData: {
    project_id: string
    start_date: string
    start_time: string
    outbound_from: string
    outbound_to: string
    outbound_custom_from?: string
    outbound_custom_to?: string
    end_date: string
    end_time: string
    return_from: string
    return_to: string
    return_custom_from?: string
    return_custom_to?: string
    country: string
    description?: string
    expenses?: Array<{
      id?: string
      expense_type: string
      description: string
      gross_amount: string
      vat_percentage: string
      distance_km?: string
      rate_per_km?: string
    }>
  }) => {
    if (!user || !currentModalDate) return

    // Validate that projects exist before creating travel expenses
    if ((data.projectEntries[currentModalDate] || []).length === 0) {
      alert('Please add at least one project before adding travel expenses.')
      return
    }

    try {
      // Refresh session before making API calls to prevent 401 errors
      const sessionRefreshed = await refreshSessionIfNeeded()
      if (!sessionRefreshed) {
        throw new Error('Authentication session expired. Please log in again.')
      }

      const dayEntry = data.dayEntries[currentModalDate]
      if (!dayEntry?.id) {
        throw new Error('Day entry not found. Please save the timesheet first.')
      }

      // Transform the new data structure to match the existing database schema
      const legacyTravelData = {
        project_id: travelExpenseData.project_id,
        start_time: travelExpenseData.start_time,
        end_time: travelExpenseData.end_time,
        from_location: travelExpenseData.outbound_from === 'other' ? travelExpenseData.outbound_custom_from : travelExpenseData.outbound_from,
        to_location: travelExpenseData.outbound_to === 'other' ? travelExpenseData.outbound_custom_to : travelExpenseData.outbound_to,
        country: travelExpenseData.country,
        custom_from_location: travelExpenseData.outbound_custom_from,
        custom_to_location: travelExpenseData.outbound_custom_to,
        description: `Outbound: ${travelExpenseData.outbound_from} → ${travelExpenseData.outbound_to}. Return: ${travelExpenseData.return_from} → ${travelExpenseData.return_to}. ${travelExpenseData.description || ''}`
      }

      if (editingTravelExpenseId) {
        // Update existing travel expense entry
        const { error } = await supabase
          .from('travel_expense_entries')
          .update({
            project_id: legacyTravelData.project_id,
            start_time: legacyTravelData.start_time,
            end_time: legacyTravelData.end_time,
            from_location: legacyTravelData.from_location,
            to_location: legacyTravelData.to_location,
            country: legacyTravelData.country,
            custom_from_location: legacyTravelData.custom_from_location || null,
            custom_to_location: legacyTravelData.custom_to_location || null,
            description: legacyTravelData.description || null
          })
          .eq('id', editingTravelExpenseId)
        
        if (error) throw error
      } else {
        // Create new travel expense entry
        const { error } = await supabase
          .from('travel_expense_entries')
          .insert({
            day_entry_id: dayEntry.id,
            project_id: legacyTravelData.project_id,
            start_time: legacyTravelData.start_time,
            end_time: legacyTravelData.end_time,
            from_location: legacyTravelData.from_location,
            to_location: legacyTravelData.to_location,
            country: legacyTravelData.country,
            custom_from_location: legacyTravelData.custom_from_location || null,
            custom_to_location: legacyTravelData.custom_to_location || null,
            description: legacyTravelData.description || null
          })
        
        if (error) throw error
      }

      // Handle expense entries if provided
      if (travelExpenseData.expenses && travelExpenseData.expenses.length > 0) {
        // Get current session for expense creation
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('No valid session token. Please log in again.')
        }

        // Create each expense entry
        for (const expense of travelExpenseData.expenses) {
          if (expense.expense_type && expense.gross_amount) {
            const grossAmount = parseFloat(expense.gross_amount)
            const vatPercentage = parseFloat(expense.vat_percentage)
            
            const expenseData = {
              project_id: travelExpenseData.project_id,
              expense_type: expense.expense_type,
              date: currentModalDate,
              description: expense.description || undefined,
              gross_amount: grossAmount,
              vat_percentage: vatPercentage,
              distance_km: expense.distance_km ? parseFloat(expense.distance_km) : undefined,
              rate_per_km: expense.rate_per_km ? parseFloat(expense.rate_per_km) : undefined
            }

            // Create expense entry via edge function
            const { data: result, error: expenseError } = await supabase.functions.invoke('create-expense-entry', {
              body: expenseData,
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            })
            
            if (expenseError) {
              console.error('Edge function error creating expense:', expenseError)
              throw new Error(`Failed to create expense entry: ${expense.expense_type}`)
            }
            
            if (!result.success) {
              console.error('Expense creation failed:', result.error)
              throw new Error(result.error || `Failed to create expense entry: ${expense.expense_type}`)
            }
          }
        }
      }

      // Reload week data to refresh travel expense entries
      await loadWeekData()
      closeModals()
    } catch (error) {
      console.error('Error saving travel & expense entries:', error)
      alert(`Failed to save travel & expense entries: ${error.message || 'Please try again.'}`)
    }
  }

  const deleteExpenseEntry = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expense_entries')
        .delete()
        .eq('id', expenseId)
      
      if (error) throw error
      await loadWeekData()
    } catch (error) {
      console.error('Error deleting expense entry:', error)
    }
  }

  const deleteTravelExpenseEntry = async (travelExpenseId: string) => {
    try {
      const { error } = await supabase
        .from('travel_expense_entries')
        .delete()
        .eq('id', travelExpenseId)
      
      if (error) throw error
      await loadWeekData()
    } catch (error) {
      console.error('Error deleting travel expense entry:', error)
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
      
      // Auto-expand the day
      setExpandedDays(prev => ({ ...prev, [dateStr]: true }))
    }
  }
  
  const applyWeekdayTemplate = () => {
    weekDays.slice(0, 5).forEach(day => { // Mon-Fri
      const dateStr = format(day, 'yyyy-MM-dd')
      handleDayEntryChange(dateStr, 'time_in', '08:00')
      handleDayEntryChange(dateStr, 'time_out', '18:00')
      handleDayEntryChange(dateStr, 'status', 'office')
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
    return dayEntry?.status === 'day_off' || dayEntry?.status === 'vacation' || dayEntry?.status === 'weekend' || dayEntry?.status === 'bank_holiday'
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
                className={clsx(
                  "shadow-sm",
                  {
                    "w-full": isMobile,
                  }
                )}
              >
                <Clock className="h-4 w-4" />
                Fill Weekdays
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
                className={clsx(
                  "shadow-lg",
                  {
                    "w-full": isMobile,
                  }
                )}
              >
                <Save className="h-4 w-4" />
                Save Timesheet
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

      {/* Project Assignments Section */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="border-b border-border/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                Project Assignments
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {(() => {
                  let totalProjects = 0
                  Object.values(data.projectEntries).forEach(dayProjects => {
                    totalProjects += dayProjects.length
                  })
                  return totalProjects
                })()}{' Projects'}
              </p>
            </div>
            {!isReadOnly && (
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => {
                  // Find the first day with data or current day
                  const today = format(new Date(), 'yyyy-MM-dd')
                  const currentWeekDay = weekDays.find(day => format(day, 'yyyy-MM-dd') === today)
                  const targetDate = currentWeekDay ? today : format(weekDays[0], 'yyyy-MM-dd')
                  openProjectModal(targetDate)
                }}
                className="shadow-lg"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Project
              </Button>
            )}
          </div>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground font-medium">Loading timesheet...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const dayEntry = data.dayEntries[dateStr]
                const isExpanded = expandedDays[dateStr]
                const hasData = dayEntry && (dayEntry.time_in || dayEntry.time_out)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                
                return (
                  <div key={dateStr} className={clsx(
                    'border rounded-lg overflow-hidden transition-all duration-200',
                    {
                      'border-border bg-card': !isWeekend,
                      'border-muted bg-muted/30': isWeekend,
                      'shadow-md': isExpanded,
                      'hover:shadow-sm': !isExpanded,
                    }
                  )}>
                    <div 
                      className="px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors duration-200 active:bg-accent/50 interactive"
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
                          "flex-col space-y-2": isMobile,
                          "justify-between": !isMobile,
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
                            "flex-shrink-0",
                            {
                              "text-center": isMobile,
                              "w-16": !isMobile,
                            }
                          )}>
                            <div className={clsx(
                              'font-semibold text-sm',
                              {
                                'text-foreground': !isWeekend,
                                'text-muted-foreground': isWeekend,
                              }
                            )}>
                              {format(day, 'EEE')}
                            </div>
                            <div className={clsx(
                              'text-xs',
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
                              "flex-col space-y-2 w-full": isMobile,
                              "space-x-3": !isMobile,
                            }
                          )}>
                            <div className={clsx(
                              "flex items-center",
                              {
                                "flex-col space-y-1 w-full": isMobile,
                                "space-x-3": !isMobile,
                              }
                            )}>
                              <div className={clsx(
                                "flex items-center",
                                {
                                  "space-x-2 w-full justify-center": isMobile,
                                  "space-x-2": !isMobile,
                                }
                              )}>
                                <Input
                                  type="time"
                                  value={dayEntry?.time_in || ''}
                                  onChange={(e) => {
                                    handleDayEntryChange(dateStr, 'time_in', e.target.value)
                                    // Auto-expand if time is entered (accordion behavior)
                                    if (e.target.value && !isExpanded) {
                                      setExpandedDays(prev => {
                                        const newExpanded: Record<string, boolean> = {}
                                        weekDays.forEach(day => {
                                          const dayStr = format(day, 'yyyy-MM-dd')
                                          newExpanded[dayStr] = dayStr === dateStr
                                        })
                                        return newExpanded
                                      })
                                    }
                                  }}
                                  className={clsx(
                                    "premium-focus",
                                    {
                                      "flex-1": isMobile,
                                      "w-20": !isMobile,
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
                                    // Auto-expand if time is entered (accordion behavior)
                                    if (e.target.value && !isExpanded) {
                                      setExpandedDays(prev => {
                                        const newExpanded: Record<string, boolean> = {}
                                        weekDays.forEach(day => {
                                          const dayStr = format(day, 'yyyy-MM-dd')
                                          newExpanded[dayStr] = dayStr === dateStr
                                        })
                                        return newExpanded
                                      })
                                    }
                                  }}
                                  className={clsx(
                                    "premium-focus",
                                    {
                                      "flex-1": isMobile,
                                      "w-20": !isMobile,
                                    }
                                  )}
                                  disabled={isReadOnly || isFormDisabled(dateStr)}
                                  onClick={(e) => e.stopPropagation()}
                                  label={isMobile ? "End" : undefined}
                                  variant={isMobile ? "floating" : "default"}
                                />
                              </div>
                              
                              <Select
                                value={dayEntry?.status || 'office'}
                                onChange={(e) => {
                                  handleDayEntryChange(dateStr, 'status', e.target.value)
                                  // Auto-expand if status is changed (accordion behavior)
                                  if (!isExpanded) {
                                    setExpandedDays(prev => {
                                      const newExpanded: Record<string, boolean> = {}
                                      weekDays.forEach(day => {
                                        const dayStr = format(day, 'yyyy-MM-dd')
                                        newExpanded[dayStr] = dayStr === dateStr
                                      })
                                      return newExpanded
                                    })
                                  }
                                }}
                                className={clsx(
                                  "premium-focus",
                                  {
                                    "w-full": isMobile,
                                    "w-32": !isMobile,
                                  }
                                )}
                                disabled={isReadOnly}
                                onClick={(e) => e.stopPropagation()}
                                options={isWeekend ? [
                                  { value: 'weekend', label: 'Weekend' },
                                  { value: 'day_off', label: 'Day Off' },
                                  { value: 'vacation', label: 'Vacation' },
                                  { value: 'bank_holiday', label: 'Bank Holiday' },
                                  { value: 'travel', label: 'Travel' },
                                  { value: 'office', label: 'Office' },
                                  { value: 'active', label: 'Active' }
                                ] : [
                                  { value: 'office', label: 'Office' },
                                  { value: 'active', label: 'Active' },
                                  { value: 'day_off', label: 'Day Off' },
                                  { value: 'vacation', label: 'Vacation' },
                                  { value: 'travel', label: 'Travel' },
                                  { value: 'weekend', label: 'Weekend' },
                                  { value: 'bank_holiday', label: 'Bank Holiday' }
                                ]}
                                label={isMobile ? "Status" : undefined}
                                variant={isMobile ? "floating" : "default"}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Conditional Travel Fields */}
                        {dayEntry?.status === 'travel' && (
                          <TravelFields
                            dateStr={dateStr}
                            office={dayEntry?.office}
                            city={dayEntry?.city}
                            country={dayEntry?.country}
                            projectId={dayEntry?.project_id}
                            countries={countries}
                            projects={projects}
                            citySuggestions={citySuggestions}
                            isMobile={isMobile}
                            isReadOnly={isReadOnly}
                            onChange={(field, value) => {
                              handleDayEntryChange(dateStr, field, value)
                              // Update smart defaults when user changes values
                              if (field === 'office' && value) {
                                setSmartDefaults(prev => ({ 
                                  ...prev, 
                                  lastOffice: value,
                                  recentOffices: [value, ...prev.recentOffices.filter(o => o !== value)].slice(0, 5)
                                }))
                              }
                              if (field === 'city' && value) {
                                setSmartDefaults(prev => ({ ...prev, lastCity: value }))
                              }
                              if (field === 'country' && value) {
                                setSmartDefaults(prev => ({ ...prev, lastCountry: value }))
                              }
                            }}
                            smartDefaults={{
                              lastOffice: smartDefaults.lastOffice,
                              lastCity: smartDefaults.lastCity,
                              lastCountry: smartDefaults.lastCountry,
                              recentOffices: smartDefaults.recentOffices
                            }}
                          />
                        )}
                        
                        <div className={clsx(
                          "flex items-center",
                          {
                            "justify-center space-x-3 mt-1": isMobile,
                            "space-x-3": !isMobile,
                          }
                        )}>
                          {hasData && (
                            <div className="text-center">
                              <span className="text-xs font-semibold text-primary">
                                {(() => {
                                  // Improved hours calculation logic
                                  const calculateHours = (timeIn, timeOut) => {
                                    if (!timeIn || !timeOut) return '0h'
                                    
                                    try {
                                      // Normalize time format - ensure HH:MM format
                                      const normalizeTime = (time) => {
                                        if (typeof time !== 'string') return '00:00'
                                        const cleaned = time.trim()
                                        if (cleaned.match(/^\d{1,2}:\d{2}$/)) return cleaned
                                        if (cleaned.match(/^\d{1,2}:\d{2}:\d{2}$/)) return cleaned.slice(0, 5)
                                        return '00:00'
                                      }
                                      
                                      const normalizedTimeIn = normalizeTime(timeIn)
                                      const normalizedTimeOut = normalizeTime(timeOut)
                                      
                                      // Create date objects for calculation
                                      const startTime = new Date(`1970-01-01T${normalizedTimeIn}:00`)
                                      const endTime = new Date(`1970-01-01T${normalizedTimeOut}:00`)
                                      
                                      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                                        return '0h'
                                      }
                                      
                                      let timeDiff = endTime.getTime() - startTime.getTime()
                                      
                                      // Handle cases where end time is next day (e.g., night shift)
                                      if (timeDiff < 0) {
                                        timeDiff += 24 * 60 * 60 * 1000 // Add 24 hours
                                      }
                                      
                                      const hours = timeDiff / (1000 * 60 * 60)
                                      return hours > 0 ? `${hours.toFixed(1)}h` : '0h'
                                    } catch (error) {
                                      console.error('Error calculating hours:', error)
                                      return '0h'
                                    }
                                  }
                                  
                                  return calculateHours(dayEntry?.time_in, dayEntry?.time_out)
                                })()
                                }
                              </span>
                              <p className="text-xs text-muted-foreground">hours</p>
                            </div>
                          )}
                          <div className={clsx(
                            'transition-transform duration-200 min-h-[32px] min-w-[32px] flex items-center justify-center',
                            {
                              'rotate-180': isExpanded,
                            }
                          )}>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Day Details */}
                    {isExpanded && (
                      <div className="border-t border-border/50 bg-card/50 p-4 space-y-4">
                        {/* Project Entries */}
                        <div className="space-y-3">
                        {/* Project Assignments */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground flex items-center">
                                <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs mr-2">
                                  {(data.projectEntries[dateStr] || []).length} Project{(data.projectEntries[dateStr] || []).length !== 1 ? 's' : ''}
                                </span>
                                Project Assignments
                              </h4>
                              <p className="text-xs text-muted-foreground">Add projects first to enable expense tracking</p>
                            </div>
                            {!isReadOnly && (
                              <div className="flex items-center space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="interactive h-8 px-3 text-xs"
                                  onClick={() => openProjectModal(dateStr)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Project
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Display existing project entries */}
                          {data.projectEntries[dateStr] && data.projectEntries[dateStr].length > 0 ? (
                            <div className="space-y-2">
                              {data.projectEntries[dateStr].map((projectEntry: ProjectEntry) => {
                                const project = projects.find(p => p.id === projectEntry.project_id)
                                return (
                                  <div key={projectEntry.id} className="bg-card border border-border rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
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
                            <div className="bg-muted/20 rounded-lg p-4 text-center border-2 border-dashed border-muted">
                              <div className="text-muted-foreground">
                                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium mb-1">No projects assigned for this day</p>
                                <p className="text-xs mb-3">Add projects first to enable expense tracking</p>
                                {!isReadOnly && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openProjectModal(dateStr)}
                                    className="text-primary border-primary hover:bg-primary/10"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add First Project
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                          
                          
                          {/* Display all expenses grouped by project */}
                          {(() => {
                            const allExpenses = [
                              ...(data.costEntries[dateStr] || []).map(entry => ({ ...entry, type: 'cost', projectId: null })),
                              ...(data.expenseEntries[dateStr] || []).map(entry => ({ ...entry, type: 'expense', projectId: entry.project_id }))
                            ]
                            
                            if (allExpenses.length === 0) {
                              return (
                                <div className="bg-muted/20 rounded-lg p-4 text-center border-2 border-dashed border-muted">
                                  <div className="text-muted-foreground">
                                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium mb-1">
                                      {(data.projectEntries[dateStr] || []).length === 0 
                                        ? 'Add projects first to enable expenses'
                                        : 'No expenses recorded'
                                      }
                                    </p>
                                    <p className="text-xs">
                                      {(data.projectEntries[dateStr] || []).length === 0 
                                        ? 'Projects are required before adding any expenses'
                                        : 'Add travel costs, meals, or other business expenses'
                                      }
                                    </p>
                                  </div>
                                </div>
                              )
                            }
                            
                            // Group expenses by project
                            const expensesByProject = allExpenses.reduce((acc, expense) => {
                              const projectId = expense.projectId || 'unassigned'
                              if (!acc[projectId]) acc[projectId] = []
                              acc[projectId].push(expense)
                              return acc
                            }, {})
                            
                            return (
                              <div className="space-y-3">
                                {Object.entries(expensesByProject).map(([projectId, projectExpenses]: [string, any[]]) => {
                                  const project = projectId !== 'unassigned' ? projects.find(p => p.id === projectId) : null
                                  return (
                                    <div key={projectId} className="bg-card/50 border border-border/50 rounded-lg p-3">
                                      <div className="flex items-center space-x-2 mb-3">
                                        <span className="text-sm font-semibold text-foreground">
                                          {project ? project.name : 'Legacy Expenses'}
                                        </span>
                                        <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-xs">
                                          {projectExpenses.length} expense{projectExpenses.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {projectExpenses.map((expense) => {
                                          if (expense.type === 'cost') {
                                            return (
                                              <div key={expense.id} className="bg-card border border-border rounded-lg p-3">
                                                <div className="flex items-start justify-between">
                                                  <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                      <span className={clsx(
                                                        'px-2 py-1 text-xs rounded-full font-medium capitalize',
                                                        {
                                                          'bg-blue-100 text-blue-800': expense.type === 'car' || expense.type === 'taxi',
                                                          'bg-purple-100 text-purple-800': expense.type === 'hotel',
                                                          'bg-green-100 text-green-800': expense.type === 'meal',
                                                          'bg-gray-100 text-gray-800': expense.type === 'other',
                                                        }
                                                      )}>
                                                        {expense.type}
                                                      </span>
                                                      {expense.chargeable && (
                                                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                                          Chargeable
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                                                      <span className="font-medium">
                                                        ${expense.gross_amount.toFixed(2)} 
                                                        <span className="text-xs">(incl. {expense.vat_percentage}% VAT)</span>
                                                      </span>
                                                      {expense.distance_km && (
                                                        <span>{expense.distance_km} km</span>
                                                      )}
                                                    </div>
                                                    {expense.notes && (
                                                      <p className="text-sm text-muted-foreground">{expense.notes}</p>
                                                    )}
                                                  </div>
                                                  {!isReadOnly && (
                                                    <div className="flex items-center space-x-2 ml-4">
                                                      <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => openExpenseModal(dateStr, expense.id)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                      >
                                                        Edit
                                                      </Button>
                                                      <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => deleteCostEntry(expense.id)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          } else {
                                            return (
                                              <div key={expense.id} className="bg-card border border-border rounded-lg p-3">
                                                <div className="flex items-start justify-between">
                                                  <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                      <span className={clsx(
                                                        'px-2 py-1 text-xs rounded-full font-medium capitalize',
                                                        {
                                                          'bg-blue-100 text-blue-800': expense.expense_type === 'car' || expense.expense_type === 'taxi',
                                                          'bg-purple-100 text-purple-800': expense.expense_type === 'hotel',
                                                          'bg-green-100 text-green-800': expense.expense_type === 'train' || expense.expense_type === 'onpv',
                                                          'bg-orange-100 text-orange-800': expense.expense_type === 'flight',
                                                          'bg-gray-100 text-gray-800': ['fuel', 'parking', 'hospitality', 'others'].includes(expense.expense_type),
                                                          'bg-yellow-100 text-yellow-800': expense.expense_type === 'rental_car',
                                                        }
                                                      )}>
                                                        {expense.expense_type.replace('_', ' ')}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-1">
                                                      <span className="font-medium">
                                                        €{expense.gross_amount.toFixed(2)} 
                                                        <span className="text-xs">(incl. {expense.vat_percentage}% VAT)</span>
                                                      </span>
                                                      {expense.distance_km && (
                                                        <span>{expense.distance_km} km × €{expense.rate_per_km}/km</span>
                                                      )}
                                                    </div>
                                                    {expense.description && (
                                                      <p className="text-sm text-muted-foreground">{expense.description}</p>
                                                    )}
                                                    <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 inline-block">
                                                      Net: €{expense.net_amount.toFixed(2)} + VAT: €{expense.vat_amount.toFixed(2)}
                                                    </div>
                                                  </div>
                                                  {!isReadOnly && (
                                                    <div className="flex items-center space-x-2 ml-4">
                                                      <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => openExpenseModal(dateStr, expense.id)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                      >
                                                        Edit
                                                      </Button>
                                                      <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => deleteExpenseEntry(expense.id)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          }
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </div>
                        
                        {/* Travel Expense Entries - Only show for travel days */}
                        {dayEntry?.status === 'travel' && (
                          <div className="space-y-3 bg-travel/5 border border-travel/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-foreground flex items-center">
                                  <svg className="h-4 w-4 mr-2 text-travel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Travel Expense Details
                                </h4>
                                <p className="text-xs text-muted-foreground">Detailed travel information with location and timing data</p>
                              </div>
                              {!isReadOnly && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="interactive h-8 px-3 text-xs border-travel text-travel hover:bg-travel/10"
                                  onClick={() => openTravelExpenseModal(dateStr)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                   Add Travel & Expenses
                                </Button>
                              )}
                            </div>
                            
                            {/* Display existing travel expense entries */}
                            {data.travelExpenseEntries[dateStr] && data.travelExpenseEntries[dateStr].length > 0 ? (
                              <div className="space-y-2">
                                {data.travelExpenseEntries[dateStr].map((travelEntry: TravelExpenseEntry) => {
                                  const project = projects.find(p => p.id === travelEntry.project_id)
                                  return (
                                    <div key={travelEntry.id} className="bg-card border border-border rounded-lg p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2 mb-2">
                                            <span className="text-sm font-semibold text-foreground">
                                              {project?.name || 'Unknown Project'}
                                            </span>
                                            <span className="px-2 py-1 text-xs rounded-full font-medium bg-travel/20 text-travel">
                                              Travel Details
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-2">
                                            <div>
                                              <span className="font-medium">Time:</span> {travelEntry.start_time} - {travelEntry.end_time}
                                            </div>
                                            <div>
                                              <span className="font-medium">Country:</span> {travelEntry.country}
                                            </div>
                                            <div className="col-span-2">
                                              <span className="font-medium">Route:</span> {travelEntry.from_location} → {travelEntry.to_location}
                                            </div>
                                          </div>
                                          {travelEntry.description && (
                                            <p className="text-sm text-muted-foreground bg-muted/30 rounded px-2 py-1">
                                              {travelEntry.description}
                                            </p>
                                          )}
                                        </div>
                                        {!isReadOnly && (
                                          <div className="flex items-center space-x-2 ml-4">
                                            <Button 
                                              size="sm" 
                                              variant="ghost"
                                              onClick={() => openTravelExpenseModal(dateStr, travelEntry.id)}
                                              className="text-muted-foreground hover:text-foreground"
                                            >
                                              Edit
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="ghost"
                                              onClick={() => deleteTravelExpenseEntry(travelEntry.id)}
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
                              <div className="bg-muted/30 rounded-lg p-4 text-center border border-dashed border-muted">
                                <div className="text-muted-foreground">
                                  <svg className="h-6 w-6 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <p className="text-xs font-medium mb-1">No travel details recorded</p>
                                  <p className="text-xs">Click 'Add Travel Details' to record your travel information</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Summary */}
                        <div className="flex justify-between items-center pt-4 border-t border-border/30">
                          <div className="text-sm text-muted-foreground">
                            Daily summary for {format(day, 'EEEE, MMMM d')}
                          </div>
                          {/* Conditional Daily Allowance - Only show for travel days */}
                          {dayEntry?.status === 'travel' && (
                            <div className="text-sm font-semibold">
                              <span className="text-muted-foreground">Daily Allowance: </span>
                              <span className={clsx(
                                'font-bold',
                                {
                                  'text-success': dayEntry && calculateDailyAllowance(dayEntry) > 0,
                                  'text-muted-foreground': !dayEntry || calculateDailyAllowance(dayEntry) === 0,
                                }
                              )}>
                                {dayEntry ? `${getCurrencySymbol(defaultCurrency)}${calculateDailyAllowance(dayEntry).toFixed(2)}` : `${getCurrencySymbol(defaultCurrency)}0.00`}
                              </span>
                            </div>
                          )}
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
      
      {/* Expenses Section */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="border-b border-border/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <Receipt className="h-5 w-5 mr-2 text-secondary" />
                Expenses
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {(() => {
                  let totalExpenses = 0
                  Object.values(data.expenseEntries).forEach(dayExpenses => {
                    totalExpenses += dayExpenses.length
                  })
                  Object.values(data.costEntries).forEach(dayCosts => {
                    totalExpenses += dayCosts.length
                  })
                  Object.values(data.travelExpenseEntries).forEach(dayTravelExpenses => {
                    totalExpenses += dayTravelExpenses.length
                  })
                  return totalExpenses
                })()}{' Expenses'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {!isReadOnly && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Check if any projects exist
                      const hasProjects = Object.values(data.projectEntries).some(dayProjects => dayProjects.length > 0)
                      if (!hasProjects) {
                        alert('Please add at least one project before adding expenses.')
                        return
                      }
                      // Find the first day with projects or current day
                      const today = format(new Date(), 'yyyy-MM-dd')
                      const currentWeekDay = weekDays.find(day => format(day, 'yyyy-MM-dd') === today)
                      let targetDate = currentWeekDay ? today : format(weekDays[0], 'yyyy-MM-dd')
                      
                      // If the target date has no projects, find the first day with projects
                      if ((data.projectEntries[targetDate] || []).length === 0) {
                        const dayWithProjects = Object.keys(data.projectEntries).find(date => 
                          (data.projectEntries[date] || []).length > 0
                        )
                        if (dayWithProjects) targetDate = dayWithProjects
                      }
                      
                      openExpenseModal(targetDate)
                    }}
                    className="shadow-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Normal Expense
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Check if any projects exist
                      const hasProjects = Object.values(data.projectEntries).some(dayProjects => dayProjects.length > 0)
                      if (!hasProjects) {
                        alert('Please add at least one project before adding travel expenses.')
                        return
                      }
                      // Find the first travel day with projects
                      const travelDayWithProjects = weekDays.find(day => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const dayEntry = data.dayEntries[dateStr]
                        return dayEntry?.status === 'travel' && (data.projectEntries[dateStr] || []).length > 0
                      })
                      
                      let targetDate = format(weekDays[0], 'yyyy-MM-dd')
                      if (travelDayWithProjects) {
                        targetDate = format(travelDayWithProjects, 'yyyy-MM-dd')
                      } else {
                        // If no travel day with projects, find any day with projects
                        const dayWithProjects = Object.keys(data.projectEntries).find(date => 
                          (data.projectEntries[date] || []).length > 0
                        )
                        if (dayWithProjects) targetDate = dayWithProjects
                      }
                      
                      openTravelExpenseModal(targetDate)
                    }}
                    className="shadow-sm border-travel text-travel hover:bg-travel/10"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Travel & Expenses
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-4">
          {(() => {
            // Collect all expenses across the week and group by project
            const allWeekExpenses = []
            
            // Collect all expenses from all days
            weekDays.forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              
              // Normal expense entries
              if (data.expenseEntries[dateStr]) {
                data.expenseEntries[dateStr].forEach(expense => {
                  allWeekExpenses.push({
                    ...expense,
                    type: 'expense',
                    date: dateStr,
                    projectId: expense.project_id
                  })
                })
              }
              
              // Cost entries (legacy, may not have project association)
              if (data.costEntries[dateStr]) {
                data.costEntries[dateStr].forEach(cost => {
                  allWeekExpenses.push({
                    ...cost,
                    type: 'cost',
                    date: dateStr,
                    projectId: null // Legacy expenses don't have project association
                  })
                })
              }
              
              // Travel expense entries
              if (data.travelExpenseEntries[dateStr]) {
                data.travelExpenseEntries[dateStr].forEach(travelExpense => {
                  allWeekExpenses.push({
                    ...travelExpense,
                    type: 'travel',
                    date: dateStr,
                    projectId: travelExpense.project_id
                  })
                })
              }
            })
            
            if (allWeekExpenses.length === 0) {
              return (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="font-medium mb-2">No expenses recorded this week</p>
                    <p className="text-sm">Add projects first, then use the buttons above to add expenses</p>
                  </div>
                </div>
              )
            }
            
            // Group expenses by project
            const expensesByProject = allWeekExpenses.reduce((acc, expense) => {
              const projectId = expense.projectId || 'unassigned'
              if (!acc[projectId]) {
                acc[projectId] = []
              }
              acc[projectId].push(expense)
              return acc
            }, {})
            
            return (
              <div className="space-y-6">
                {Object.entries(expensesByProject).map(([projectId, projectExpenses]: [string, any[]]) => {
                  const project = projectId !== 'unassigned' 
                    ? projects.find(p => p.id === projectId) 
                    : null
                    
                  // Calculate project total
                  const projectTotal = projectExpenses.reduce((total, expense) => {
                    if (expense.type === 'expense' || expense.type === 'cost') {
                      return total + (expense.gross_amount || 0)
                    }
                    return total
                  }, 0)
                  
                  return (
                    <div key={projectId} className="bg-card/50 border border-border/50 rounded-lg overflow-hidden">
                      {/* Project Header */}
                      <div className="border-b border-border/30 px-4 py-3 bg-accent/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground flex items-center">
                              <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                              {project ? project.name : 'Legacy Expenses'}
                            </h3>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">
                              €{projectTotal.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {projectExpenses.length} expense{projectExpenses.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expense List */}
                      <div className="p-4 space-y-3">
                        {projectExpenses.map((expense, index) => {
                          const expenseDate = new Date(expense.date)
                          
                          if (expense.type === 'expense') {
                            return (
                              <div key={`expense-${expense.id || index}`} className="bg-card border border-border rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-foreground">
                                        {format(expenseDate, 'EEE, MMM d')}
                                      </span>
                                      <span className={clsx(
                                        'px-2 py-1 text-xs rounded-full font-medium capitalize',
                                        {
                                          'bg-blue-100 text-blue-800': ['car', 'taxi', 'rental_car'].includes(expense.expense_type),
                                          'bg-purple-100 text-purple-800': expense.expense_type === 'hotel',
                                          'bg-green-100 text-green-800': ['train', 'onpv'].includes(expense.expense_type),
                                          'bg-orange-100 text-orange-800': expense.expense_type === 'flight',
                                          'bg-gray-100 text-gray-800': ['fuel', 'parking', 'hospitality', 'others'].includes(expense.expense_type),
                                        }
                                      )}>
                                        {expense.expense_type?.replace('_', ' ') || 'Expense'}
                                      </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-1">
                                      <span className="font-medium">€{expense.gross_amount.toFixed(2)}</span>
                                      <span className="text-xs ml-1">(incl. {expense.vat_percentage}% VAT)</span>
                                      {expense.distance_km && (
                                        <span className="ml-3">{expense.distance_km} km × €{expense.rate_per_km}/km</span>
                                      )}
                                    </div>
                                    {expense.description && (
                                      <p className="text-sm text-muted-foreground">{expense.description}</p>
                                    )}
                                    <div className="mt-1 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 inline-block">
                                      Net: €{expense.net_amount?.toFixed(2)} + VAT: €{expense.vat_amount?.toFixed(2)}
                                    </div>
                                  </div>
                                  {!isReadOnly && (
                                    <div className="flex items-center space-x-2 ml-4">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => {
                                          setCurrentModalDate(expense.date)
                                          setEditingExpenseId(expense.id)
                                          setShowExpenseModal(true)
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => deleteExpenseEntry(expense.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          } else if (expense.type === 'cost') {
                            return (
                              <div key={`cost-${expense.id || index}`} className="bg-card border border-border rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-foreground">
                                        {format(expenseDate, 'EEE, MMM d')}
                                      </span>
                                      <span className={clsx(
                                        'px-2 py-1 text-xs rounded-full font-medium capitalize',
                                        {
                                          'bg-blue-100 text-blue-800': expense.type === 'car' || expense.type === 'taxi',
                                          'bg-purple-100 text-purple-800': expense.type === 'hotel',
                                          'bg-green-100 text-green-800': expense.type === 'meal',
                                          'bg-gray-100 text-gray-800': expense.type === 'other',
                                        }
                                      )}>
                                        {expense.type || 'Cost Entry'}
                                      </span>
                                      {expense.chargeable && (
                                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                          Chargeable
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-1">
                                      <span className="font-medium">${expense.gross_amount.toFixed(2)}</span>
                                      <span className="text-xs ml-1">(incl. {expense.vat_percentage}% VAT)</span>
                                      {expense.distance_km && (
                                        <span className="ml-3">{expense.distance_km} km</span>
                                      )}
                                    </div>
                                    {expense.notes && (
                                      <p className="text-sm text-muted-foreground">{expense.notes}</p>
                                    )}
                                  </div>
                                  {!isReadOnly && (
                                    <div className="flex items-center space-x-2 ml-4">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => {
                                          setCurrentModalDate(expense.date)
                                          setEditingExpenseId(expense.id)
                                          setShowExpenseModal(true)
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => deleteCostEntry(expense.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          } else if (expense.type === 'travel') {
                            return (
                              <div key={`travel-${expense.id || index}`} className="bg-card border border-travel/20 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-foreground">
                                        {format(expenseDate, 'EEE, MMM d')}
                                      </span>
                                      <span className="px-2 py-1 text-xs rounded-full font-medium bg-travel/20 text-travel">
                                        Travel Details
                                      </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                      <div className="mb-1">
                                        <span className="font-medium">Time:</span> {expense.start_time} - {expense.end_time}
                                      </div>
                                      <div className="mb-1">
                                        <span className="font-medium">Route:</span> {expense.from_location} → {expense.to_location}
                                      </div>
                                      <div>
                                        <span className="font-medium">Country:</span> {expense.country}
                                      </div>
                                    </div>
                                    {expense.description && (
                                      <p className="text-sm text-muted-foreground bg-muted/30 rounded px-2 py-1">
                                        {expense.description}
                                      </p>
                                    )}
                                  </div>
                                  {!isReadOnly && (
                                    <div className="flex items-center space-x-2 ml-4">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => {
                                          setCurrentModalDate(expense.date)
                                          setEditingTravelExpenseId(expense.id)
                                          setShowTravelExpenseModal(true)
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => deleteTravelExpenseEntry(expense.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          
                          return null
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
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
          onSave={saveExpenseEntry}
          projects={projects}
          date={currentModalDate}
          editingExpense={editingExpenseId ? data.expenseEntries[currentModalDate]?.find(e => e.id === editingExpenseId) : undefined}
        />
      )}
      
      {/* Travel Expense Modal */}
      {showTravelExpenseModal && (
        <TravelExpenseModal
          isOpen={showTravelExpenseModal}
          onClose={closeModals}
          onSave={saveTravelExpenseEntry}
          projects={projects}
          countries={countries}
          date={currentModalDate}
          defaultValues={editingTravelExpenseId ? data.travelExpenseEntries[currentModalDate]?.find(te => te.id === editingTravelExpenseId) : undefined}
        />
      )}
      
      </div>
    </div>
  )
}