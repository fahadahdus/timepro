import React from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  variant?: 'default' | 'floating'
  success?: boolean
  icon?: React.ReactNode
}

export function Input({
  className,
  label,
  error,
  helperText,
  id,
  variant = 'floating',
  success = false,
  icon,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substring(7)}`

  if (variant === 'floating' && label) {
    return (
      <div className="floating-label-group space-y-1">
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-20 flex items-center justify-center w-5 h-5">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            className={clsx(
              'modern-input floating-input peer text-input-value',
              {
                'border-destructive focus:border-destructive focus:ring-destructive/20': error,
                'border-success focus:border-success focus:ring-success/20': success,
                'focus:ring-primary/10 focus:border-primary': !error && !success,
                'pl-10': icon,
              },
              className
            )}
            placeholder=" "
            {...props}
          />
          <label 
            htmlFor={inputId} 
            className={clsx(
              'floating-label',
              {
                'text-destructive': error,
                'text-success': success,
                'peer-focus:text-primary': !error && !success,
                'left-10': icon,
              }
            )}
          >
            {label}
          </label>
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

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-foreground mb-2"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-20 flex items-center justify-center w-5 h-5">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx(
            'modern-input text-input-value',
            {
              'border-destructive focus:border-destructive focus:ring-destructive/20': error,
              'border-success focus:border-success focus:ring-success/20': success,
              'pl-10': icon,
            },
            className
          )}
          {...props}
        />
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