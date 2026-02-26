/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import type { LogEvent } from '../types'

type Props = {
  logs: LogEvent[]
}

export default function LogViewer({ logs }: Props) {
  return (
    <div className="card log-viewer">
      <h3>Logs</h3>
      <div className="log-list">
        {logs.slice(-80).reverse().map((l, idx) => (
          <div key={`${l.ts}-${idx}`} className={`log-item ${l.level.toLowerCase()}`}>
            <span>{new Date(l.ts).toLocaleTimeString()}</span>
            <strong>{l.level}</strong>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}