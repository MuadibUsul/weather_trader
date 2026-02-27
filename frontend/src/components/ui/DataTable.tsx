import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export default function DataTable({ children, className = '' }: Props) {
  return <div className={`table-wrap ${className}`.trim()}>{children}</div>
}
