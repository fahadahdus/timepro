import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, DollarSign, Globe, Percent, Save, Plus, Edit2, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'

interface AllowanceRate {
  id: string
  country_code: string
  partial_rate: number
  full_rate: number
  effective_date: string
  created_at: string
}

interface DefaultRate {
  id: string
  user_id?: string
  project_type: string
  hourly_rate: number
  created_at: string
}

export function SettingsPage() {
  const { success, error } = useNotifications()
  const [activeTab, setActiveTab] = useState('allowances')
  const [allowanceRates, setAllowanceRates] = useState<AllowanceRate[]>([])
  const [defaultRates, setDefaultRates] = useState<DefaultRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Allowance form state
  const [allowanceForm, setAllowanceForm] = useState({
    country_code: 'US',
    partial_rate: '',
    full_rate: '',
    effective_date: new Date().toISOString().split('T')[0]
  })
  
  // Default rates form state
  const [rateForm, setRateForm] = useState({
    project_type: 'time_and_material',
    hourly_rate: ''
  })
  
  // General settings
  const [generalSettings, setGeneralSettings] = useState({
    default_vat_rate: '20',
    default_currency: 'USD',
    week_start_day: '1', // Monday
    auto_submit_enabled: false,
    notification_enabled: true
  })

  useEffect(() => {
    loadAllowanceRates()
    loadDefaultRates()
    loadGeneralSettings()
  }, [])

  const loadAllowanceRates = async () => {
    try {
      const { data, error } = await supabase
        .from('allowance_rates')
        .select('*')
        .order('country_code', { ascending: true })
        .order('effective_date', { ascending: false })
      
      if (error) throw error
      setAllowanceRates(data || [])
    } catch (error) {
      console.error('Error loading allowance rates:', error)
    }
  }

  const loadDefaultRates = async () => {
    try {
      const { data, error } = await supabase
        .from('default_rates')
        .select('*')
        .order('project_type', { ascending: true })
      
      if (error) throw error
      setDefaultRates(data || [])
    } catch (error: any) {
      console.error('Error loading default rates:', error)
      error('Failed to load default rates', error.message)
    }
  }

  const loadGeneralSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
      
      if (error) throw error
      
      if (data && data.length > 0) {
        const settings = data.reduce((acc: any, setting) => {
          // Convert string boolean values to actual booleans
          const value = setting.key.includes('enabled') 
            ? setting.value === 'true'
            : setting.value
          return { ...acc, [setting.key]: value }
        }, {})
        
        setGeneralSettings({
          default_vat_rate: settings.default_vat_rate || '20',
          default_currency: settings.default_currency || 'USD',
          week_start_day: settings.week_start_day || '1',
          auto_submit_enabled: settings.auto_submit_enabled || false,
          notification_enabled: settings.notification_enabled || true
        })
      }
    } catch (error: any) {
      console.error('Error loading general settings:', error)
      error('Failed to load settings', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAllowanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('allowance_rates')
        .insert({
          country_code: allowanceForm.country_code,
          partial_rate: parseFloat(allowanceForm.partial_rate),
          full_rate: parseFloat(allowanceForm.full_rate),
          effective_date: allowanceForm.effective_date
        })
      
      if (error) throw error
      
      success('Allowance rate added successfully')
      
      setAllowanceForm({
        country_code: 'US',
        partial_rate: '',
        full_rate: '',
        effective_date: new Date().toISOString().split('T')[0]
      })
      
      loadAllowanceRates()
    } catch (error: any) {
      console.error('Error saving allowance rate:', error)
      error('Failed to add allowance rate', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAllowanceRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('allowance_rates')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      success('Allowance rate deleted successfully')
      loadAllowanceRates()
    } catch (error: any) {
      console.error('Error deleting allowance rate:', error)
      error('Failed to delete allowance rate', error.message)
    }
  }

  const handleGeneralSettingsSave = async () => {
    setSaving(true)
    try {
      // Update each setting in the system_settings table
      const settingsToUpdate = [
        { key: 'default_vat_rate', value: generalSettings.default_vat_rate.toString() },
        { key: 'default_currency', value: generalSettings.default_currency },
        { key: 'week_start_day', value: generalSettings.week_start_day.toString() },
        { key: 'auto_submit_enabled', value: generalSettings.auto_submit_enabled.toString() },
        { key: 'notification_enabled', value: generalSettings.notification_enabled.toString() }
      ]
      
      // Use Promise.all to update all settings concurrently
      const updates = settingsToUpdate.map(setting => {
        return supabase
          .from('system_settings')
          .update({ value: setting.value })
          .eq('key', setting.key)
      })
      
      const results = await Promise.all(updates)
      
      // Check if any updates had errors
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} settings`)
      }
      
      success('Settings saved successfully')
    } catch (error: any) {
      console.error('Error saving general settings:', error)
      error('Failed to save settings', error.message)
    } finally {
      setSaving(false)
    }
  }

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

  const tabs = [
    { id: 'allowances', label: 'Allowance Rates', icon: DollarSign },
    { id: 'rates', label: 'Default Rates', icon: Percent },
    { id: 'general', label: 'General Settings', icon: SettingsIcon }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground ml-3">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          System Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure rates, allowances, and system defaults
        </p>
      </div>

      {/* Tabs */}
      <div className="modern-card glass-card">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                    {
                      'border-primary text-primary': isActive,
                      'border-transparent text-muted-foreground hover:text-foreground hover:border-muted': !isActive
                    }
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Allowance Rates Tab */}
          {activeTab === 'allowances' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add New Allowance Rate */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Add New Allowance Rate
                  </h3>
                  <form onSubmit={handleAllowanceSubmit} className="space-y-4">
                    <Select
                      label="Country"
                      value={allowanceForm.country_code}
                      onChange={(e) => setAllowanceForm({ ...allowanceForm, country_code: e.target.value })}
                      options={countries}
                    />
                    
                    <Input
                      label="Partial Rate (per day)"
                      type="number"
                      step="0.01"
                      value={allowanceForm.partial_rate}
                      onChange={(e) => setAllowanceForm({ ...allowanceForm, partial_rate: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                    
                    <Input
                      label="Full Rate (per day)"
                      type="number"
                      step="0.01"
                      value={allowanceForm.full_rate}
                      onChange={(e) => setAllowanceForm({ ...allowanceForm, full_rate: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                    
                    <Input
                      label="Effective Date"
                      type="date"
                      value={allowanceForm.effective_date}
                      onChange={(e) => setAllowanceForm({ ...allowanceForm, effective_date: e.target.value })}
                      required
                    />
                    
                    <Button
                      type="submit"
                      variant="primary"
                      loading={saving}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Add Rate
                    </Button>
                  </form>
                </div>

                {/* Current Allowance Rates */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Current Allowance Rates
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allowanceRates.map((rate) => (
                      <div key={rate.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {countries.find(c => c.value === rate.country_code)?.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Partial: ${rate.partial_rate} • Full: ${rate.full_rate}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Effective: {new Date(rate.effective_date).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this allowance rate?')) {
                                handleDeleteAllowanceRate(rate.id)
                              }
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {allowanceRates.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No allowance rates configured
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Default Rates Tab */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Default Hourly Rates
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Set default hourly rates for different project types
                  </p>
                  
                  <div className="space-y-4">
                    {defaultRates.map((rate) => (
                      <div key={rate.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">
                            {rate.project_type === 'time_and_material' ? 'Time & Material' : 'Fixed Price'} Projects
                          </p>
                          <p className="text-sm text-muted-foreground">${rate.hourly_rate}/hour</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRateForm({
                              project_type: rate.project_type,
                              hourly_rate: rate.hourly_rate.toString()
                            })
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Add Default Rate
                  </h3>
                  <div className="space-y-4">
                    <Select
                      label="Project Type"
                      value={rateForm.project_type}
                      onChange={(e) => setRateForm({ ...rateForm, project_type: e.target.value })}
                      options={[
                        { value: 'time_and_material', label: 'Time & Materials' },
                        { value: 'fixed_price', label: 'Fixed Price' }
                      ]}
                    />
                    
                    <Input
                      label="Hourly Rate"
                      type="number"
                      step="0.01"
                      value={rateForm.hourly_rate}
                      onChange={(e) => setRateForm({ ...rateForm, hourly_rate: e.target.value })}
                      placeholder="0.00"
                    />
                    
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={async () => {
                        try {
                          if (!rateForm.hourly_rate) {
                            error('Please enter an hourly rate')
                            return
                          }
                          
                          setSaving(true)
                          const { data, error: err } = await supabase
                            .from('default_rates')
                            .insert({
                              project_type: rateForm.project_type,
                              hourly_rate: parseFloat(rateForm.hourly_rate),
                              description: `Default rate for ${rateForm.project_type === 'time_and_material' ? 'Time & Materials' : 'Fixed Price'} projects`
                            })
                            .select()
                          
                          if (err) throw err
                          
                          success('Rate added successfully')
                          setRateForm({
                            project_type: 'time_and_material',
                            hourly_rate: ''
                          })
                          loadDefaultRates()
                        } catch (error: any) {
                          console.error('Error adding rate:', error)
                          error('Failed to add rate', error.message)
                        } finally {
                          setSaving(false)
                        }
                      }}
                      loading={saving}
                    >
                      <Plus className="h-4 w-4" />
                      Add Rate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    General Settings
                  </h3>
                  
                  <Input
                    label="Default VAT Rate (%)"
                    type="number"
                    step="0.01"
                    value={generalSettings.default_vat_rate}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, default_vat_rate: e.target.value })}
                    placeholder="20.00"
                  />
                  
                  <Select
                    label="Default Currency"
                    value={generalSettings.default_currency}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, default_currency: e.target.value })}
                    options={[
                      { value: 'USD', label: 'US Dollar (USD)' },
                      { value: 'EUR', label: 'Euro (EUR)' },
                      { value: 'GBP', label: 'British Pound (GBP)' },
                      { value: 'CAD', label: 'Canadian Dollar (CAD)' }
                    ]}
                  />
                  
                  <Select
                    label="Week Start Day"
                    value={generalSettings.week_start_day}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, week_start_day: e.target.value })}
                    options={[
                      { value: '0', label: 'Sunday' },
                      { value: '1', label: 'Monday' }
                    ]}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    System Preferences
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">Auto-submit Timesheets</p>
                        <p className="text-sm text-muted-foreground">Automatically submit completed weeks</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={generalSettings.auto_submit_enabled}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, auto_submit_enabled: e.target.checked })}
                        className="rounded border-border"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">Send email notifications for approvals</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={generalSettings.notification_enabled}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, notification_enabled: e.target.checked })}
                        className="rounded border-border"
                      />
                    </div>
                  </div>
                  
                  <Button
                    variant="primary"
                    onClick={handleGeneralSettingsSave}
                    loading={saving}
                    className="w-full"
                  >
                    <Save className="h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}