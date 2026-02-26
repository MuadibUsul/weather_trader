/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Point = { ts: string; pnl: number }

type Props = {
  data: Point[]
}

export default function PnlChart({ data }: Props) {
  return (
    <div className="card chart-card">
      <h3>Live PnL</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#21d0b2" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#21d0b2" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#2b3042" />
          <XAxis dataKey="ts" tick={{ fill: '#9aa6be', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9aa6be', fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="pnl" stroke="#21d0b2" fill="url(#pnl)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}