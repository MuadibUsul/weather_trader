import { useI18n } from '../i18n'
import Card from './ui/Card'
import CopyableText from './ui/CopyableText'
import DataTable from './ui/DataTable'

type Position = {
  market_id: string
  bucket_id: string
  quantity: number
  avg_price: number
}

type Props = {
  positions: Position[]
}

export default function ActiveMarketsPanel({ positions }: Props) {
  const { t } = useI18n()

  return (
    <Card title={t('markets.title')}>
      <DataTable>
        <table className="ui-table" role="table">
          <thead>
            <tr>
              <th>{t('markets.market')}</th>
              <th>{t('markets.bucket')}</th>
              <th className="numeric">{t('markets.qty')}</th>
              <th className="numeric">{t('markets.avg_px')}</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={4} className="subtle">
                  {t('markets.none')}
                </td>
              </tr>
            )}
            {positions.map((p) => (
              <tr key={`${p.market_id}:${p.bucket_id}`}>
                <td><CopyableText value={p.market_id} /></td>
                <td><CopyableText value={p.bucket_id} /></td>
                <td className="numeric">{p.quantity.toFixed(2)}</td>
                <td className="numeric">{p.avg_price.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </Card>
  )
}
