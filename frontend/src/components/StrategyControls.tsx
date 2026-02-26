/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

type Props = {
  running: boolean
  orderSize: number
  quoteDelta: number
  dryRun: boolean
  onChange: (orderSize: number, quoteDelta: number, dryRun: boolean) => Promise<void>
  onToggle: (enabled: boolean) => Promise<void>
}

export default function StrategyControls({ running, orderSize, quoteDelta, dryRun, onChange, onToggle }: Props) {
  return (
    <div className="card">
      <h3>Strategy Controls</h3>
      <label>
        Order Size: {orderSize.toFixed(1)}
        <input
          type="range"
          min={1}
          max={200}
          step={1}
          value={orderSize}
          onChange={(e) => onChange(Number(e.target.value), quoteDelta, dryRun)}
        />
      </label>
      <label>
        Quote Delta: {quoteDelta.toFixed(3)}
        <input
          type="range"
          min={0.001}
          max={0.1}
          step={0.001}
          value={quoteDelta}
          onChange={(e) => onChange(orderSize, Number(e.target.value), dryRun)}
        />
      </label>
      <label className="row">
        Dry Run
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => onChange(orderSize, quoteDelta, e.target.checked)}
        />
      </label>
      <button className={running ? 'danger' : ''} onClick={() => onToggle(!running)}>
        {running ? 'Stop Strategy' : 'Start Strategy'}
      </button>
    </div>
  )
}