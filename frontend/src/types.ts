/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

export type StrategyStatus = {
  running: boolean
  started_at: string | null
  market_count: number
  open_orders: number
  positions: Array<{ market_id: string; bucket_id: string; quantity: number; avg_price: number }>
  metrics: Record<string, number>
  risk: {
    total_exposure: number
    max_drawdown: number
    halted: boolean
    halt_reason: string
  }
  fill_count: number
  config: {
    order_size: number
    quote_delta: number
    dry_run: boolean
  }
}

export type MetricTick = {
  type: string
  ts: string
  metrics: Record<string, number>
  risk: StrategyStatus['risk']
  positions: StrategyStatus['positions']
  running: boolean
}

export type LogEvent = {
  type?: string
  ts: string
  level: string
  message: string
  payload: Record<string, unknown>
}