import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
  children: ReactNode
}

const variantClassMap: Record<Variant, string> = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  danger: 'ui-btn--danger',
  ghost: 'ui-btn--ghost',
}

export default function Button({ variant = 'primary', fullWidth = false, className = '', children, ...rest }: ButtonProps) {
  const classes = ['ui-btn', variantClassMap[variant], fullWidth ? 'ui-btn--full' : '', className].filter(Boolean).join(' ')
  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  )
}
