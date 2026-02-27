import { useI18n } from '../i18n'
import type { LogEvent } from '../types'
import Card from './ui/Card'
import Badge from './ui/Badge'

type Props = {
  logs: LogEvent[]
}

export default function LogViewer({ logs }: Props) {
  const { t, localeTag } = useI18n()
  const rows = logs.slice(-80).reverse()

  return (
    <Card title={t('logs.title')} className="log-viewer">
      <div className="log-list">
        {rows.length === 0 && <p className="subtle">{t('logs.empty')}</p>}
        {rows.map((l, idx) => (
          <div key={`${l.ts}-${idx}`} className={`log-item ${l.level.toLowerCase()}`}>
            <span>{new Date(l.ts).toLocaleTimeString(localeTag)}</span>
            <Badge tone={l.level === 'ERROR' ? 'error' : 'info'}>{l.level}</Badge>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
