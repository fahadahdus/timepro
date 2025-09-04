'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotifications } from '../contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { DollarSign, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface CurrencySetting {
  id: string
  currency_code: string
  currency_symbol: string
  currency_name: string
  decimal_places: number
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

export function CurrencySettingsPage() {
  const { user } = useAuth()
  const { currency, refreshCurrency } = useCurrency()
  const { addNotification } = useNotifications()
  const [currencies, setCurrencies] = useState<CurrencySetting[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencySetting | null>(null)

  useEffect(() => {
    loadCurrencies()
  }, [])

  const loadCurrencies = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('get-admin-currency-settings')
      
      if (error) {
        console.error('Error loading currencies:', error)
        addNotification({ type: 'error', title: 'Failed to load currency settings' })
        return
      }
      
      if (data?.error) {
        throw new Error(data.error.message || 'Failed to load currency settings')
      }
      
      if (data?.data) {
        setCurrencies(data.data)
      }
    } catch (error) {
      console.error('Error loading currencies:', error)
      addNotification({ type: 'error', title: 'Failed to load currency settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleCurrencyChange = (currencySetting: CurrencySetting) => {
    if (currencySetting.is_active) {
      return // Already active
    }
    
    setSelectedCurrency(currencySetting)
    setShowConfirmDialog(true)
  }

  const confirmCurrencyChange = async () => {
    if (!selectedCurrency || !user) {
      return
    }

    try {
      setUpdating(selectedCurrency.currency_code)
      
      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No valid session token. Please log in again.')
      }
      
      const { data, error } = await supabase.functions.invoke('update-currency-settings', {
        body: {
          currency_code: selectedCurrency.currency_code
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) {
        console.error('Error updating currency:', error)
        throw error
      }

      if (data?.error) {
        throw new Error(data.error.message || 'Failed to update currency settings')
      }

      addNotification({ 
        type: 'success', 
        title: `Currency changed to ${selectedCurrency.currency_name} (${selectedCurrency.currency_code}) successfully` 
      })
      
      // Refresh currency context and local data
      await Promise.all([
        refreshCurrency(),
        loadCurrencies()
      ])
      
    } catch (error) {
      console.error('Error updating currency:', error)
      addNotification({
        type: 'error',
        title: error instanceof Error ? error.message : 'Failed to update currency settings'
      })
    } finally {
      setUpdating(null)
      setShowConfirmDialog(false)
      setSelectedCurrency(null)
    }
  }

  const cancelCurrencyChange = () => {
    setShowConfirmDialog(false)
    setSelectedCurrency(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground font-medium">Loading currency settings...</p>
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
            <DollarSign className="h-8 w-8 mr-3 text-primary" />
            Currency Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure the default currency used throughout the application for all financial displays.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={loadCurrencies}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Currency Card */}
      <div className="modern-card glass-card p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
          <Check className="h-5 w-5 mr-2 text-green-600" />
          Current Active Currency
        </h2>
        <div className="flex items-center space-x-4">
          <div className="text-4xl font-bold text-primary">
            {currency.symbol}
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {currency.name} ({currency.code})
            </div>
            <div className="text-sm text-muted-foreground">
              Decimal places: {currency.decimalPlaces}
            </div>
          </div>
        </div>
      </div>

      {/* Impact Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-700">
            <p className="font-medium mb-1">Important Notice:</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-600">
              <li>Changing the currency will affect all financial displays across the application</li>
              <li>This includes expense amounts, VAT calculations, daily allowances, and reports</li>
              <li>Existing data values remain unchanged - only the display format changes</li>
              <li>All users will see the new currency formatting immediately</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Currency Selection Table */}
      <div className="modern-card glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Available Currencies</h2>
          <p className="text-sm text-muted-foreground">
            Select a currency to set as the new default for the application.
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Decimal Places
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {currencies.map((currencySetting) => (
                <tr key={currencySetting.currency_code} className="hover:bg-muted/20">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      {currencySetting.currency_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-lg font-bold text-primary">
                      {currencySetting.currency_symbol}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                      {currencySetting.currency_code}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {currencySetting.decimal_places}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {currencySetting.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(currencySetting.updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {currencySetting.is_active ? (
                      <span className="text-muted-foreground">Current</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCurrencyChange(currencySetting)}
                        disabled={updating === currencySetting.currency_code}
                        loading={updating === currencySetting.currency_code}
                      >
                        Set Active
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedCurrency && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Confirm Currency Change
              </h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to change the default currency to <strong>{selectedCurrency.currency_name} ({selectedCurrency.currency_code})</strong>?
                <br /><br />
                This will immediately affect all financial displays across the entire application for all users.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="ghost"
                  onClick={cancelCurrencyChange}
                  disabled={updating !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmCurrencyChange}
                  loading={updating !== null}
                >
                  Confirm Change
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}