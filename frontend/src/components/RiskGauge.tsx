/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

type Props = {
  totalExposure: number
  maxDrawdown: number
  halted: boolean
  haltReason: string
}

export default function RiskGauge({ totalExposure, maxDrawdown, halted, haltReason }: Props) {
  const drawdownPct = Math.min(100, maxDrawdown * 100)
  return (
    <div className="card">
      <h3>Risk Gauge</h3>
      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${drawdownPct}%` }} />
      </div>
      <p className="subtle">Drawdown: {drawdownPct.toFixed(2)}%</p>
      <p className="subtle">Total Exposure: ${totalExposure.toFixed(2)}</p>
      <p className={halted ? 'error' : 'ok'}>{halted ? `HALTED: ${haltReason || 'risk guard triggered'}` : 'Healthy'}</p>
    </div>
  )
}