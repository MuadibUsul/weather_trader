/**
 * 前端 API 封装测试。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { login, logsWsUrl, metricsWsUrl } from './api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api.ts', () => {
  it('login 请求成功时返回 access token', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fakeFetch)

    const token = await login('admin', 'admin123')

    expect(token).toBe('token_123')
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    const [url, options] = fakeFetch.mock.calls[0]
    expect(String(url)).toContain('/api/auth/login')
    expect((options as RequestInit).method).toBe('POST')
  })

  it('login 失败时抛出异常', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('bad request', { status: 401 }))
    vi.stubGlobal('fetch', fakeFetch)

    await expect(login('admin', 'wrong')).rejects.toThrow('Login failed')
  })

  it('生成 websocket 地址', () => {
    expect(metricsWsUrl()).toMatch(/\/ws\/metrics$/)
    expect(logsWsUrl()).toMatch(/\/ws\/logs$/)
  })
})
