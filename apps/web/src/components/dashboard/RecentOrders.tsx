import { Panel } from "@/components/common/Panel";

const orders = [
  ["BUY", "NYC > 85°F", "500 qty", "@0.64", "10:42:05"],
  ["SELL", "NYC 75-85°F", "200 qty", "@0.33", "10:38:12"],
  ["BUY", "LND > 20°C", "1000 qty", "@0.41", "09:15:00"],
] as const;

export function RecentOrders() {
  return (
    <Panel title="最近订单" className="h-full" headerClassName="px-4 py-2">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <tbody className="text-xs font-mono">
            {orders.map((item, idx) => (
              <tr
                key={`${item[0]}-${item[1]}`}
                className={`border-b border-border-dark/50 ${idx === 2 ? "opacity-50" : ""}`}
              >
                <td className={`p-2 ${item[0] === "BUY" ? "text-primary" : "text-accent-error"}`}>{item[0]}</td>
                <td className="p-2">{item[1]}</td>
                <td className="p-2 text-right">{item[2]}</td>
                <td className="p-2 text-right">{item[3]}</td>
                <td className="p-2 text-right text-text-muted">{item[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
