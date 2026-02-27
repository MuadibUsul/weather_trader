import { useI18n } from '../i18n'
import Badge from './ui/Badge'
import SegmentedControl from './ui/SegmentedControl'

type ViewMode = 'dashboard' | 'wallets'
type EnvMode = 'live' | 'paper'

type Props = {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  environmentMode: EnvMode
  onEnvironmentChange: (mode: EnvMode) => void
}

export default function AppHeader({ view, onViewChange, environmentMode, onEnvironmentChange }: Props) {
  const { locale, setLocale, t } = useI18n()

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <h1>{t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
      </div>
      <div className="app-header-controls">
        <div className="header-group">
          <SegmentedControl
            ariaLabel={t('wallet.env.title')}
            value={environmentMode}
            onChange={onEnvironmentChange}
            options={[
              { value: 'paper', label: t('env.paper') },
              { value: 'live', label: t('env.real') },
            ]}
            className="env-segment"
          />
          <Badge tone={environmentMode === 'live' ? 'error' : 'info'}>
            {environmentMode === 'live' ? t('env.real') : t('env.paper')}
          </Badge>
        </div>
        <div className="header-group">
          <SegmentedControl
            ariaLabel={t('nav.dashboard')}
            value={view}
            onChange={onViewChange}
            options={[
              { value: 'dashboard', label: t('nav.dashboard') },
              { value: 'wallets', label: t('nav.wallets') },
            ]}
            className="nav-segment"
          />
          <div className="lang-switch">
            <select aria-label={t('lang.switch_label')} value={locale} onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}>
              <option value="zh">{t('lang.zh')}</option>
              <option value="en">{t('lang.en')}</option>
            </select>
          </div>
        </div>
      </div>
      {environmentMode === 'live' && <p className="env-risk-banner">{t('env.real_risk')}</p>}
    </header>
  )
}
