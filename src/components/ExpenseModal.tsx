import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { X, Calculator, Receipt } from 'lucide-react'
import { clsx } from 'clsx'
import { Project, ExpenseEntry } from '../lib/supabase'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../contexts/CurrencyContext'

interface ExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    project_id: string
    expense_type: string
    date: string
    description?: string
    gross_amount: number
    vat_percentage: number
    distance_km?: number
    rate_per_km?: number
  }) => void
  projects: Project[]
  date: string
  editingExpense?: ExpenseEntry
}

interface VatConfig {
  [key: string]: {
    defaultVat: number
    availableRates: number[]
    isConfigurable: boolean
    description?: string
  }
}

const EXPENSE_TYPES = [
  { value: 'train', label: 'Train' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'flight', label: 'Flight' },
  { value: 'rental_car', label: 'Rental Car' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'parking', label: 'Parking' },
  { value: 'onpv', label: 'ÖNPV' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'car', label: 'Car (Mileage)' },
  { value: 'others', label: 'Others' }
]

const CAR_RATES = [
  { value: 0.7, label: '0.70€ per km' },
  { value: 0.5, label: '0.50€ per km' },
  { value: 0.3, label: '0.30€ per km' }
]

export function ExpenseModal({ isOpen, onClose, onSave, projects, date, editingExpense }: ExpenseModalProps) {
  const { formatCurrency } = useCurrency()
  const [vatConfig, setVatConfig] = useState<VatConfig>({})
  const [loadingVatConfig, setLoadingVatConfig] = useState(true)
  const [formData, setFormData] = useState({
    project_id: '',
    expense_type: '',
    date: date,
    description: '',
    gross_amount: '',
    vat_percentage: '20',
    distance_km: '',
    rate_per_km: '0.7'
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [calculatedAmounts, setCalculatedAmounts] = useState({
    grossAmount: 0,
    vatAmount: 0,
    netAmount: 0
  })

  // Load VAT configuration on component mount
  useEffect(() => {
    loadVatConfiguration()
  }, [])

  const loadVatConfiguration = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-vat-settings')
      
      if (error) {
        console.error('Error loading VAT config:', error)
        // Fallback to default config
        setVatConfig(getDefaultVatConfig())
        return
      }
      
      if (data.success) {
        setVatConfig(data.data)
      } else {
        console.error('VAT config load failed:', data.error)
        setVatConfig(getDefaultVatConfig())
      }
    } catch (error) {
      console.error('Error loading VAT configuration:', error)
      setVatConfig(getDefaultVatConfig())
    } finally {
      setLoadingVatConfig(false)
    }
  }

  // Fallback VAT configuration
  const getDefaultVatConfig = (): VatConfig => ({
    train: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    taxi: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    flight: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    rental_car: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    fuel: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    parking: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    onpv: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    hospitality: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    others: { defaultVat: 20, availableRates: [20], isConfigurable: true },
    hotel: { defaultVat: 19, availableRates: [19, 7, 0], isConfigurable: true },
    car: { defaultVat: 0, availableRates: [0], isConfigurable: false }
  })

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        project_id: editingExpense.project_id,
        expense_type: editingExpense.expense_type,
        date: editingExpense.date,
        description: editingExpense.description || '',
        gross_amount: editingExpense.gross_amount.toString(),
        vat_percentage: editingExpense.vat_percentage.toString(),
        distance_km: editingExpense.distance_km?.toString() || '',
        rate_per_km: editingExpense.rate_per_km?.toString() || '0.7'
      })
    } else {
      setFormData({
        project_id: '',
        expense_type: '',
        date: date,
        description: '',
        gross_amount: '',
        vat_percentage: '20',
        distance_km: '',
        rate_per_km: '0.7'
      })
    }
    setErrors({})
  }, [editingExpense, isOpen, date])

  // Calculate amounts when relevant fields change
  useEffect(() => {
    const expenseConfig = vatConfig[formData.expense_type]
    let grossAmount = 0
    
    if (expenseConfig && formData.expense_type === 'car') {
      // Car expense: calculate gross amount from distance and rate
      const distance = parseFloat(formData.distance_km) || 0
      const rate = parseFloat(formData.rate_per_km) || 0
      grossAmount = distance * rate
    } else {
      // Regular expense: use manually entered gross amount
      grossAmount = parseFloat(formData.gross_amount) || 0
    }
    
    const vatPercentage = parseFloat(formData.vat_percentage) || 0
    const netAmount = grossAmount / (1 + vatPercentage / 100)
    const vatAmount = grossAmount - netAmount
    
    setCalculatedAmounts({
      grossAmount: Math.round(grossAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100
    })
  }, [formData.expense_type, formData.gross_amount, formData.vat_percentage, formData.distance_km, formData.rate_per_km, vatConfig])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleExpenseTypeChange = (expenseType: string) => {
    const expenseConfig = vatConfig[expenseType]
    if (expenseConfig) {
      setFormData(prev => ({
        ...prev,
        expense_type: expenseType,
        vat_percentage: expenseConfig.defaultVat.toString(),
        gross_amount: expenseType === 'car' ? '' : prev.gross_amount,
        distance_km: expenseType === 'car' ? prev.distance_km : '',
        rate_per_km: expenseType === 'car' ? prev.rate_per_km : ''
      }))
    }
    // Clear expense type error
    if (errors.expense_type) {
      setErrors(prev => ({ ...prev, expense_type: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.project_id) {
      newErrors.project_id = 'Please select a project'
    }
    
    if (!formData.expense_type) {
      newErrors.expense_type = 'Please select an expense type'
    }
    
    if (!formData.date) {
      newErrors.date = 'Please select a date'
    }
    
    const expenseConfig = vatConfig[formData.expense_type]
    
    if (expenseConfig && formData.expense_type === 'car') {
      // Car expense validation
      if (!formData.distance_km || parseFloat(formData.distance_km) <= 0) {
        newErrors.distance_km = 'Distance must be greater than 0'
      }
      if (!formData.rate_per_km) {
        newErrors.rate_per_km = 'Please select a rate per km'
      }
    } else {
      // Regular expense validation
      if (!formData.gross_amount || parseFloat(formData.gross_amount) <= 0) {
        newErrors.gross_amount = 'Gross amount must be greater than 0'
      }
    }
    
    if (!formData.vat_percentage || parseFloat(formData.vat_percentage) < 0) {
      newErrors.vat_percentage = 'Please enter a valid VAT percentage'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      const expenseConfig = vatConfig[formData.expense_type]
      const submitData = {
        project_id: formData.project_id,
        expense_type: formData.expense_type,
        date: formData.date,
        description: formData.description || undefined,
        gross_amount: expenseConfig && formData.expense_type === 'car' ? calculatedAmounts.grossAmount : parseFloat(formData.gross_amount),
        vat_percentage: parseFloat(formData.vat_percentage),
        distance_km: expenseConfig && formData.expense_type === 'car' ? parseFloat(formData.distance_km) : undefined,
        rate_per_km: expenseConfig && formData.expense_type === 'car' ? parseFloat(formData.rate_per_km) : undefined
      }
      onSave(submitData)
    }
  }

  const expenseConfig = vatConfig[formData.expense_type]
  const selectedProject = projects.find(p => p.id === formData.project_id)

  if (!isOpen) return null

  // Show loading state if VAT config is still loading
  if (loadingVatConfig) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="inline-flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              <p className="text-muted-foreground font-medium">Loading expense settings...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {editingExpense ? 'Edit Expense Entry' : 'Add Expense Entry'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(formData.date), 'EEEE, MMMM d, yyyy')}
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
            {/* Project Selection */}
            <div className="md:col-span-2">
              <Select
                label="Project *"
                value={formData.project_id}
                onChange={(e) => handleInputChange('project_id', e.target.value)}
                error={errors.project_id}
                variant="floating"
                options={[
                  { value: '', label: 'Select a project...' },
                  ...projects.map(project => ({
                    value: project.id,
                    label: `${project.name} (${project.code})`
                  }))
                ]}
              />
            </div>
            
            {/* Expense Type */}
            <Select
              label="Expense Type *"
              value={formData.expense_type}
              onChange={(e) => handleExpenseTypeChange(e.target.value)}
              error={errors.expense_type}
              variant="floating"
              options={[
                { value: '', label: 'Select expense type...' },
                ...EXPENSE_TYPES.map(type => ({
                  value: type.value,
                  label: type.label
                }))
              ]}
            />
            
            {/* Date */}
            <Input
              type="date"
              label="Date *"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              error={errors.date}
              variant="floating"
            />
            
            {/* Description */}
            <div className="md:col-span-2">
              <textarea
                className="modern-input w-full h-24 resize-none"
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
              <label className="floating-label">Description (Optional)</label>
            </div>
            
            {/* Car-specific fields */}
            {expenseConfig && formData.expense_type === 'car' && (
              <>
                <Input
                  type="number"
                  label="Distance (km) *"
                  value={formData.distance_km}
                  onChange={(e) => handleInputChange('distance_km', e.target.value)}
                  error={errors.distance_km}
                  variant="floating"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                />
                
                <Select
                  label="Rate per km *"
                  value={formData.rate_per_km}
                  onChange={(e) => handleInputChange('rate_per_km', e.target.value)}
                  error={errors.rate_per_km}
                  variant="floating"
                  options={CAR_RATES.map(rate => ({
                    value: rate.value.toString(),
                    label: rate.label
                  }))}
                />
                
                {/* Calculated Gross Amount for Car */}
                <div className="md:col-span-2">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculated Amount
                    </h4>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(calculatedAmounts.grossAmount)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.distance_km} km × {formatCurrency(parseFloat(formData.rate_per_km || '0'))}/km
                    </p>
                  </div>
                </div>
              </>
            )}
            
            {/* Regular expense fields */}
            {expenseConfig && formData.expense_type !== 'car' && (
              <Input
                type="number"
                label="Gross Amount *"
                value={formData.gross_amount}
                onChange={(e) => handleInputChange('gross_amount', e.target.value)}
                error={errors.gross_amount}
                variant="floating"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            )}
            
            {/* VAT Percentage */}
            {expenseConfig?.availableRates && expenseConfig.availableRates.length > 1 ? (
              <Select
                label="VAT Rate *"
                value={formData.vat_percentage}
                onChange={(e) => handleInputChange('vat_percentage', e.target.value)}
                error={errors.vat_percentage}
                variant="floating"
                options={expenseConfig.availableRates.map(rate => ({
                  value: rate.toString(),
                  label: `${rate}%`
                }))}
              />
            ) : (
              <Input
                type="number"
                label={formData.expense_type === 'car' ? 'VAT Rate (Fixed)' : 'VAT Rate'}
                value={formData.vat_percentage}
                onChange={(e) => handleInputChange('vat_percentage', e.target.value)}
                error={errors.vat_percentage}
                variant="floating"
                min="0"
                step="0.1"
                placeholder="20"
                disabled={!expenseConfig?.isConfigurable}
                className={!expenseConfig?.isConfigurable ? 'opacity-50' : ''}
              />
            )}
            
            {/* Amount Breakdown */}
            {(calculatedAmounts.grossAmount > 0) && (
              <div className="md:col-span-2">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
                    <Receipt className="h-4 w-4 mr-2" />
                    Amount Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Net Amount:</span>
                      <span className="font-semibold text-foreground">{formatCurrency(calculatedAmounts.netAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">VAT Amount:</span>
                      <span className="font-semibold text-foreground">{formatCurrency(calculatedAmounts.vatAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Gross Amount:</span>
                      <span className="font-bold text-primary">{formatCurrency(calculatedAmounts.grossAmount)}</span>
                    </div>
                  </div>
                  {formData.expense_type === 'car' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Car expenses are VAT-exempt (0% VAT)
                    </p>
                  )}
                </div>
              </div>
            )}
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
            {editingExpense ? 'Update Expense' : 'Add Expense'}
          </Button>
        </div>
      </div>
    </div>
  )
}
