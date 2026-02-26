/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import type { StrategyStatus } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function headers(token?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Login failed')
  const data = await res.json()
  return data.access_token as string
}

export async function bindWallet(token: string, wallet_address: string, chain_id = 137) {
  const res = await fetch(`${API_BASE}/api/wallet/bind`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ wallet_address, chain_id }),
  })
  if (!res.ok) throw new Error('Wallet bind failed')
  return res.json()
}

export async function saveApiKeys(token: string, api_key: string, api_secret: string, api_passphrase: string) {
  const res = await fetch(`${API_BASE}/api/keys`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ provider: 'polymarket', api_key, api_secret, api_passphrase }),
  })
  if (!res.ok) throw new Error('Saving API key failed')
  return res.json()
}

export async function getStatus(token: string): Promise<StrategyStatus> {
  const res = await fetch(`${API_BASE}/api/strategy/status`, { headers: headers(token) })
  if (!res.ok) throw new Error('Failed to load status')
  return res.json()
}

export async function updateConfig(token: string, order_size: number, quote_delta: number, dry_run: boolean): Promise<StrategyStatus> {
  const res = await fetch(`${API_BASE}/api/strategy/config`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ order_size, quote_delta, dry_run }),
  })
  if (!res.ok) throw new Error('Config update failed')
  return res.json()
}

export async function toggleStrategy(token: string, enabled: boolean): Promise<StrategyStatus> {
  const res = await fetch(`${API_BASE}/api/strategy/toggle`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error('Toggle failed')
  return res.json()
}

export async function getTrades(token: string) {
  const res = await fetch(`${API_BASE}/api/orders/trades`, { headers: headers(token) })
  if (!res.ok) throw new Error('Failed to load trades')
  return res.json()
}

export async function getLogs(token: string) {
  const res = await fetch(`${API_BASE}/api/logs`, { headers: headers(token) })
  if (!res.ok) throw new Error('Failed to load logs')
  return res.json()
}

export function metricsWsUrl(): string {
  return API_BASE.replace('http', 'ws') + '/ws/metrics'
}

export function logsWsUrl(): string {
  return API_BASE.replace('http', 'ws') + '/ws/logs'
}