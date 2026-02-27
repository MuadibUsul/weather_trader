import { Panel } from "@/components/common/Panel";
import { Table } from "@/components/common/Table";
import { Button } from "@/components/common/Button";

const rows = [
  { name: "NYC > 85°F", exp: "24 Aug 2024", odds: "0.65", change: "+12%", tone: "up" },
  { name: "NYC 75-85°F", exp: "24 Aug 2024", odds: "0.32", change: "-5%", tone: "down" },
  { name: "NYC < 75°F", exp: "24 Aug 2024", odds: "0.03", change: "0%", tone: "flat" },
];

export function ContractTable() {
  return (
    <Panel
      title="温度桶合约 (NYC)"
      icon={<span className="material-symbols-outlined text-primary text-[20px]">water_drop</span>}
      className="flex-1"
      actions={
        <div className="flex gap-2">
          <button className="p-1.5 rounded hover:bg-border-dark text-text-muted">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
          <button className="p-1.5 rounded hover:bg-border-dark text-text-muted">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
          </button>
        </div>
      }
    >
      <Table
        className="flex-1"
        head={
          <tr>
            <th className="px-4 py-3 font-medium border-b border-border-dark">合约名称</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">当前赔率</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">24H 变化</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">概率趋势</th>
            <th className="px-4 py-3 font-medium border-b border-border-dark text-right">操作</th>
          </tr>
        }
        body={rows.map((row) => (
          <tr key={row.name} className="hover:bg-white/5 transition-colors group">
            <td className="px-4 py-3">
              <div className="flex flex-col">
                <span className={row.tone === "flat" ? "text-text-muted font-medium" : "text-white font-medium"}>
                  {row.name}
                </span>
                <span className="text-xs text-text-muted">Exp: {row.exp}</span>
              </div>
            </td>
            <td
              className={`px-4 py-3 text-right font-mono ${
                row.tone === "up" ? "text-primary font-bold" : row.tone === "down" ? "text-white" : "text-text-muted"
              }`}
            >
              {row.odds}
            </td>
            <td
              className={`px-4 py-3 text-right font-mono ${
                row.tone === "up"
                  ? "text-primary"
                  : row.tone === "down"
                    ? "text-accent-error"
                    : "text-text-muted"
              }`}
            >
              {row.change}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end items-center h-full">
                <div
                  className={`w-16 h-6 rounded-sm border-b ${
                    row.tone === "up"
                      ? "bg-gradient-to-r from-transparent via-primary/20 to-primary/50 border-primary"
                      : row.tone === "down"
                        ? "bg-gradient-to-r from-transparent via-accent-error/20 to-accent-error/50 border-accent-error"
                        : "bg-gradient-to-r from-transparent via-text-muted/10 to-text-muted/20 border-text-muted"
                  }`}
                />
              </div>
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                variant={row.tone === "up" ? "primary" : "secondary"}
                className={
                  row.tone === "up"
                    ? "px-3 py-1 rounded text-xs bg-primary/10 hover:bg-primary text-primary hover:text-surface-dark"
                    : "px-3 py-1 rounded text-xs"
                }
              >
                TRADE
              </Button>
            </td>
          </tr>
        ))}
      />
    </Panel>
  );
}
