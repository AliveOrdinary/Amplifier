'use client'

import { ReactNode, ButtonHTMLAttributes } from 'react'
import { InlineLoader } from './LoadingSpinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantClasses = {
  primary: 'bg-purple-600 hover:bg-purple-700 text-white border-2 border-transparent',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white border-2 border-gray-600 hover:border-gray-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-transparent',
  success: 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-transparent',
  ghost: 'bg-transparent hover:bg-gray-700 text-white border-2 border-transparent',
  outline: 'bg-transparent hover:bg-gray-700 text-white border-2 border-gray-600 hover:border-gray-500'
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg'
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-lg
        font-semibold
        transition-all
        hover:shadow-lg
        disabled:opacity-50
        disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <InlineLoader size="sm" color="white" />
          {loadingText || children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  )
}

/**
 * IconButton - Button with only an icon (square)
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string // for accessibility
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: IconButtonProps) {
  const iconSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-label={label}
      className={`
        ${variantClasses[variant]}
        ${iconSizeClasses[size]}
        rounded-lg
        font-semibold
        transition-all
        hover:shadow-lg
        disabled:opacity-50
        disabled:cursor-not-allowed
        flex items-center justify-center
        ${className}
      `}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        icon
      )}
    </button>
  )
}

/**
 * ButtonGroup - Group related buttons together
 */
interface ButtonGroupProps {
  children: ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroup({ children, className = '', orientation = 'horizontal' }: ButtonGroupProps) {
  return (
    <div
      className={`
        flex
        ${orientation === 'horizontal' ? 'flex-row gap-3' : 'flex-col gap-2'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
