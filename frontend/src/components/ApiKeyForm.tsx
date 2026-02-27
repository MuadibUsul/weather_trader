import { useEffect, useMemo, useState } from 'react'
import type { ApiKeyConnectivity, ApiKeyStatus } from '../api'
import { localizeErrorMessage, useI18n } from '../i18n'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import ConfirmAction from './ui/ConfirmAction'
import FormRow from './ui/FormRow'

type Props = {
  onSave: (apiKey: string, apiSecret: string, passphrase: string) => Promise<{
    status: string
    provider: string
    connectivity: ApiKeyConnectivity
  }>
  onTest: () => Promise<{
    status: string
    provider: string
    connectivity: ApiKeyConnectivity
  }>
  onDelete: () => Promise<{ status: string; provider: string; deleted: boolean }>
  onFetchStatus: () => Promise<ApiKeyStatus[]>
  onFetchWallet?: () => Promise<{ credential_id?: string | null }>
  onNotify: (kind: 'success' | 'error' | 'info', message: string) => void
}

type ConnectivityView = {
  status: 'ok' | 'error' | 'pending' | 'missing' | 'unknown'
  message: string
  testedAt: string | null
}

function maskApiKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '****'
  if (trimmed.length < 8) return '****'
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`
}

function normalizeStatus(raw: string | undefined): ConnectivityView['status'] {
  const v = (raw || '').trim().toLowerCase()
  if (v === 'ok') return 'ok'
  if (v === 'error') return 'error'
  if (v === 'pending') return 'pending'
  if (v === 'missing') return 'missing'
  if (v === 'disabled') return 'pending'
  return 'unknown'
}

function pickPreferredRow(rows: ApiKeyStatus[], walletCredentialId?: string): ApiKeyStatus | undefined {
  if (!rows.length) return undefined
  if (walletCredentialId) {
    const byWallet = rows.find((row) => row.id === walletCredentialId)
    if (byWallet) return byWallet
  }
  const byActiveMarker = rows.find((row) => row.is_active_wallet_credential)
  if (byActiveMarker) return byActiveMarker
  const byDefaultName = rows.find((row) => row.provider === 'polymarket' && (row.name || '').trim().toLowerCase() === 'default')
  if (byDefaultName) return byDefaultName
  return rows.find((row) => row.provider === 'polymarket')
}

export default function ApiKeyForm({ onSave, onTest, onDelete, onFetchStatus, onFetchWallet, onNotify }: Props) {
  const { t } = useI18n()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [savedApiKeyMasked, setSavedApiKeyMasked] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState(false)
  const [editing, setEditing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [connectivity, setConnectivity] = useState<ConnectivityView>({
    status: 'unknown',
    message: '',
    testedAt: null,
  })

  useEffect(() => {
    Promise.all([
      onFetchStatus(),
      onFetchWallet ? onFetchWallet().catch(() => null) : Promise.resolve(null),
    ])
      .then(([rows, wallet]) => {
        const walletCredentialId = wallet?.credential_id || undefined
        const row = pickPreferredRow(rows, walletCredentialId)
        if (!row) return
        setHasSavedKey(true)
        setSavedApiKeyMasked(row.api_key_masked || '****')
        setEditing(false)
        setConnectivity({
          status: normalizeStatus(row.test_status),
          message: row.test_message || '',
          testedAt: row.last_tested_at,
        })
      })
      .catch(() => undefined)
  }, [onFetchStatus, onFetchWallet])

  const statusLabel = useMemo(() => {
    if (connectivity.status === 'ok') return t('apikey.status.ok')
    if (connectivity.status === 'pending') return t('apikey.status.pending')
    if (connectivity.status === 'error') return t('apikey.status.error')
    if (connectivity.status === 'missing') return t('apikey.status.missing')
    return t('apikey.status.unknown')
  }, [connectivity.status, t])

  const statusHint = useMemo(() => {
    if (connectivity.status === 'ok') return t('apikey.hint.ok')
    if (connectivity.status === 'pending') return t('apikey.hint.pending')
    if (connectivity.status === 'error') return t('apikey.hint.error')
    if (connectivity.status === 'missing') return t('apikey.hint.missing')
    return t('apikey.hint.unknown')
  }, [connectivity.status, t])

  const canSave = Boolean(apiKey.trim() && apiSecret.trim() && passphrase.trim())
  const detailText = connectivity.message ? localizeErrorMessage(connectivity.message, t) : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await onSave(apiKey, apiSecret, passphrase)
      const nowIso = new Date().toISOString()
      const nextStatus = normalizeStatus(result.connectivity.status)
      setSavedAt(nowIso)
      setHasSavedKey(true)
      setSavedApiKeyMasked(maskApiKey(apiKey))
      setEditing(false)
      setApiSecret('')
      setPassphrase('')
      setConnectivity({
        status: nextStatus,
        message: result.connectivity.message,
        testedAt: nowIso,
      })
      if (nextStatus === 'ok') {
        onNotify('success', t('toast.api_keys_saved'))
      } else if (nextStatus === 'pending' || nextStatus === 'missing') {
        onNotify('info', t('apikey.saved_but_pending'))
      } else {
        onNotify('error', localizeErrorMessage(result.connectivity.message || t('apikey.hint.error'), t))
      }
    } catch (err) {
      const msg = localizeErrorMessage((err as Error).message, t)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setSaving(false)
    }
  }

  const deleteKeys = async () => {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await onDelete()
      setHasSavedKey(false)
      setSavedApiKeyMasked('')
      setEditing(true)
      setApiKey('')
      setApiSecret('')
      setPassphrase('')
      setSavedAt(null)
      setConnectivity({ status: 'missing', message: 'api_key_missing', testedAt: new Date().toISOString() })
      onNotify('success', t('apikey.deleted'))
    } catch (err) {
      const msg = localizeErrorMessage((err as Error).message, t)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setSaving(false)
    }
  }

  const testConnectivity = async () => {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      const result = await onTest()
      const nowIso = new Date().toISOString()
      const nextStatus = normalizeStatus(result.connectivity.status)
      setConnectivity({
        status: nextStatus,
        message: result.connectivity.message,
        testedAt: nowIso,
      })
      if (nextStatus === 'ok') {
        onNotify('success', t('apikey.status.ok'))
      } else if (nextStatus === 'pending' || nextStatus === 'missing') {
        onNotify('info', t('apikey.status.pending'))
      } else {
        onNotify('error', localizeErrorMessage(result.connectivity.message || t('apikey.hint.error'), t))
      }
    } catch (err) {
      const msg = localizeErrorMessage((err as Error).message, t)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Card title={t('apikey.title')} className="api-key-form">
        {hasSavedKey && (
          <div className="card-like api-key-manage">
            <p className="subtle">
              {t('apikey.saved_key')}: <code>{savedApiKeyMasked}</code>
            </p>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setEditing((v) => !v)} disabled={saving}>
                {editing ? t('apikey.cancel_edit') : t('apikey.edit')}
              </Button>
              <Button type="button" variant="secondary" onClick={testConnectivity} disabled={saving}>
                {t('apikey.test_connection')}
              </Button>
              <ConfirmAction
                label={t('apikey.delete')}
                confirmText={t('apikey.delete_confirm')}
                onConfirm={deleteKeys}
                disabled={saving}
                variant="danger"
              />
            </div>
          </div>
        )}

        {editing && (
          <>
            <FormRow label={t('apikey.key')} required>
              <input value={apiKey} autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
            </FormRow>
            <FormRow label={t('apikey.secret')} required>
              <input type="password" autoComplete="new-password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
            </FormRow>
            <FormRow label={t('apikey.passphrase')} required>
              <input type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </FormRow>
            <div className="form-actions">
              <Button type="submit" disabled={!canSave || saving}>
                {saving ? t('apikey.testing') : t('apikey.save_and_test')}
              </Button>
              <Button type="button" variant="secondary" onClick={testConnectivity} disabled={saving || !hasSavedKey}>
                {t('apikey.test_connection')}
              </Button>
            </div>
          </>
        )}

        {savedAt && <p className="subtle">{t('apikey.saved')}</p>}
        {error && <p className="error">{error}</p>}

        <div className="api-key-status card-like">
          <p className="subtle">{t('apikey.connectivity')}</p>
          <p className="status-line">
            <span className={`status-light ${connectivity.status}`} aria-hidden="true" />
            <Badge tone={
              connectivity.status === 'ok'
                ? 'ok'
                : connectivity.status === 'error'
                  ? 'error'
                  : connectivity.status === 'pending'
                    ? 'warn'
                    : 'neutral'
            }>
              {statusLabel}
            </Badge>
          </p>
          <p className="subtle">{statusHint}</p>
          {detailText && detailText !== statusLabel && detailText !== statusHint && (
            <p className="subtle">{t('apikey.message')}: {detailText}</p>
          )}
          {connectivity.testedAt && (
            <p className="subtle">
              {t('apikey.last_tested')}: {new Date(connectivity.testedAt).toLocaleString()}
            </p>
          )}
        </div>
      </Card>
    </form>
  )
}
