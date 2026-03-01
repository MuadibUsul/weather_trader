# Design Gaps

以下状态在原始 `design/v3_x/code.html` 中未给出完整交互，已补齐并保持 token 化：

1. `EnvironmentSwitchConfirmModal` 错误态
- 新增：PIN 错误时输入框抖动 + 明确错误文案。
- 文件：`/apps/web/src/components/modal/PinInput.tsx`、`/apps/web/src/components/modal/EnvironmentSwitchConfirmModal.tsx`
- 数值来源：
  - 抖动位移 `4px/2px`（Source: HTML 最小间距粒度 2px/4px）
  - 动画时长 `280ms`（Source: HTML `duration-300` 对齐）

2. 环境切换后端约束（全局模式切换）
- 新增：切换时校验 PIN、确认勾选、目标环境钱包与凭据可用性。
- 文件：`/apps/api/src/modules/system/system.service.ts`
- 数值来源：
  - PIN 长度 `6`（Source: HTML `PinInput` 6 格）

3. 下单后端真实校验
- 新增：下单强制使用后端全局环境，校验钱包连接、凭据健康、余额充足，成交后回写钱包余额。
- 文件：`/apps/api/src/modules/orders/orders.service.ts`
- 数值来源：
  - REAL 手续费率 `0.001`（Source: HTML/业务约定）

4. 钱包/API 凭据独立管理页
- 新增：`/wallet` 与 `/credentials` 页面并接入后端保存。
- 文件：`/apps/web/src/components/settings/WalletManagement.tsx`、`/apps/web/src/components/settings/CredentialManagement.tsx`
- 数值来源：
  - 布局间距 `p-4/gap-4/h-9`（Source: HTML v3_5 结构与 spacing token）

5. 显示修复（控件过大与错位）
- 修复：Toggle 轨道定位错位（补充 `relative`）、按钮尺寸下调、设置页控件紧凑化。
- 文件：`/apps/web/src/components/common/Toggle.tsx`、`/apps/web/src/components/common/Button.tsx`、`/apps/web/src/components/settings/*`
- 数值来源：
  - Toggle `w-9 h-5 / w-11 h-6`（Source: HTML v3_5）
  - Button 高度 `h-7/h-8/h-9`（Source: PNG 量测 + HTML 比例对齐）
