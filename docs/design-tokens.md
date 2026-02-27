# Design Tokens

## 鏉ユ簮瑙勫垯

- `HTML` 鏉ユ簮锛歚/design/v3_1/code.html` ... `/design/v3_6/code.html` 涓?`tailwind.config` + class + style銆?- `PNG` 鏉ユ簮锛歚/design/v3_1..v3_6/screen.png` 灏哄閲忔祴涓庡儚绱犲榻愭牎楠屻€?- 鎵€鏈夋柊澧?token 閮藉湪 `/apps/web/src/styles/tokens.css` 涓寜娉ㄩ噴鏍囨敞鏉ユ簮銆?
## Color

| Token | Value | 鏉ユ簮 |
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
| `--wt-color-info` | `#1f6feb` | HTML (`v3_2 heat-cold`) |
| `--wt-color-gray-950` | `#010409` | HTML (`v3_5 bg-[#010409]`) |
| `--wt-color-gray-850` | `#0f1216` | HTML (`v3_3 bg-[#0f1216]`) |

## Typography

| Token | Value | 鏉ユ簮 |
| --- | --- | --- |
| `--wt-font-display` | `Inter, "Noto Sans", sans-serif` | HTML (`fontFamily.display`) |
| `--wt-font-mono` | `ui-monospace, SFMono-Regular, ...` | HTML (`fontFamily.mono`) |
| `--wt-font-table` | `Inter, "Noto Sans", sans-serif` | HTML锛堣〃鏍兼枃鏈瓧浣撶粍鍚堬級 |

## Radius

| Token | Value | 鏉ユ簮 |
| --- | --- | --- |
| `--wt-radius-sm` | `4px` | HTML (`rounded`) |
| `--wt-radius-lg` | `8px` | HTML (`rounded-lg`) |
| `--wt-radius-xl` | `12px` | HTML (`rounded-xl`) |
| `--wt-radius-2xl` | `16px` | HTML (`rounded-2xl`, `h-16` modal) |

## Shadow

| Token | Value | 鏉ユ簮 |
| --- | --- | --- |
| `--wt-shadow-sm/md/lg/xl` | 鍚勫眰绾ч槾褰?| HTML (`shadow-sm/lg/xl`) |
| `--wt-shadow-neon` | `0 0 10px rgb(19 236 91 / 0.2)` | HTML (`shadow-[0_0_10px_rgba(19,236,91,0.2)]`) |

## Spacing (8px System)

| Token | Value | 鏉ユ簮 |
| --- | --- | --- |
| `--wt-space-0-5` | `4px` | HTML (`p-1`) |
| `--wt-space-1` | `8px` | HTML (`p-2`) |
| `--wt-space-1-5` | `12px` | HTML (`p-3`) |
| `--wt-space-2` | `16px` | HTML (`p-4`) |
| `--wt-space-2-5` | `20px` | HTML (`p-5`) |
| `--wt-space-3` | `24px` | HTML (`p-6`) |
| `--wt-space-8` | `64px` | HTML (`h-16`, top bar) |

## Layout Metrics

| Token | Value | 鏉ユ簮 |
| --- | --- | --- |
| `--wt-topbar-h` | `64px` | HTML (`h-16`) + PNG 瀵归綈 |
| `--wt-sidebar-w` | `256px` | HTML (`w-64`) + PNG 瀵归綈 |
| `--wt-drawer-w` | `320px` | HTML (`w-80`) + PNG 瀵归綈 |
| `--wt-modal-w` | `448px` | HTML (`max-w-md`) + PNG 瀵归綈 |
| `--wt-pin-cell-w/h` | `40x48px` | HTML (`w-10 h-12`) + PNG 瀵归綈 |

