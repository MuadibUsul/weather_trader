# Design Gaps

以下状态在原始 `design/v3_x/code.html` 未给出完整行为，已补齐并保持 token 化：

1. `EnvironmentSwitchConfirmModal` 错误态
- 新增：PIN 错误时输入框抖动 + 错误文案。
- 文件：`apps/web/src/components/modal/PinInput.tsx`、`apps/web/src/components/modal/EnvironmentSwitchConfirmModal.tsx`
- 数值来源：
  - 抖动位移 `4px/2px`（source: HTML 中最小间距粒度 2px/4px）
  - 动画时长 `280ms`（source: HTML 交互动画 `duration-300` 对齐）

2. 导航与按钮 focus/hover 统一
- 新增：全局按钮和导航的 focus/hover 一致化，避免键盘导航无反馈。
- 文件：`apps/web/src/components/common/Button.tsx`、`apps/web/src/components/global/SidebarNav.tsx`
- 数值来源：现有 `hover:*` class 直接继承 HTML。

3. Market 数据空态回退
- 新增：React Query 拉取失败时使用设计稿静态数据回退。
- 文件：`apps/web/src/components/markets/MarketsView.tsx`
- 数值来源：全部数值来自 HTML 文案与卡片内容。
