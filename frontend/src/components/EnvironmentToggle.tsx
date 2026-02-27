import { useI18n } from '../i18n'

type Props = {
  currentMode: 'live' | 'paper'
  onRequestSwitch: (nextMode: 'live' | 'paper') => void
  disabled?: boolean
}

export default function EnvironmentToggle({ currentMode, onRequestSwitch, disabled = false }: Props) {
  const { t } = useI18n()
  const isLive = currentMode === 'live'

  return (
    <div className="env-toggle" role="group" aria-label={t('wallet.env.title')}>
      <span className="env-toggle-label">{t('wallet.env.title')}</span>
      <div className="env-actions">
        <button
          type="button"
          className={!isLive ? 'active' : 'secondary'}
          disabled={disabled || !isLive}
          onClick={() => onRequestSwitch('paper')}
        >
          {t('env.paper')}
        </button>
        <button
          type="button"
          className={isLive ? 'active danger-tone' : 'secondary'}
          disabled={disabled || isLive}
          onClick={() => onRequestSwitch('live')}
        >
          {t('env.real')}
        </button>
      </div>
      {isLive && <p className="env-risk">{t('env.real_risk_short')}</p>}
    </div>
  )
}
