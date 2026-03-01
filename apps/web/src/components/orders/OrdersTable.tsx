import { MARKET_LABEL_MAP } from "@/lib/market-catalog";
import { useUiStore, type Environment } from "@/store/ui-store";
import { ExpandableRow, type OrderRow } from "./ExpandableRow";

function toClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function toDisplayOrderId(rawId: string): string {
  const plain = rawId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const core = (plain || "0").slice(-10).padStart(10, "0");
  return `OD${core}`;
}

export function OrdersTable({
  filter,
  rows,
  isLoading,
  onCancelOrder,
  cancelingOrderId,
}: {
  filter: "ALL" | Environment;
  rows: Array<{
    id: string;
    strategyId?: string;
    walletId?: string;
    contractName?: string;
    marketId: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    amount: number;
    fee: number;
    pnl: number;
    status: "filled" | "open" | "cancelled";
    environment: "REAL" | "PAPER";
    createdAt: string;
  }>;
  isLoading?: boolean;
  onCancelOrder?: (orderId: string) => void;
  cancelingOrderId?: string | null;
}) {
  const profiles = useUiStore((s) => s.profiles);

  const normalized: OrderRow[] = rows.map((row) => ({
    id: toDisplayOrderId(row.id),
    rawId: row.id,
    env: row.environment,
    strategy: row.strategyId ?? "--",
    wallet:
      row.walletId ??
      profiles[row.environment]?.wallet.address ??
      "--",
    contract: row.contractName ?? MARKET_LABEL_MAP[row.marketId] ?? row.marketId,
    side: row.side,
    qty: row.quantity,
    avg: row.price,
    amount: row.amount,
    fee: row.fee,
    pnl: row.pnl,
    status: row.status,
    time: toClock(row.createdAt),
  }));

  const visibleRows = filter === "ALL" ? normalized : normalized.filter((row) => row.env === filter);

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full table-fixed text-left border-collapse">
        <colgroup>
          <col className="w-[88px]" />
          <col className="w-[60px]" />
          <col className="w-[85px]" />
          <col className="w-[130px]" />
          <col className="w-[150px]" />
          <col className="w-[55px]" />
          <col className="w-[75px]" />
          <col className="w-[60px]" />
          <col className="w-[80px]" />
          <col className="w-[70px]" />
          <col className="w-[70px]" />
          <col className="w-[80px]" />
          <col className="w-[30px]" />
        </colgroup>
        <thead className="bg-[#1c2128] sticky top-0 z-20 text-xs text-text-muted font-medium uppercase tracking-wider shadow-sm">
          <tr>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium">{"\u8BA2\u5355 ID"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium">{"\u73AF\u5883"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium">{"\u7B56\u7565\u4E3B"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium">{"\u94B1\u5305\u5730\u5740"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium">{"\u5408\u7EA6\u540D\u5B57"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-center">{"\u65B9\u5411"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">{"\u6570\u91CF"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">{"\u5747\u4EF7"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">{"\u4EA4\u6613\u989D"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">{"\u624B\u7EED\u8D39"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">PnL</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium text-right">{"\u4E0B\u5355\u65F6\u95F4"}</th>
            <th className="px-3 py-2.5 border-b border-border-dark font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-dark text-xs font-mono">
          {isLoading ? (
            <tr>
              <td colSpan={13} className="px-6 py-10 text-center text-sm text-text-muted">
                Loading orders...
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-6 py-10 text-center text-sm text-text-muted">
                No orders in current environment.
              </td>
            </tr>
          ) : (
            visibleRows.map((row, idx) => (
              <ExpandableRow
                key={`${row.rawId}-${idx}`}
                row={row}
                defaultOpen={idx === 0}
                onCancelOrder={onCancelOrder}
                canceling={cancelingOrderId === row.rawId}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
