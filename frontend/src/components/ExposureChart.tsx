import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../i18n'
import ChartCard from './ui/ChartCard'

type Position = {
  market_id: string
  bucket_id: string
  quantity: number
  avg_price: number
}

type Props = {
  positions: Position[]
}

export default function ExposureChart({ positions }: Props) {
  const { t } = useI18n()
  const data = positions.map((p) => ({
    key: `${p.market_id.slice(0, 4)}...${p.market_id.slice(-3)}:${p.bucket_id.slice(0, 3)}...${p.bucket_id.slice(-2)}`,
    exposure: Number((p.quantity * p.avg_price).toFixed(2)),
  }))

  return (
    <ChartCard title={t('exposure.title')}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
          <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-grid)' }} />
          <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-grid)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-control)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-12)',
              color: 'var(--color-text)',
            }}
          />
          <Bar dataKey="exposure" fill="var(--color-primary)" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
