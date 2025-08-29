import React, { useState, useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { MapPin, Check, X, Plus, Save, RefreshCw, Globe } from 'lucide-react'
import { clsx } from 'clsx'

interface CountryRate {
  id: string
  country_name: string
  country_code: string
  rate_a: number // Partial day rate
  rate_b: number // Full day rate
  effective_from: string
  updated_at: string
  updated_by: string | null
}

interface EditingState {
  country_name: string
  country_code: string
  rate_a: number
  rate_b: number
}

export function CountryRatesPage() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const { formatCurrency } = useCurrency()
  const [countryRates, setCountryRates] = useState<CountryRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<EditingState | null>(null)


  useEffect(() => {
    loadCountryRates()
  }, [])

  const loadCountryRates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-country-rates')
      
      if (error) {
        console.error('Error loading country rates:', error)
        throw error
      }
      
      if (data?.error) {
        throw new Error(data.error.message || 'Failed to load country rates')
      }
      
      // The new API returns data.data array with the country rates
      if (data?.data) {
        setCountryRates(data.data)
      }
    } catch (error) {
      console.error('Error loading country rates:', error)
      addNotification({ type: 'error', title: 'Failed to load country rates' })
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (rate: CountryRate) => {
    setEditingRow(rate.country_code)
    setEditingData({
      country_name: rate.country_name,
      country_code: rate.country_code,
      rate_a: rate.rate_a,
      rate_b: rate.rate_b
    })
  }

  const cancelEditing = () => {
    setEditingRow(null)
    setEditingData(null)
  }

  const saveCountryRate = async () => {
    if (!editingData || !editingRow) return
    
    // Find the country being edited to get its ID
    const countryToEdit = countryRates.find(rate => rate.country_code === editingRow)
    if (!countryToEdit) {
      addNotification({ type: 'error', title: 'Country not found' })
      return
    }
    
    setSaving(editingRow)
    try {
      // Validate input
      if (editingData.rate_a < 0 || editingData.rate_b < 0) {
        throw new Error('Rates must be positive numbers')
      }
      
      // Call the update API endpoint
      const { data, error } = await supabase.functions.invoke('update-country-rates', {
        body: {
          countryId: countryToEdit.id,
          rateA: editingData.rate_a,
          rateB: editingData.rate_b
        }
      })
      
      if (error) {
        console.error('Error updating country rates:', error)
        throw error
      }
      
      if (data?.error) {
        throw new Error(data.error.message || 'Failed to update country rates')
      }
      
      addNotification({ 
        type: 'success', 
        title: `Country rates updated successfully for ${editingData.country_name}` 
      })
      
      // Clear editing state
      setEditingRow(null)
      setEditingData(null)
      
      // Refresh the data to get the latest values
      await loadCountryRates()
      
    } catch (error) {
      console.error('Error updating country rate:', error)
      addNotification({
        type: 'error',
        title: error instanceof Error ? error.message : 'Failed to update country rates'
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



  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground font-medium">Loading country rates...</p>
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
            <Globe className="h-8 w-8 mr-3 text-primary" />
            Country Daily Rates
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure travel daily allowance rates by country. Used for calculating per diems on business trips.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={loadCountryRates}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <MapPin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Daily Allowance Rate Guidelines:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li><strong>Rate A (Partial Day):</strong> Applied when travel duration is ≥8 hours but not a full day</li>
              <li><strong>Rate B (Full Day):</strong> Applied for each complete 24-hour period away from home</li>
              <li>Rates are typically set annually based on cost of living and tax regulations</li>
              <li>Changes affect all new travel expense calculations</li>
            </ul>
          </div>
        </div>
      </div>



      {/* Country Rates Table */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Country</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Rate A (Partial)</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Rate B (Full Day)</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Effective From</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {countryRates.map((rate) => {
                  const isEditing = editingRow === rate.country_code
                  const isSaving = saving === rate.country_code
                  
                  return (
                    <tr 
                      key={rate.country_code} 
                      className={clsx(
                        'border-b border-border/50 hover:bg-accent/30 transition-colors',
                        {
                          'bg-accent/50': isEditing
                        }
                      )}
                    >
                      {/* Country Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {rate.country_name}
                          </span>
                        </div>
                      </td>
                      
                      {/* Country Code */}
                      <td className="py-4 px-4">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                          {rate.country_code}
                        </span>
                      </td>
                      
                      {/* Rate A */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              value={editingData?.rate_a || 0}
                              onChange={(e) => updateEditingData('rate_a', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              min={0}
                              step={0.5}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-foreground">
                              {formatCurrency(rate.rate_a)}
                            </span>
                          </div>
                        )}
                      </td>
                      
                      {/* Rate B */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              value={editingData?.rate_b || 0}
                              onChange={(e) => updateEditingData('rate_b', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              min={0}
                              step={0.5}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-primary">
                              {formatCurrency(rate.rate_b)}
                            </span>
                          </div>
                        )}
                      </td>
                      
                      {/* Effective From */}
                      <td className="py-4 px-4">
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(rate.effective_from), 'MMM d, yyyy')}
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
                                onClick={saveCountryRate}
                                loading={isSaving}
                                icon={<Save className="h-3 w-3" />}
                                className="text-xs"
                              >
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(rate)}
                              className="text-xs"
                            >
                              Edit
                            </Button>
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