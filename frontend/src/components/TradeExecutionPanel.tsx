import { useState } from 'react'
import { useI18n } from '../i18n'

type Props = {
  environmentMode: 'live' | 'paper'
  busy: boolean
  onSubmit: (payload: {
    market_id: string
    bucket_id: string
    side: 'BUY' | 'SELL'
    size: number
    price: number
    max_slippage: number
    note: string
  }) => Promise<void>
  orderResult: {
    orderId: string
    status: string
    paper: boolean
    message: string
  } | null
}

export default function TradeExecutionPanel({ environmentMode, busy, onSubmit, orderResult }: Props) {
  const { t } = useI18n()
  const [marketId, setMarketId] = useState('')
  const [bucketId, setBucketId] = useState('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [size, setSize] = useState('10')
  const [price, setPrice] = useState('0.5')
  const [slippage, setSlippage] = useState('0.02')
  const [note, setNote] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    await onSubmit({
      market_id: marketId.trim(),
      bucket_id: bucketId.trim(),
      side,
      size: Number(size),
      price: Number(price),
      max_slippage: Number(slippage),
      note: note.trim(),
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>{t('trade.title')}</h3>
      <p className="subtle">{environmentMode === 'live' ? t('trade.mode_real') : t('trade.mode_paper')}</p>
      <label>
        {t('trade.market_id')}<span className="required" aria-hidden="true">*</span>
        <input value={marketId} onChange={(e) => setMarketId(e.target.value)} required />
      </label>
      <label>
        {t('trade.bucket_id')}<span className="required" aria-hidden="true">*</span>
        <input value={bucketId} onChange={(e) => setBucketId(e.target.value)} required />
      </label>
      <label>
        {t('trade.side')}
        <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </label>
      <label>
        {t('trade.size')}<span className="required" aria-hidden="true">*</span>
        <input value={size} type="number" min="0.0001" step="0.0001" onChange={(e) => setSize(e.target.value)} required />
      </label>
      <label>
        {t('trade.price')}<span className="required" aria-hidden="true">*</span>
        <input value={price} type="number" min="0.0001" max="0.9999" step="0.0001" onChange={(e) => setPrice(e.target.value)} required />
      </label>
      <label>
        {t('trade.max_slippage')}
        <input value={slippage} type="number" min="0" max="0.5" step="0.001" onChange={(e) => setSlippage(e.target.value)} />
      </label>
      <label>
        {t('trade.note')}
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? t('trade.submitting') : t('trade.submit')}</button>

      {orderResult && (
        <div className="card-like">
          <p className="subtle">{t('trade.last_order')}: <code>{orderResult.orderId}</code></p>
          <p className="subtle">{t('trade.order_status')}: {orderResult.status}</p>
          <p className="subtle">{t('trade.order_path')}: {orderResult.paper ? t('env.paper') : t('env.real')}</p>
          {orderResult.message && <p className="subtle">{orderResult.message}</p>}
        </div>
      )}
    </form>
  )
}
