import type { ReactNode } from 'react'
import Card from './Card'

type Props = {
  title: string
  children: ReactNode
  className?: string
}

export default function ChartCard({ title, children, className = '' }: Props) {
  return (
    <Card title={title} className={`chart-card ${className}`.trim()}>
      {children}
    </Card>
  )
}
