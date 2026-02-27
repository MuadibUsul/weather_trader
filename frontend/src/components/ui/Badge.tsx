import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'ok' | 'warn' | 'error' | 'info'

type Props = {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

export default function Badge({ tone = 'neutral', children, className = '' }: Props) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>
}
