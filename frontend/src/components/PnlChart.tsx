import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../i18n'
import ChartCard from './ui/ChartCard'

type Point = { ts: string; pnl: number }

type Props = {
  data: Point[]
}

export default function PnlChart({ data }: Props) {
  const { t } = useI18n()

  return (
    <ChartCard title={t('pnl.title')}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
          <XAxis dataKey="ts" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-grid)' }} />
          <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-grid)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-control)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-12)',
              color: 'var(--color-text)',
            }}
          />
          <Area type="monotone" dataKey="pnl" stroke="var(--color-primary)" strokeWidth={2} fill="url(#pnl)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
