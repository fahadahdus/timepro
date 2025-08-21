import React from 'react'
import { clsx } from 'clsx'
import { ChevronDown, Check } from 'lucide-react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options?: { value: string; label: string }[]
  variant?: 'default' | 'floating'
  success?: boolean
}

export function Select({
  className,
  label,
  error,
  helperText,
  options,
  id,
  variant = 'floating',
  success = false,
  children,
  ...props
}: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substring(7)}`

  if (variant === 'floating' && label) {
    return (
      <div className="floating-label-group space-y-1">
        <div className="relative">
          <select
            id={selectId}
            className={clsx(
              'modern-select floating-input peer text-select-value',
              {
                'border-destructive focus:border-destructive focus:ring-destructive/20': error,
                'border-success focus:border-success focus:ring-success/20': success,
                'focus:ring-primary/10 focus:border-primary': !error && !success,
              },
              className
            )}
            {...props}
          >
            <option value="" disabled hidden></option>
            {options ? (
              options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            ) : (
              children
            )}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform peer-focus:rotate-180" />
          </div>
        </div>
        <label 
          htmlFor={selectId} 
          className={clsx(
            'floating-label',
            {
              'text-destructive': error,
              'text-success': success,
              'peer-focus:text-primary': !error && !success,
            }
          )}
        >
          {label}
        </label>
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
        {success && (
          <p className="text-sm text-success mt-1 success-pulse">
            ✓ Looks good!
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-foreground mb-2"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={clsx(
            'modern-select text-select-value appearance-none',
            {
              'border-destructive focus:border-destructive focus:ring-destructive/20': error,
              'border-success focus:border-success focus:ring-success/20': success,
            },
            className
          )}
          {...props}
        >
          {options ? (
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            children
          )}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
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
      {success && (
        <p className="text-sm text-success mt-1 success-pulse">
          ✓ Looks good!
        </p>
      )}
    </div>
  )
}