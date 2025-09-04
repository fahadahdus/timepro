import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { supabase, Week } from '../lib/supabase'
import { CheckCircle, XCircle, Clock, Search, MessageCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { clsx } from 'clsx'

interface WeekWithUser extends Week {
  users: {
    id: string
    full_name: string
    email: string
  }
}

export function ApprovalsPage() {
  const [weeks, setWeeks] = useState<WeekWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<WeekWithUser | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    loadSubmittedWeeks()
  }, [statusFilter])

  const loadSubmittedWeeks = async () => {
    setLoading(true)
    try {
      const query = supabase
        .from('weeks')
        .select(`
          *,
          users!weeks_user_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .order('submitted_at', { ascending: false })
      
      if (statusFilter !== 'all') {
        query.eq('status', statusFilter)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      setWeeks(data || [])
    } catch (error) {
      console.error('Error loading weeks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (week: WeekWithUser) => {
    try {
      const { error } = await supabase
        .from('weeks')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          rejection_reason: null
        })
        .eq('id', week.id)
      
      if (error) throw error
      loadSubmittedWeeks()
    } catch (error) {
      console.error('Error approving week:', error)
      alert('Error approving timesheet')
    }
  }

  const handleReject = async () => {
    if (!selectedWeek || !rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    try {
      const { error } = await supabase
        .from('weeks')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', selectedWeek.id)
      
      if (error) throw error
      
      setShowRejectModal(false)
      setSelectedWeek(null)
      setRejectionReason('')
      loadSubmittedWeeks()
    } catch (error) {
      console.error('Error rejecting week:', error)
      alert('Error rejecting timesheet')
    }
  }

  const openRejectModal = (week: WeekWithUser) => {
    setSelectedWeek(week)
    setShowRejectModal(true)
  }

  const closeRejectModal = () => {
    setShowRejectModal(false)
    setSelectedWeek(null)
    setRejectionReason('')
  }

  const filteredWeeks = weeks.filter(week => {
    const searchLower = searchTerm.toLowerCase()
    return week.users.full_name.toLowerCase().includes(searchLower) ||
           week.users.email.toLowerCase().includes(searchLower) ||
           format(parseISO(week.week_start), 'MMM d, yyyy').toLowerCase().includes(searchLower)
  })

  const getStatusColor = (status: string) => {
    switch (status) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Timesheet Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve consultant timesheet submissions
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="modern-card glass-card p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by consultant name, email, or week..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
              className="max-w-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'submitted', label: 'Pending Approval' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All Statuses' }
            ]}
            className="w-40"
          />
        </div>
      </div>

      {/* Approvals Table */}
      <div className="modern-card glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading timesheets...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Consultant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Week</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Submitted</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Comments</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWeeks.map((week) => (
                  <tr key={week.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{week.users.full_name}</p>
                        <p className="text-sm text-muted-foreground">{week.users.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {format(parseISO(week.week_start), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Week {format(parseISO(week.week_start), 'w')}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {week.submitted_at ? (
                        <div>
                          <p>{format(parseISO(week.submitted_at), 'MMM d, yyyy')}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(week.submitted_at), 'h:mm a')}
                          </p>
                        </div>
                      ) : (
                        'Not submitted'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border-2',
                        getStatusColor(week.status)
                      )}>
                        {week.status.charAt(0).toUpperCase() + week.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {week.rejection_reason ? (
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm text-destructive">{week.rejection_reason}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No comments</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {week.status === 'submitted' && (
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(week)}
                            className="text-success hover:text-success hover:bg-success/10"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRejectModal(week)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {week.status === 'approved' && week.approved_at && (
                        <div className="text-sm text-muted-foreground">
                          Approved {format(parseISO(week.approved_at), 'MMM d, yyyy')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredWeeks.length === 0 && (
              <div className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === 'submitted' 
                    ? 'No timesheets pending approval'
                    : 'No timesheets found'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedWeek && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modern-card glass-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Reject Timesheet
            </h2>
            <p className="text-muted-foreground mb-4">
              Rejecting timesheet for <strong>{selectedWeek.users.full_name}</strong> - 
              Week of {format(parseISO(selectedWeek.week_start), 'MMM d, yyyy')}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection..."
                  className="w-full p-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={4}
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <Button
                  variant="ghost"
                  onClick={closeRejectModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}