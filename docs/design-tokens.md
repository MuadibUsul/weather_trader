# Design Tokens

## 来源规则

- HTML 来源：`/design/v3_1/code.html` ... `/design/v3_6/code.html` 中的结构、class、tailwind token。
- PNG 来源：`/design/v3_1..v3_6/screen.png` 的像素对齐与视觉量测。
- 所有新增 token 统一声明在 `/apps/web/src/styles/tokens.css`，并通过 Tailwind `theme.extend` 映射。

## Color

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-color-primary` | `#13ec5b` | HTML (`colors.primary`) |
| `--wt-color-primary-dark` | `#0ea641` | HTML (`colors.primary-dark`) |
| `--wt-color-secondary` | `#238636` | HTML (`colors.secondary`) |
| `--wt-color-bg` | `#0d1117` | HTML (`colors.background-dark`) |
| `--wt-color-surface` | `#161b22` | HTML (`colors.surface-dark`) |
| `--wt-color-surface-2` | `#1c2128` | HTML (`bg-[#1c2128]`) |
| `--wt-color-surface-3` | `#21262d` | HTML (`bg-[#21262d]`) |
| `--wt-color-border` | `#30363d` | HTML (`colors.border-dark`) |
| `--wt-color-text-main` | `#c9d1d9` | HTML (`colors.text-main`) |
| `--wt-color-text-muted` | `#8b949e` | HTML (`colors.text-muted`) |
| `--wt-color-danger` | `#da3633` | HTML (`colors.accent-error`) |
| `--wt-color-warning` | `#d29922` | HTML (`colors.accent-warning`) |
| `--wt-color-info` | `#1f6feb` | HTML (`heat-cold`) |

## Typography

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-font-display` | `Inter, "Noto Sans", sans-serif` | HTML (`fontFamily.display`) |
| `--wt-font-mono` | `ui-monospace, SFMono-Regular, ...` | HTML (`fontFamily.mono`) |
| `--wt-font-table` | `Inter, "Noto Sans", sans-serif` | HTML（表格字体） |

## Radius

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-radius-sm` | `4px` | HTML (`rounded`) |
| `--wt-radius-lg` | `8px` | HTML (`rounded-lg`) |
| `--wt-radius-xl` | `12px` | HTML (`rounded-xl`) |
| `--wt-radius-2xl` | `16px` | HTML (`rounded-2xl`) |

## Shadow

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-shadow-sm/md/lg/xl` | 多层阴影 | HTML (`shadow-sm/lg/xl`) |
| `--wt-shadow-neon` | `0 0 10px rgb(19 236 91 / 0.2)` | HTML 自定义阴影 |

## Spacing (8px System)

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-space-0-5` | `4px` | HTML (`p-1`) |
| `--wt-space-1` | `8px` | HTML (`p-2`) |
| `--wt-space-1-5` | `12px` | HTML (`p-3`) |
| `--wt-space-2` | `16px` | HTML (`p-4`) |
| `--wt-space-2-5` | `20px` | HTML (`p-5`) |
| `--wt-space-3` | `24px` | HTML (`p-6`) |

## Layout Metrics

| Token | Value | 来源 |
| --- | --- | --- |
| `--wt-topbar-h` | `64px` | HTML (`h-16`) + PNG 量测 |
| `--wt-sidebar-w` | `256px` | HTML (`w-64`) + PNG 量测 |
| `--wt-drawer-w` | `320px` | HTML (`w-80`) + PNG 量测 |
| `--wt-modal-w` | `448px` | HTML (`max-w-md`) + PNG 量测 |
| `--wt-pin-cell-w/h` | `40x48px` | HTML (`w-10 h-12`) + PNG 量测 |
