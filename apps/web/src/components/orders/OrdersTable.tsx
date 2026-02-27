import { ExpandableRow } from "./ExpandableRow";

const rows = [
  {
    id: "#8829",
    env: "REAL" as const,
    contract: "NYC > 85°F (Aug 24)",
    side: "买入" as const,
    qty: 500,
    avg: 0.64,
    amount: "$320.00",
    fee: "$0.32",
    pnl: "+$45.00",
    time: "10:42:05",
  },
  {
    id: "#8828",
    env: "PAPER" as const,
    contract: "NYC 75-85°F (Aug 24)",
    side: "卖出" as const,
    qty: 200,
    avg: 0.33,
    amount: "$66.00",
    fee: "$0.00",
    pnl: "-$12.50",
    time: "10:38:12",
  },
  {
    id: "#8827",
    env: "REAL" as const,
    contract: "LND > 20°C (Aug 25)",
    side: "买入" as const,
    qty: 1000,
    avg: 0.41,
    amount: "$410.00",
    fee: "$0.41",
    pnl: "+$0.00",
    time: "09:15:00",
  },
];

export function OrdersTable() {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#1c2128] sticky top-0 z-20 text-xs text-text-muted font-medium uppercase tracking-wider shadow-sm">
          <tr>
            <th className="px-6 py-3 border-b border-border-dark font-medium">订单 ID</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium">环境</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium">合约名称</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-center">方向</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">数量</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">均价</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">交易额</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">手续费</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">PnL</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium text-right">下单时间</th>
            <th className="px-6 py-3 border-b border-border-dark font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-dark text-sm font-mono">
          {rows.map((row, idx) => (
            <ExpandableRow key={row.id} row={row} defaultOpen={idx === 0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
