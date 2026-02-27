import Badge from './Badge'

type Props = {
  alerts: string[]
  emptyText: string
}

export default function AlertList({ alerts, emptyText }: Props) {
  if (alerts.length === 0) return <p className="subtle">{emptyText}</p>

  return (
    <div className="alert-list">
      {alerts.map((alert, index) => (
        <article className="alert-item" key={`${alert}-${index}`}>
          <Badge tone="warn">•</Badge>
          <span>{alert}</span>
        </article>
      ))}
    </div>
  )
}
