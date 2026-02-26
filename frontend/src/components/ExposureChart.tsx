/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Position = {
  market_id: string
  bucket_id: string
  quantity: number
  avg_price: number
}

type Props = {
  positions: Position[]
}

export default function ExposureChart({ positions }: Props) {
  const data = positions.map((p) => ({
    key: `${p.market_id.slice(0, 6)}:${p.bucket_id.slice(0, 6)}`,
    exposure: Number((p.quantity * p.avg_price).toFixed(2)),
  }))

  return (
    <div className="card chart-card">
      <h3>Position Exposure</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="key" tick={{ fill: '#9aa6be', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9aa6be', fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="exposure" fill="#ffa742" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}