import { useState } from 'react'
import { localizeErrorMessage, useI18n } from '../i18n'
import Button from './ui/Button'
import Card from './ui/Card'
import FormRow from './ui/FormRow'

type Props = {
  onLogin: (username: string, password: string) => Promise<void>
  onNotify: (kind: 'success' | 'error', message: string) => void
}

export default function LoginForm({ onLogin, onNotify }: Props) {
  const { t } = useI18n()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onLogin(username, password)
      onNotify('success', t('toast.login_success'))
    } catch (err) {
      const msg = localizeErrorMessage((err as Error).message, t)
      setError(msg)
      onNotify('error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Card title={t('login.title')}>
        <FormRow label={t('login.username')} required>
          <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </FormRow>
        <FormRow label={t('login.password')} required error={error || undefined}>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormRow>
        <div className="panel-actions">
          <Button type="submit" disabled={loading}>
            {loading ? t('login.signing_in') : t('login.sign_in')}
          </Button>
        </div>
      </Card>
    </form>
  )
}
