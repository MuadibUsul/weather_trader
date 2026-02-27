import type { ReactNode } from 'react'

type Option<T extends string> = {
  value: T
  label: ReactNode
}

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  disabled?: boolean
  ariaLabel?: string
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
  ariaLabel,
}: Props<T>) {
  return (
    <div className={`segmented ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => onChange(option.value)}
          disabled={disabled || option.value === value}
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
