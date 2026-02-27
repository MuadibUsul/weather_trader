import { useI18n } from '../i18n'
import Button from './ui/Button'
import Card from './ui/Card'

type Props = {
  running: boolean
  orderSize: number
  quoteDelta: number
  dryRun: boolean
  onChange: (orderSize: number, quoteDelta: number, dryRun: boolean) => Promise<void>
  onToggle: (enabled: boolean) => Promise<void>
}

export default function StrategyControls({ running, orderSize, quoteDelta, dryRun, onChange, onToggle }: Props) {
  const { t } = useI18n()

  return (
    <Card title={t('strategy.title')} className="strategy-card">
      <div className="slider-field">
        <div className="slider-field-head">
          <span>{t('strategy.order_size')}</span>
          <strong>{orderSize.toFixed(1)}</strong>
        </div>
        <div className="slider-field-controls">
          <input
            className="slider-range"
            type="range"
            min={1}
            max={200}
            step={1}
            value={orderSize}
            onChange={(e) => onChange(Number(e.target.value), quoteDelta, dryRun)}
          />
          <input
            className="slider-number"
            type="number"
            min={1}
            max={200}
            step={1}
            value={orderSize}
            onChange={(e) => onChange(Number(e.target.value || 1), quoteDelta, dryRun)}
          />
        </div>
      </div>

      <div className="slider-field">
        <div className="slider-field-head">
          <span>{t('strategy.quote_delta')}</span>
          <strong>{quoteDelta.toFixed(3)}</strong>
        </div>
        <div className="slider-field-controls">
          <input
            className="slider-range"
            type="range"
            min={0.001}
            max={0.1}
            step={0.001}
            value={quoteDelta}
            onChange={(e) => onChange(orderSize, Number(e.target.value), dryRun)}
          />
          <input
            className="slider-number"
            type="number"
            min={0.001}
            max={0.1}
            step={0.001}
            value={quoteDelta}
            onChange={(e) => onChange(orderSize, Number(e.target.value || 0.001), dryRun)}
          />
        </div>
      </div>

      <label className="inline-check">
        <input type="checkbox" checked={dryRun} onChange={(e) => onChange(orderSize, quoteDelta, e.target.checked)} />
        <span>{t('strategy.dry_run')}</span>
      </label>

      <div className="panel-actions">
        <Button variant={running ? 'danger' : 'primary'} onClick={() => onToggle(!running)}>
          {running ? t('strategy.stop') : t('strategy.start')}
        </Button>
      </div>
    </Card>
  )
}
