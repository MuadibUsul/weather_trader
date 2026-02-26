/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import { useState } from 'react'

type Props = {
  onLogin: (username: string, password: string) => Promise<void>
}

export default function LoginForm({ onLogin }: Props) {
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
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Operator Login</h2>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}