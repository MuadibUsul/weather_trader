import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

type Props = {
  open: boolean
  title: string
  description: string
  busy: boolean
  error: string
  onClose: () => void
  onConfirm: (pin: string) => Promise<void>
}

export default function TradePinModal({ open, title, description, busy, error, onClose, onConfirm }: Props) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) {
      setPin('')
    }
  }, [open])

  if (!open) return null

  const titleId = 'trade-pin-modal-title'
  const descId = 'trade-pin-modal-desc'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || pin.length !== 6) return
    await onConfirm(pin)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
      <form className="modal-card" onSubmit={submit}>
        <h3 id={titleId}>{title}</h3>
        <p className="subtle" id={descId}>{description}</p>
        <label>
          {t('security.trade_pin')}
          <input
            value={pin}
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="******"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit" disabled={busy || pin.length !== 6}>
            {busy ? t('security.verifying') : t('security.confirm')}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {t('security.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
