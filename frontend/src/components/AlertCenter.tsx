import { useI18n } from '../i18n'
import AlertList from './ui/AlertList'
import Card from './ui/Card'

type Props = {
  alerts: string[]
}

export default function AlertCenter({ alerts }: Props) {
  const { t } = useI18n()

  return (
    <Card title={t('alerts.title')}>
      <AlertList alerts={alerts} emptyText={t('alerts.none')} />
    </Card>
  )
}
