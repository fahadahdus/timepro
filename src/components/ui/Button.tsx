import React from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  icon,
  iconPosition = 'left',
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'modern-button interactive group relative overflow-hidden',
        {
          // Variants
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl active:shadow-md': variant === 'primary',
          'variant-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-sm hover:shadow-md': variant === 'secondary',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-xl active:shadow-md': variant === 'danger',
          'variant-success bg-success text-white hover:bg-success/90 shadow-lg hover:shadow-xl active:shadow-md': variant === 'success',
          'hover:bg-accent hover:text-accent-foreground border-2 border-transparent hover:border-accent': variant === 'ghost',
          'border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md': variant === 'outline',
          // Sizes
          'h-9 px-4 text-xs gap-1.5': size === 'sm',
          'h-12 px-8 text-sm gap-2.5': size === 'md',
          'h-14 px-10 text-base gap-3': size === 'lg',
          // States
          'opacity-50 cursor-not-allowed': disabled || loading,
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="inline-flex">{icon}</span>
      )}
      
      {children}
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="inline-flex">{icon}</span>
      )}
    </button>
  )
}