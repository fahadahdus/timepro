import React, { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, Check } from 'lucide-react'

interface TimeAllocationInputProps {
  label?: string
  value: number
  onChange: (value: number) => void
  error?: string
  helperText?: string
  variant?: 'default' | 'floating'
  disabled?: boolean
  className?: string
  id?: string
}

const TIME_ALLOCATION_OPTIONS = [
  { value: 1, label: '1 - Full day', description: 'Full day' },
  { value: 0.875, label: '0.875 - 7/8 day', description: '7/8 day' },
  { value: 0.75, label: '0.75 - 3/4 day', description: '3/4 day' },
  { value: 0.625, label: '0.625 - 5/8 day', description: '5/8 day' },
  { value: 0.5, label: '0.5 - Half day', description: 'Half day' },
  { value: 0.375, label: '0.375 - 3/8 day', description: '3/8 day' },
  { value: 0.25, label: '0.25 - Quarter day', description: 'Quarter day' },
  { value: 0.125, label: '0.125 - 1/8 day', description: '1/8 day' }
]

export function TimeAllocationInput({
  className,
  label,
  error,
  helperText,
  value,
  onChange,
  id,
  variant = 'floating',
  disabled = false,
  ...props
}: TimeAllocationInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value.toString())
  const [isCustom, setIsCustom] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const inputId = id || `time-allocation-${Math.random().toString(36).substring(7)}`

  // Check if current value is one of the predefined options
  useEffect(() => {
    const isPredefined = TIME_ALLOCATION_OPTIONS.some(option => option.value === value)
    setIsCustom(!isPredefined)
    setInputValue(value.toString())
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOptionSelect = (optionValue: number) => {
    onChange(optionValue)
    setInputValue(optionValue.toString())
    setIsCustom(false)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // Parse and validate the input
    const numericValue = parseFloat(newValue)
    if (!isNaN(numericValue) && numericValue > 0 && numericValue <= 1) {
      onChange(numericValue)
      const isPredefined = TIME_ALLOCATION_OPTIONS.some(option => option.value === numericValue)
      setIsCustom(!isPredefined)
    }
  }

  const handleInputBlur = () => {
    // Validate and format the input on blur
    const numericValue = parseFloat(inputValue)
    if (isNaN(numericValue) || numericValue <= 0 || numericValue > 1) {
      // Reset to last valid value if invalid
      setInputValue(value.toString())
    } else {
      // Format to clean up the input
      setInputValue(numericValue.toString())
      onChange(numericValue)
    }
  }

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const selectedOption = TIME_ALLOCATION_OPTIONS.find(option => option.value === value)
  const displayValue = isCustom ? `${value} (custom)` : (selectedOption?.description || value.toString())

  if (variant === 'floating' && label) {
    return (
      <div className="floating-label-group space-y-1" ref={dropdownRef}>
        <div className="relative">
          {/* Display input/dropdown trigger */}
          <div
            className={clsx(
              'modern-input floating-input peer cursor-pointer flex items-center justify-between',
              {
                'border-destructive focus-within:border-destructive focus-within:ring-destructive/20': error,
                'focus-within:ring-primary/10 focus-within:border-primary': !error,
                'opacity-50 cursor-not-allowed': disabled,
              },
              className
            )}
            onClick={toggleDropdown}
          >
            <div className="flex-1 text-left">
              {isCustom ? (
                <input
                  ref={inputRef}
                  type="number"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-none outline-none w-full text-input-value"
                  min="0.125"
                  max="1"
                  step="0.125"
                  disabled={disabled}
                  placeholder=" "
                />
              ) : (
                <span className="text-input-value">{displayValue}</span>
              )}
            </div>
            <ChevronDown 
              className={clsx(
                "h-4 w-4 text-muted-foreground transition-transform pointer-events-none",
                { "rotate-180": isOpen }
              )} 
            />
          </div>
          
          <label 
            htmlFor={inputId} 
            className={clsx(
              'floating-label',
              {
                'text-destructive': error,
                'peer-focus-within:text-primary': !error,
              }
            )}
          >
            {label}
          </label>

          {/* Dropdown options */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar">
              <div className="p-2">
                {/* Predefined options */}
                <div className="mb-2">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Quick Select
                  </div>
                  {TIME_ALLOCATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleOptionSelect(option.value)}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group",
                        {
                          "bg-primary text-primary-foreground": value === option.value && !isCustom,
                        }
                      )}
                    >
                      <span>{option.label}</span>
                      {value === option.value && !isCustom && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Custom input option */}
                <div className="border-t border-border pt-2">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Custom Value
                  </div>
                  <div className="px-3 py-2">
                    <input
                      type="number"
                      value={inputValue}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:border-primary focus:outline-none"
                      placeholder="Enter custom value (0.125 - 1)"
                      min="0.125"
                      max="1"
                      step="0.125"
                      disabled={disabled}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a decimal value between 0.125 and 1
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-destructive mt-1 animate-in fade-in duration-200">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-muted-foreground mt-1">
            {helperText}
          </p>
        )}
      </div>
    )
  }

  // Default variant (non-floating)
  return (
    <div className="space-y-1" ref={dropdownRef}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-foreground mb-2"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <div
          className={clsx(
            'modern-input cursor-pointer flex items-center justify-between min-h-[3rem]',
            {
              'border-destructive focus-within:border-destructive focus-within:ring-destructive/20': error,
              'opacity-50 cursor-not-allowed': disabled,
            },
            className
          )}
          onClick={toggleDropdown}
        >
          <div className="flex-1 text-left">
            {isCustom ? (
              <input
                ref={inputRef}
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-none outline-none w-full"
                min="0.125"
                max="1"
                step="0.125"
                disabled={disabled}
              />
            ) : (
              <span className="block py-2">{displayValue}</span>
            )}
          </div>
          <ChevronDown 
            className={clsx(
              "h-4 w-4 text-muted-foreground transition-transform pointer-events-none",
              { "rotate-180": isOpen }
            )} 
          />
        </div>

        {/* Dropdown options */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar">
            <div className="p-2">
              {/* Predefined options */}
              <div className="mb-2">
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Quick Select
                </div>
                {TIME_ALLOCATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionSelect(option.value)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group",
                      {
                        "bg-primary text-primary-foreground": value === option.value && !isCustom,
                      }
                    )}
                  >
                    <span>{option.label}</span>
                    {value === option.value && !isCustom && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Custom input option */}
              <div className="border-t border-border pt-2">
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom Value
                </div>
                <div className="px-3 py-2">
                  <input
                    type="number"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:border-primary focus:outline-none"
                    placeholder="Enter custom value (0.125 - 1)"
                    min="0.125"
                    max="1"
                    step="0.125"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a decimal value between 0.125 and 1
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive mt-1 animate-in fade-in duration-200">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground mt-1">
          {helperText}
        </p>
      )}
    </div>
  )
}
