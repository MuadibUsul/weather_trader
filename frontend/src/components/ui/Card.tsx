import type { ReactNode } from 'react'

type CardProps = {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function Card({ title, subtitle, actions, children, className = '' }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions || subtitle) && (
        <header className="card-header">
          <div className="card-header-main">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="subtle card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}
