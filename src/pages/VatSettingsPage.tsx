import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Settings, Check, X, AlertTriangle, Info, Save, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface VatSetting {
  id: string
  expense_type: string
  default_vat_rate: number
  available_rates: number[]
  is_configurable: boolean
  description: string | null
  updated_at: string
  updated_by: string | null
  updated_by_user?: {
    email: string
  }[]
}

interface EditingState {
  expense_type: string
  default_vat_rate: number
  available_rates: number[]
  description: string
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  train: 'Train',
  taxi: 'Taxi',
  flight: 'Flight',
  rental_car: 'Rental Car',
  fuel: 'Fuel',
  parking: 'Parking',
  onpv: 'ÖNPV',
  hospitality: 'Hospitality',
  hotel: 'Hotel',
  car: 'Car (Mileage)',
  others: 'Others'
}

export function VatSettingsPage() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [vatSettings, setVatSettings] = useState<VatSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<EditingState | null>(null)

  useEffect(() => {
    loadVatSettings()
  }, [])

  const loadVatSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-admin-vat-settings')
      
      if (error) {
        throw error
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load VAT settings')
      }
      
      // Ensure available_rates is always an array and filter out expense types not available to consultants
      const processedSettings = data.data
        .filter((setting: any) => setting.expense_type !== 'travel') // Hide travel expense type since it's not available to consultants
        .map((setting: any) => ({
          ...setting,
          available_rates: Array.isArray(setting.available_rates) 
            ? setting.available_rates 
            : (typeof setting.available_rates === 'string' 
              ? JSON.parse(setting.available_rates) 
              : [setting.default_vat_rate])
        }))
        // Sort by the order they appear in consultant forms
        .sort((a: any, b: any) => {
          const order = ['train', 'taxi', 'flight', 'rental_car', 'fuel', 'parking', 'onpv', 'hospitality', 'hotel', 'car', 'others'];
          return order.indexOf(a.expense_type) - order.indexOf(b.expense_type);
        })
      
      setVatSettings(processedSettings)
    } catch (error) {
      console.error('Error loading VAT settings:', error)
      addNotification({ type: 'error', title: 'Failed to load VAT settings' })
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (setting: VatSetting) => {
    if (!setting.is_configurable) return
    
    setEditingRow(setting.expense_type)
    setEditingData({
      expense_type: setting.expense_type,
      default_vat_rate: setting.default_vat_rate,
      available_rates: Array.isArray(setting.available_rates) 
        ? setting.available_rates 
        : [setting.default_vat_rate],
      description: setting.description || ''
    })
  }

  const cancelEditing = () => {
    setEditingRow(null)
    setEditingData(null)
  }

  const saveVatSetting = async () => {
    if (!editingData || !editingRow) return
    
    setSaving(editingRow)
    try {
      // Validate input
      if (editingData.default_vat_rate < 0 || editingData.default_vat_rate > 100) {
        throw new Error('VAT rate must be between 0 and 100')
      }
      
      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No valid session token. Please log in again.')
      }
      
      const { data, error } = await supabase.functions.invoke('update-vat-settings', {
        body: {
          expense_type: editingData.expense_type,
          default_vat_rate: editingData.default_vat_rate,
          available_rates: editingData.available_rates,
          description: editingData.description
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      if (error) {
        throw error
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update VAT settings')
      }
      
      addNotification({ 
        type: 'success', 
        title: data.message || 'VAT settings updated successfully' 
      })
      
      // Reload data to get updated settings
      await loadVatSettings()
      
      // Clear editing state
      setEditingRow(null)
      setEditingData(null)
      
    } catch (error) {
      console.error('Error updating VAT setting:', error)
      addNotification({
        type: 'error',
        title: error instanceof Error ? error.message : 'Failed to update VAT settings'
      })
    } finally {
      setSaving(null)
    }
  }

  const updateEditingData = (field: keyof EditingState, value: any) => {
    if (!editingData) return
    
    setEditingData({
      ...editingData,
      [field]: value
    })
  }

  const addAvailableRate = () => {
    if (!editingData) return
    
    const newRate = editingData.default_vat_rate
    if (!editingData.available_rates.includes(newRate)) {
      updateEditingData('available_rates', [...editingData.available_rates, newRate])
    }
  }

  const removeAvailableRate = (rate: number) => {
    if (!editingData) return
    
    updateEditingData(
      'available_rates',
      editingData.available_rates.filter(r => r !== rate)
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground font-medium">Loading VAT settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <Settings className="h-8 w-8 mr-3 text-primary" />
            VAT Configuration
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure VAT rates for different expense types. Changes affect all new expense entries.
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={loadVatSettings}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">VAT Configuration Guidelines:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Car mileage expenses are VAT-exempt and cannot be modified</li>
              <li>Hotel accommodation supports multiple VAT rate options</li>
              <li>Changes only affect new expense entries, not existing ones</li>
              <li>VAT rates must be between 0% and 100%</li>
            </ul>
          </div>
        </div>
      </div>

      {/* VAT Settings Table */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Expense Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Default VAT</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Available Options</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Configurable</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Last Updated</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vatSettings.map((setting) => {
                  const isEditing = editingRow === setting.expense_type
                  const isSaving = saving === setting.expense_type
                  
                  return (
                    <tr 
                      key={setting.expense_type} 
                      className={clsx(
                        'border-b border-border/50 hover:bg-accent/30 transition-colors',
                        {
                          'bg-accent/50': isEditing
                        }
                      )}
                    >
                      {/* Expense Type */}
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-foreground">
                            {EXPENSE_TYPE_LABELS[setting.expense_type] || setting.expense_type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {setting.expense_type}
                          </div>
                        </div>
                      </td>
                      
                      {/* Default VAT */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editingData?.default_vat_rate || 0}
                            onChange={(e) => updateEditingData('default_vat_rate', parseFloat(e.target.value) || 0)}
                            className="w-20"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={!setting.is_configurable}
                          />
                        ) : (
                          <span className={clsx(
                            'font-medium',
                            {
                              'text-green-600': setting.default_vat_rate === 0,
                              'text-foreground': setting.default_vat_rate > 0
                            }
                          )}>
                            {setting.default_vat_rate}%
                          </span>
                        )}
                      </td>
                      
                      {/* Available Options */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {editingData?.available_rates.map((rate) => (
                                <span 
                                  key={rate}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                                >
                                  {rate}%
                                  {setting.is_configurable && editingData.available_rates.length > 1 && (
                                    <button
                                      onClick={() => removeAvailableRate(rate)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                            {setting.is_configurable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={addAvailableRate}
                                className="text-xs"
                              >
                                Add Current Rate
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(setting.available_rates) ? setting.available_rates : [setting.default_vat_rate]).map((rate) => (
                              <span 
                                key={rate}
                                className={clsx(
                                  'inline-block px-2 py-1 rounded-full text-xs',
                                  {
                                    'bg-primary/10 text-primary': rate === setting.default_vat_rate,
                                    'bg-muted text-muted-foreground': rate !== setting.default_vat_rate
                                  }
                                )}
                              >
                                {rate}%
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      
                      {/* Configurable Status */}
                      <td className="py-4 px-4">
                        <div className={clsx(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          {
                            'bg-green-100 text-green-800': setting.is_configurable,
                            'bg-red-100 text-red-800': !setting.is_configurable
                          }
                        )}>
                          {setting.is_configurable ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Yes
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Fixed
                            </>
                          )}
                        </div>
                      </td>
                      
                      {/* Last Updated */}
                      <td className="py-4 px-4">
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(setting.updated_at), 'MMM d, yyyy')}
                          {setting.updated_by_user?.[0]?.email && (
                            <div className="text-xs">
                              by {setting.updated_by_user[0].email}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={saveVatSetting}
                                loading={isSaving}
                                className="text-xs"
                              >
                                <Save className="h-3 w-3" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                disabled={isSaving}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              {setting.is_configurable ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditing(setting)}
                                  className="text-xs"
                                >
                                  Edit
                                </Button>
                              ) : (
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Fixed Rate
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}