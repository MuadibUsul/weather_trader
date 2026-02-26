/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

type Position = {
  market_id: string
  bucket_id: string
  quantity: number
  avg_price: number
}

type Props = {
  positions: Position[]
}

export default function ActiveMarketsPanel({ positions }: Props) {
  return (
    <div className="card">
      <h3>Active Markets</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Bucket</th>
              <th>Qty</th>
              <th>Avg Px</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={4} className="subtle">No active positions</td>
              </tr>
            )}
            {positions.map((p) => (
              <tr key={`${p.market_id}:${p.bucket_id}`}>
                <td>{p.market_id}</td>
                <td>{p.bucket_id}</td>
                <td>{p.quantity.toFixed(2)}</td>
                <td>{p.avg_price.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}