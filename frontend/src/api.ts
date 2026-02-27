/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import type { StrategyStatus } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export type LiveWallet = {
  wallet_id: string
  wallet_address: string
  note: string
  chain_id: number
  is_active: boolean
  has_private_key: boolean
  credential_id?: string | null
  credential_name?: string
  created_at: string
}

export type PaperWallet = {
  wallet_id: string
  wallet_address: string
  note: string
  initial_usdc: number
  balance_usdc: number
  is_active: boolean
  created_at: string
}

export type ApiKeyConnectivity = {
  status: 'ok' | 'error' | 'pending' | 'missing' | 'unknown'
  message: string
}

export type SecurityProfile = {
  email: string
  email_verified: boolean
  trade_pin_set: boolean
  trade_pin_locked_until: string | null
  current_env: 'REAL' | 'PAPER'
}

export type ApiKeyStatus = {
  id?: string
  name?: string
  provider: string
  api_key_masked: string
  test_status: string
  test_message: string
  last_tested_at: string | null
  is_active_wallet_credential?: boolean
}

function normalizeConnectivityStatus(raw: string | undefined): ApiKeyConnectivity['status'] {
  const value = (raw || '').trim().toLowerCase()
  if (value === 'ok') return 'ok'
  if (value === 'error') return 'error'
  if (value === 'pending') return 'pending'
  if (value === 'missing') return 'missing'
  if (value === 'disabled') return 'pending'
  return 'unknown'
}

function headers(token?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw new Error('Network request failed')
  }
}

async function assertOk(res: Response, message: string): Promise<void> {
  if (res.ok) return
  if (res.status === 401) throw new Error('Unauthorized')
  let detail = ''
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string' && body.detail.trim()) detail = body.detail.trim()
  } catch {
    // ignore parse failures and fall back to default message
  }
  if (detail) throw new Error(detail)
  throw new Error(message)
}

export async function login(username: string, password: string): Promise<string> {
  const res = await request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Login failed')
  const data = await res.json()
  return data.access_token as string
}

export async function createWalletBindChallenge(token: string) {
  const res = await request(`${API_BASE}/api/wallet/challenge`, {
    method: 'POST',
    headers: headers(token),
  })
  await assertOk(res, 'Wallet challenge failed')
  return res.json() as Promise<{ status: string; challenge_message: string; expires_at: string; ttl_seconds: number }>
}

export async function bindWallet(
  token: string,
  wallet_address: string,
  note: string,
  chain_id = 137,
  challenge_message?: string,
  signature?: string,
) {
  const res = await request(`${API_BASE}/api/wallet/bind`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ wallet_address, chain_id, note, challenge_message, signature }),
  })
  await assertOk(res, 'Wallet bind failed')
  return res.json() as Promise<{ status: string; wallet_address: string; note: string; chain_id: number }>
}

export async function getWallet(token: string) {
  const res = await request(`${API_BASE}/api/wallet`, { headers: headers(token) })
  await assertOk(res, 'Wallet load failed')
  return res.json() as Promise<{
    wallet_address: string | null
    note: string
    chain_id: number
    credential_id?: string | null
    credential_name?: string
  }>
}

export async function listLiveWallets(token: string) {
  const res = await request(`${API_BASE}/api/wallet/live`, { headers: headers(token) })
  await assertOk(res, 'Wallet load failed')
  return res.json() as Promise<LiveWallet[]>
}

export async function activateLiveWallet(token: string, wallet_id: string) {
  const res = await request(`${API_BASE}/api/wallet/live/activate`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ wallet_id }),
  })
  await assertOk(res, 'Wallet bind failed')
  return res.json()
}

export async function deleteLiveWallet(token: string, wallet_id: string) {
  const res = await request(`${API_BASE}/api/wallet/live/${wallet_id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await assertOk(res, 'Wallet delete failed')
  return res.json() as Promise<{ status: string; wallet_id: string; deleted: boolean }>
}

export async function bindWalletPrivateKey(token: string, private_key: string, note: string) {
  const res = await request(`${API_BASE}/api/wallet/private-key`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ private_key, note }),
  })
  await assertOk(res, 'Wallet bind failed')
  return res.json() as Promise<{ status: string; wallet_address: string; note: string; chain_id: number }>
}

export async function disconnectWallet(token: string) {
  const res = await request(`${API_BASE}/api/wallet/disconnect`, {
    method: 'POST',
    headers: headers(token),
  })
  await assertOk(res, 'Wallet disconnect failed')
  return res.json() as Promise<{ status: string; disconnected: boolean; paper_mode: boolean }>
}

export async function listPaperWallets(token: string) {
  const res = await request(`${API_BASE}/api/wallet/paper`, { headers: headers(token) })
  await assertOk(res, 'Wallet load failed')
  return res.json() as Promise<PaperWallet[]>
}

export async function createPaperWallet(token: string, initial_usdc: 1000 | 5000 | 10000, note: string) {
  const res = await request(`${API_BASE}/api/wallet/paper/create`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ initial_usdc, note }),
  })
  await assertOk(res, 'Wallet bind failed')
  return res.json() as Promise<{
    status: string
    wallet_id: string
    wallet_address: string
    note: string
    initial_usdc: number
    balance_usdc: number
    is_active: boolean
  }>
}

export async function activatePaperWallet(token: string, wallet_id: string) {
  const res = await request(`${API_BASE}/api/wallet/paper/activate`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ wallet_id }),
  })
  await assertOk(res, 'Wallet bind failed')
  return res.json()
}

export async function deletePaperWallet(token: string, wallet_id: string) {
  const res = await request(`${API_BASE}/api/wallet/paper/${wallet_id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await assertOk(res, 'Wallet delete failed')
  return res.json() as Promise<{ status: string; wallet_id: string; deleted: boolean }>
}

export async function saveApiKeys(token: string, api_key: string, api_secret: string, api_passphrase: string) {
  const res = await request(`${API_BASE}/api/keys`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ provider: 'polymarket', api_key, api_secret, api_passphrase }),
  })
  await assertOk(res, 'Saving API key failed')
  const data = (await res.json()) as { status: string; provider: string; connectivity: ApiKeyConnectivity }
  return {
    ...data,
    connectivity: {
      ...data.connectivity,
      status: normalizeConnectivityStatus(data.connectivity?.status),
    },
  }
}

export async function testApiKeys(token: string, provider = 'polymarket') {
  const res = await request(`${API_BASE}/api/keys/test?provider=${encodeURIComponent(provider)}`, {
    method: 'POST',
    headers: headers(token),
  })
  await assertOk(res, 'API key test failed')
  const data = (await res.json()) as { status: string; provider: string; connectivity: ApiKeyConnectivity }
  return {
    ...data,
    connectivity: {
      ...data.connectivity,
      status: normalizeConnectivityStatus(data.connectivity?.status),
    },
  }
}

export async function deleteApiKeys(token: string, provider = 'polymarket') {
  const res = await request(`${API_BASE}/api/keys?provider=${encodeURIComponent(provider)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await assertOk(res, 'API key delete failed')
  return res.json() as Promise<{ status: string; provider: string; deleted: boolean }>
}

export async function listApiKeys(token: string) {
  const res = await request(`${API_BASE}/api/keys`, { headers: headers(token) })
  await assertOk(res, 'Failed to load API key status')
  const rows = (await res.json()) as ApiKeyStatus[]
  return rows.map((row) => ({
    ...row,
    test_status: normalizeConnectivityStatus(row.test_status),
  }))
}

export async function getStatus(token: string): Promise<StrategyStatus> {
  const res = await request(`${API_BASE}/api/strategy/status`, { headers: headers(token) })
  await assertOk(res, 'Failed to load status')
  return res.json()
}

export async function updateConfig(token: string, order_size: number, quote_delta: number, dry_run: boolean): Promise<StrategyStatus> {
  const res = await request(`${API_BASE}/api/strategy/config`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ order_size, quote_delta, dry_run }),
  })
  await assertOk(res, 'Config update failed')
  return res.json()
}

export async function toggleStrategy(token: string, enabled: boolean): Promise<StrategyStatus> {
  const res = await request(`${API_BASE}/api/strategy/toggle`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ enabled }),
  })
  await assertOk(res, 'Toggle failed')
  return res.json()
}

export async function switchEnvironment(token: string, mode: 'live' | 'paper'): Promise<StrategyStatus> {
  throw new Error('trade_pin_required')
}

export async function switchEnvironmentWithPin(token: string, mode: 'live' | 'paper', trade_pin: string): Promise<StrategyStatus> {
  const res = await request(`${API_BASE}/api/strategy/environment`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ mode, trade_pin }),
  })
  await assertOk(res, 'Switch environment failed')
  return res.json()
}

export async function getSecurityProfile(token: string) {
  const res = await request(`${API_BASE}/api/security/profile`, {
    headers: headers(token),
  })
  await assertOk(res, 'Failed to load security profile')
  return res.json() as Promise<SecurityProfile>
}

export async function setTradePin(token: string, current_password: string, trade_pin: string) {
  const res = await request(`${API_BASE}/api/security/trade-pin/set`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ current_password, trade_pin }),
  })
  await assertOk(res, 'Failed to set trade pin')
  return res.json() as Promise<{ status: string; trade_pin_set: boolean; updated_at: string | null }>
}

export async function requestEmailBind(token: string, email: string, current_password: string) {
  const res = await request(`${API_BASE}/api/security/email/bind/request`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email, current_password }),
  })
  await assertOk(res, 'Failed to request email bind')
  return res.json() as Promise<{
    status: string
    email: string
    expires_at: string
    delivery: { sent: boolean; channel: string; message: string }
    debug_code?: string
  }>
}

export async function verifyEmailBind(token: string, email: string, code: string) {
  const res = await request(`${API_BASE}/api/security/email/bind/verify`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email, code }),
  })
  await assertOk(res, 'Failed to verify email')
  return res.json() as Promise<{ status: string; email: string; email_verified: boolean }>
}

export async function requestTradePinReset(token: string, email: string) {
  const res = await request(`${API_BASE}/api/security/trade-pin/reset/request`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email }),
  })
  await assertOk(res, 'Failed to request trade pin reset')
  return res.json() as Promise<{
    status: string
    expires_at: string
    delivery: { sent: boolean; channel: string; message: string }
    debug_code?: string
  }>
}

export async function confirmTradePinReset(token: string, email: string, code: string, new_trade_pin: string) {
  const res = await request(`${API_BASE}/api/security/trade-pin/reset/confirm`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email, code, new_trade_pin }),
  })
  await assertOk(res, 'Failed to reset trade pin')
  return res.json() as Promise<{ status: string; trade_pin_set: boolean }>
}

export async function placeTrade(
  token: string,
  payload: {
    market_id: string
    bucket_id: string
    side: 'BUY' | 'SELL'
    size: number
    price: number
    max_slippage?: number
    note?: string
    trade_pin?: string
  },
) {
  const res = await request(`${API_BASE}/api/trade/place`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  })
  await assertOk(res, 'Place trade failed')
  return res.json() as Promise<{
    status: string
    ok: boolean
    order_id: string
    paper: boolean
    wallet_address: string
    credential_id: string
  }>
}

export async function getTradeOrder(token: string, orderId: string) {
  const res = await request(`${API_BASE}/api/trade/orders/${encodeURIComponent(orderId)}`, {
    headers: headers(token),
  })
  await assertOk(res, 'Failed to load order status')
  return res.json() as Promise<{
    order_id: string
    status: string
    market_id: string
    bucket_id: string
    side: string
    price: number | null
    size: number | null
    filled_size: number
    paper?: boolean
  }>
}

export async function getTrades(token: string) {
  const res = await request(`${API_BASE}/api/orders/trades`, { headers: headers(token) })
  await assertOk(res, 'Failed to load trades')
  return res.json()
}

export async function getLogs(token: string) {
  const res = await request(`${API_BASE}/api/logs`, { headers: headers(token) })
  await assertOk(res, 'Failed to load logs')
  return res.json()
}

export function metricsWsUrl(): string {
  return API_BASE.replace('http', 'ws') + '/ws/metrics'
}

export function logsWsUrl(): string {
  return API_BASE.replace('http', 'ws') + '/ws/logs'
}
