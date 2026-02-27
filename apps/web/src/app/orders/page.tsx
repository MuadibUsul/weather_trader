import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { OrdersTable } from "@/components/orders/OrdersTable";

function OrdersWorkspace() {
  return (
    <section className="flex flex-col h-full overflow-hidden bg-surface-dark rounded-xl border border-border-dark shadow-xl">
      <div className="p-4 border-b border-border-dark bg-[#1c2128] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center border border-border-dark rounded-lg overflow-hidden bg-background-dark/50">
            <button className="px-3 py-1.5 text-xs font-medium text-white bg-border-dark/50">全部</button>
            <button className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-white hover:bg-white/5 transition-colors border-l border-border-dark">
              REAL
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-white hover:bg-white/5 transition-colors border-l border-border-dark">
              PAPER
            </button>
          </div>
          <div className="relative">
            <select className="pl-8 pr-4 py-1.5 bg-background-dark/50 border border-border-dark rounded-lg text-xs text-white appearance-none focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer">
              <option>状态: 全部</option>
              <option>已成交 (Filled)</option>
              <option>已撤单 (Cancelled)</option>
              <option>待成交 (Open)</option>
            </select>
            <span className="material-symbols-outlined absolute left-2 top-1.5 text-text-muted text-[16px]">filter_alt</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted bg-background-dark/50 border border-border-dark rounded-lg px-3 py-1.5">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span>2024-08-01</span>
            <span>-</span>
            <span>2024-08-24</span>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg text-xs font-bold transition-all">
          <span className="material-symbols-outlined text-[16px]">download</span>
          导出 CSV
        </button>
      </div>

      <OrdersTable />

      <div className="p-4 border-t border-border-dark bg-[#1c2128] flex items-center justify-between text-xs text-text-muted">
        <span>显示 1-5 of 128 订单</span>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-border-dark hover:bg-white/10 disabled:opacity-50" disabled>
            上一页
          </button>
          <button className="px-3 py-1 rounded bg-border-dark hover:bg-white/10 text-white">1</button>
          <button className="px-3 py-1 rounded bg-surface-dark hover:bg-white/10">2</button>
          <button className="px-3 py-1 rounded bg-surface-dark hover:bg-white/10">3</button>
          <span className="px-2 py-1">...</span>
          <button className="px-3 py-1 rounded bg-border-dark hover:bg-white/10">下一页</button>
        </div>
      </div>
    </section>
  );
}

export default function OrdersPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/orders" main={<OrdersWorkspace />} />
    </PageTransition>
  );
}
