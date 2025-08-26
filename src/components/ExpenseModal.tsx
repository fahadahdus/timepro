import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { CostEntry } from '../lib/supabase'
import { format } from 'date-fns'

interface ExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    type: 'car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other'
    distance_km?: number
    gross_amount: number
    vat_percentage: number
    chargeable: boolean
    notes?: string
  }) => void
  date: string
  editingExpense?: CostEntry
  recentExpenseTypes?: ('car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other')[]
}

export function ExpenseModal({ isOpen, onClose, onSave, date, editingExpense, recentExpenseTypes = [] }: ExpenseModalProps) {
  const [formData, setFormData] = useState({
    type: 'car' as 'car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other',
    distance_km: '',
    gross_amount: '',
    vat_percentage: '20',
    chargeable: true,
    notes: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        type: editingExpense.type,
        distance_km: editingExpense.distance_km?.toString() || '',
        gross_amount: editingExpense.gross_amount.toString(),
        vat_percentage: editingExpense.vat_percentage.toString(),
        chargeable: editingExpense.chargeable,
        notes: editingExpense.notes || ''
      })
    } else {
      // Smart prefilling for new expenses
      const smartType = recentExpenseTypes.length > 0 ? recentExpenseTypes[0] : 'car'
      setFormData({
        type: smartType,
        distance_km: '',
        gross_amount: '',
        vat_percentage: '20',
        chargeable: true,
        notes: ''
      })
    }
    setErrors({})
  }, [editingExpense, isOpen, recentExpenseTypes])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.gross_amount || parseFloat(formData.gross_amount) <= 0) {
      newErrors.gross_amount = 'Please enter a valid amount'
    }
    
    if (!formData.vat_percentage || parseFloat(formData.vat_percentage) < 0) {
      newErrors.vat_percentage = 'Please enter a valid VAT percentage'
    }
    
    if ((formData.type === 'car' || formData.type === 'taxi') && formData.distance_km && parseFloat(formData.distance_km) <= 0) {
      newErrors.distance_km = 'Distance must be greater than 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      const submitData = {
        type: formData.type,
        gross_amount: parseFloat(formData.gross_amount),
        vat_percentage: parseFloat(formData.vat_percentage),
        chargeable: formData.chargeable,
        distance_km: formData.distance_km ? parseFloat(formData.distance_km) : undefined,
        notes: formData.notes || undefined
      }
      onSave(submitData)
    }
  }

  const netAmount = formData.gross_amount 
    ? (parseFloat(formData.gross_amount) / (1 + parseFloat(formData.vat_percentage || '0') / 100)).toFixed(2)
    : '0.00'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {editingExpense ? 'Edit Expense Entry' : 'Add Expense Entry'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(date), 'EEEE, MMMM d, yyyy')}
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
            <Select
              label="Expense Type"
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              variant="floating"
              options={[
                { value: 'car', label: 'Car' },
                { value: 'train', label: 'Train' },
                { value: 'flight', label: 'Flight' },
                { value: 'taxi', label: 'Taxi' },
                { value: 'hotel', label: 'Hotel' },
                { value: 'meal', label: 'Meal' },
                { value: 'other', label: 'Other' }
              ]}
            />
            {recentExpenseTypes.length > 0 && (
              <div className="md:col-span-1">
                <div className="bg-muted/30 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-foreground mb-2">Recent Types</h4>
                  <div className="flex flex-wrap gap-1">
                    {recentExpenseTypes.slice(0, 3).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange('type', type)}
                        className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors capitalize"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {(formData.type === 'car' || formData.type === 'taxi') && (
              <Input
                type="number"
                label="Distance (km)"
                value={formData.distance_km}
                onChange={(e) => handleInputChange('distance_km', e.target.value)}
                error={errors.distance_km}
                variant="floating"
                min="0"
                step="0.1"
                placeholder="Optional"
              />
            )}
            
            <Input
              type="number"
              label="Gross Amount"
              value={formData.gross_amount}
              onChange={(e) => handleInputChange('gross_amount', e.target.value)}
              error={errors.gross_amount}
              variant="floating"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            
            <Input
              type="number"
              label="VAT Percentage"
              value={formData.vat_percentage}
              onChange={(e) => handleInputChange('vat_percentage', e.target.value)}
              error={errors.vat_percentage}
              variant="floating"
              min="0"
              step="0.1"
              placeholder="20"
            />
            
            {formData.gross_amount && (
              <div className="md:col-span-2">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Net Amount (excl. VAT):</span>
                    <span className="font-semibold text-foreground">${netAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-muted-foreground">VAT Amount:</span>
                    <span className="text-muted-foreground">
                      ${(parseFloat(formData.gross_amount) - parseFloat(netAmount)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-border">
                    <span className="font-medium text-foreground">Total (incl. VAT):</span>
                    <span className="font-bold text-primary">${parseFloat(formData.gross_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="md:col-span-2">
              <textarea
                className="modern-input w-full h-24 resize-none"
                placeholder="Additional notes about this expense..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
              <label className="floating-label">Notes (Optional)</label>
            </div>
            
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="chargeable"
                  checked={formData.chargeable}
                  onChange={(e) => handleInputChange('chargeable', e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <label htmlFor="chargeable" className="text-sm font-medium text-foreground">
                  This expense is chargeable to the client
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Check this if the expense should be billed to the client
              </p>
            </div>
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
