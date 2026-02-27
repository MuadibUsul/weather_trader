import { useI18n } from '../i18n'
import Badge from './ui/Badge'
import Card from './ui/Card'

type Props = {
  totalExposure: number
  maxDrawdown: number
  halted: boolean
  haltReason: string
}

export default function RiskGauge({ totalExposure, maxDrawdown, halted, haltReason }: Props) {
  const { t } = useI18n()
  const drawdownPct = Math.min(100, maxDrawdown * 100)
  const reason = haltReason || t('risk.guard_triggered')

  return (
    <Card title={t('risk.title')}>
      <div className="gauge" role="img" aria-label={t('risk.drawdown', { value: drawdownPct.toFixed(2) })}>
        <div className="gauge-fill" style={{ width: `${drawdownPct}%` }} />
      </div>
      <div className="risk-metrics">
        <p className="subtle">{t('risk.drawdown', { value: drawdownPct.toFixed(2) })}</p>
        <p className="subtle">{t('risk.total_exposure', { value: totalExposure.toFixed(2) })}</p>
      </div>
      {halted ? <Badge tone="error">{t('risk.halted', { reason })}</Badge> : <Badge tone="ok">{t('risk.healthy')}</Badge>}
    </Card>
  )
}
