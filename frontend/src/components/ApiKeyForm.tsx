/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import { useState } from 'react'

type Props = {
  onSave: (apiKey: string, apiSecret: string, passphrase: string) => Promise<void>
}

export default function ApiKeyForm({ onSave }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(apiKey, apiSecret, passphrase)
    setMessage('Saved')
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Polymarket API Keys</h3>
      <label>
        API Key
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <label>
        API Secret
        <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
      </label>
      <label>
        Passphrase
        <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      </label>
      <button type="submit">Save Keys</button>
      {message && <p className="subtle">{message}</p>}
    </form>
  )
}