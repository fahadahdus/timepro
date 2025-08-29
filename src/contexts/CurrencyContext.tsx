'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface Currency {
  code: string
  symbol: string
  name: string
  decimalPlaces: number
}

interface CurrencyContextType {
  currency: Currency
  formatCurrency: (amount: number) => string
  refreshCurrency: () => Promise<void>
  loading: boolean
}

const defaultCurrency: Currency = {
  code: 'EUR',
  symbol: '€',
  name: 'Euro',
  decimalPlaces: 2
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  formatCurrency: (amount: number) => `€${amount.toFixed(2)}`,
  refreshCurrency: async () => {},
  loading: true
})

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}

interface CurrencyProviderProps {
  children: ReactNode
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [loading, setLoading] = useState(true)

  const loadCurrency = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('get-currency-settings')
      
      if (error) {
        console.error('Error loading currency settings:', error)
        // Fallback to default currency
        setCurrency(defaultCurrency)
        return
      }
      
      if (data?.error) {
        console.error('Currency API error:', data.error)
        setCurrency(defaultCurrency)
        return
      }
      
      if (data?.data) {
        setCurrency({
          code: data.data.currency_code,
          symbol: data.data.currency_symbol,
          name: data.data.currency_name,
          decimalPlaces: data.data.decimal_places
        })
      } else {
        // Fallback to default currency
        setCurrency(defaultCurrency)
      }
    } catch (error) {
      console.error('Error loading currency settings:', error)
      // Fallback to default currency
      setCurrency(defaultCurrency)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number): string => {
    if (isNaN(amount)) return `${currency.symbol}0${".00".slice(0, currency.decimalPlaces + 1)}`
    
    // Handle different currencies with appropriate formatting
    const formattedAmount = amount.toFixed(currency.decimalPlaces)
    
    // For currencies like JPY that don't use decimal places
    if (currency.decimalPlaces === 0) {
      return `${currency.symbol}${Math.round(amount)}`
    }
    
    // For most currencies, show symbol with amount
    switch (currency.code) {
      case 'USD':
      case 'CAD':
        return `${currency.symbol}${formattedAmount}`
      case 'EUR':
        return `${formattedAmount}${currency.symbol}`
      case 'GBP':
        return `${currency.symbol}${formattedAmount}`
      case 'JPY':
        return `${currency.symbol}${Math.round(amount)}`
      case 'CHF':
        return `${currency.symbol} ${formattedAmount}`
      default:
        return `${currency.symbol}${formattedAmount}`
    }
  }

  const refreshCurrency = async () => {
    await loadCurrency()
  }

  useEffect(() => {
    loadCurrency()
  }, [])

  const contextValue: CurrencyContextType = {
    currency,
    formatCurrency,
    refreshCurrency,
    loading
  }

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  )
}