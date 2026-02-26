/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

type Props = {
  alerts: string[]
}

export default function AlertCenter({ alerts }: Props) {
  return (
    <div className="card">
      <h3>Alert Center</h3>
      {alerts.length === 0 && <p className="subtle">No active alerts</p>}
      {alerts.map((a, i) => (
        <div key={`${a}-${i}`} className="alert">{a}</div>
      ))}
    </div>
  )
}