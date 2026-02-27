import type { ReactNode } from 'react'

type FormRowProps = {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

export default function FormRow({ label, required = false, hint, error, htmlFor, children, className = '' }: FormRowProps) {
  return (
    <div className={`form-row ${className}`.trim()}>
      <label className="form-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {required && (
          <span className="required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="form-hint subtle">{hint}</p>}
      {error && <p className="form-error error">{error}</p>}
    </div>
  )
}
