import { Badge } from "@/components/common/Badge";

export function ProfileCard() {
  return (
    <div className="bg-surface-dark rounded-xl border border-border-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
          个人资料
        </h3>
        <Badge>已认证</Badge>
      </div>
      <div className="flex flex-col items-center py-4">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-blue-500 p-[2px] mb-3">
          <div className="h-full w-full rounded-full bg-[#0d1117] flex items-center justify-center">
            <span className="text-2xl font-bold text-white">WT</span>
          </div>
        </div>
        <h4 className="text-lg font-bold text-white">WeatherTrader_User</h4>
        <p className="text-xs text-text-muted">Pro Plan Member</p>
      </div>
      <div className="space-y-4 mt-2">
        <div className="space-y-1">
          <label className="text-xs text-text-muted font-medium">绑定邮箱</label>
          <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded border border-border-dark">
            <span className="text-sm text-text-main">trader***@example.com</span>
            <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-text-muted font-medium">关联钱包地址</label>
          <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded border border-border-dark">
            <span className="text-sm font-mono text-text-main truncate w-32">0x71C...aBcd</span>
            <button className="text-text-muted hover:text-white">
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
