import React, { useState, useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Week } from '../lib/supabase'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Search, Eye } from 'lucide-react'
import { clsx } from 'clsx'

interface WeekWithDetails extends Week {
  total_hours?: number
  total_days?: number
}

export function TimesheetHistoryPage() {
  const { user } = useAuth()
  const [weeks, setWeeks] = useState<WeekWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [selectedWeek, setSelectedWeek] = useState<WeekWithDetails | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [weekDetails, setWeekDetails] = useState<any>(null)

  useEffect(() => {
    if (user) {
      loadTimesheetHistory()
    }
  }, [user])

  const loadTimesheetHistory = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data: weeksData, error } = await supabase
        .from('weeks')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
      
      if (error) throw error
      
      // Calculate totals for each week
      const weeksWithTotals = await Promise.all(
        (weeksData || []).map(async (week) => {
          const { data: dayEntries } = await supabase
            .from('day_entries')
            .select('*')
            .eq('week_id', week.id)
          
          let totalHours = 0
          let totalDays = 0
          
          if (dayEntries) {
            dayEntries.forEach(day => {
              if (day.time_in && day.time_out) {
                const timeIn = new Date(`2000-01-01T${day.time_in}`)
                const timeOut = new Date(`2000-01-01T${day.time_out}`)
                const hours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60)
                totalHours += hours
                totalDays += 1
              }
            })
          }
          
          return {
            ...week,
            total_hours: totalHours,
            total_days: totalDays
          }
        })
      )
      
      setWeeks(weeksWithTotals)
    } catch (error) {
      console.error('Error loading timesheet history:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWeekDetails = async (week: WeekWithDetails) => {
    try {
      const { data: dayEntries } = await supabase
        .from('day_entries')
        .select(`
          *,
          project_entries (*),
          cost_entries (*)
        `)
        .eq('week_id', week.id)
        .order('date')
      
      setWeekDetails(dayEntries)
      setSelectedWeek(week)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading week details:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <AlertCircle className="h-4 w-4" />
      case 'submitted':
        return <Clock className="h-4 w-4" />
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-muted/50 text-muted-foreground border-muted'
      case 'submitted':
        return 'bg-info/10 text-info border-info/20'
      case 'approved':
        return 'bg-success/10 text-success border-success/20'
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20'
      default:
        return 'bg-muted text-muted-foreground border-muted'
    }
  }

  const filteredWeeks = weeks.filter(week => {
    const matchesSearch = format(parseISO(week.week_start), 'MMM d, yyyy').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || week.status === statusFilter
    
    let matchesDate = true
    if (dateFilter !== 'all') {
      const weekStart = parseISO(week.week_start)
      const now = new Date()
      
      switch (dateFilter) {
        case 'current_month':
          matchesDate = weekStart.getMonth() === now.getMonth() && weekStart.getFullYear() === now.getFullYear()
          break
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
          matchesDate = weekStart.getMonth() === lastMonth.getMonth() && weekStart.getFullYear() === lastMonth.getFullYear()
          break
        case 'last_3_months':
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3)
          matchesDate = weekStart >= threeMonthsAgo
          break
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Timesheet History
          </h1>
          <p className="text-muted-foreground mt-1">
            View your submitted timesheets and their approval status
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="modern-card glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search by week..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
          
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' }
            ]}
          />
          
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Time' },
              { value: 'current_month', label: 'Current Month' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'last_3_months', label: 'Last 3 Months' }
            ]}
          />
        </div>
      </div>

      {/* History Table */}
      <div className="modern-card glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading timesheet history...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Week</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Total Hours</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Days Worked</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Submitted</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Comments</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWeeks.map((week) => (
                  <tr key={week.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">
                            {format(parseISO(week.week_start), 'MMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Week {format(parseISO(week.week_start), 'w')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-foreground">
                        {week.total_hours?.toFixed(1) || '0'} hours
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-foreground">
                        {week.total_days || 0} days
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={clsx(
                          'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2',
                          getStatusColor(week.status)
                        )}>
                          {getStatusIcon(week.status)}
                          <span>{week.status.charAt(0).toUpperCase() + week.status.slice(1)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {week.submitted_at ? (
                        <div>
                          <p className="text-foreground">
                            {format(parseISO(week.submitted_at), 'MMM d, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(week.submitted_at), 'h:mm a')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not submitted</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {week.rejection_reason ? (
                        <div className="max-w-xs">
                          <p className="text-sm text-destructive truncate" title={week.rejection_reason}>
                            {week.rejection_reason}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No comments</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadWeekDetails(week)}
                        icon={<Eye className="h-4 w-4" />}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredWeeks.length === 0 && (
              <div className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {weeks.length === 0 ? 'No timesheets found' : 'No timesheets match the current filters'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Week Detail Modal */}
      {showDetailModal && selectedWeek && weekDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modern-card glass-card w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Week of {format(parseISO(selectedWeek.week_start), 'MMM d, yyyy')}
                  </h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={clsx(
                      'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2',
                      getStatusColor(selectedWeek.status)
                    )}>
                      {getStatusIcon(selectedWeek.status)}
                      <span>{selectedWeek.status.charAt(0).toUpperCase() + selectedWeek.status.slice(1)}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Total: {selectedWeek.total_hours?.toFixed(1)} hours
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedWeek(null)
                    setWeekDetails(null)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </Button>
              </div>

              {/* Day-by-day breakdown */}
              <div className="space-y-3">
                {weekDetails.map((day: any) => {
                  const date = parseISO(day.date)
                  const hours = day.time_in && day.time_out ? 
                    ((new Date(`2000-01-01T${day.time_out}`).getTime() - new Date(`2000-01-01T${day.time_in}`).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
                    '0'
                  
                  return (
                    <div key={day.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-20">
                            <p className="font-semibold text-foreground">{format(date, 'EEE')}</p>
                            <p className="text-sm text-muted-foreground">{format(date, 'MMM d')}</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm">
                              {day.time_in || '--:--'} to {day.time_out || '--:--'}
                            </span>
                            <span className="font-medium">{hours} hours</span>
                            <span className={clsx(
                              'px-2 py-1 rounded text-xs',
                              {
                                'bg-success/10 text-success': day.status === 'active',
                                'bg-info/10 text-info': day.status === 'travel',
                                'bg-orange-100 text-orange-700': day.status === 'vacation',
                                'bg-muted text-muted-foreground': day.status === 'day_off'
                              }
                            )}>
                              {day.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        {(day.work_from || day.city || day.country) && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {day.work_from && `Work from: ${day.work_from}`}
                            </p>
                            {(day.city || day.country) && (
                              <p className="text-sm text-muted-foreground">
                                {[day.city, day.country].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Comments section */}
              {selectedWeek.rejection_reason && (
                <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h4 className="font-semibold text-destructive mb-2">Rejection Comments</h4>
                  <p className="text-sm text-destructive">{selectedWeek.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}