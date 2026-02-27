import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--wt-color-primary)",
        "primary-dark": "var(--wt-color-primary-dark)",
        secondary: "var(--wt-color-secondary)",
        "background-dark": "var(--wt-color-bg)",
        "surface-dark": "var(--wt-color-surface)",
        "surface-2": "var(--wt-color-surface-2)",
        "surface-3": "var(--wt-color-surface-3)",
        "border-dark": "var(--wt-color-border)",
        "text-main": "var(--wt-color-text-main)",
        "text-muted": "var(--wt-color-text-muted)",
        "accent-error": "var(--wt-color-danger)",
        "accent-warning": "var(--wt-color-warning)",
        success: "var(--wt-color-success)",
        info: "var(--wt-color-info)",
        "heat-hot": "var(--wt-color-heat-hot)",
        "heat-warm": "var(--wt-color-heat-warm)",
        "heat-cool": "var(--wt-color-heat-cool)",
        "heat-cold": "var(--wt-color-heat-cold)",
      },
      fontFamily: {
        display: ["var(--wt-font-display)"],
        mono: ["var(--wt-font-mono)"],
        table: ["var(--wt-font-table)"],
      },
      borderRadius: {
        sm: "var(--wt-radius-sm)",
        DEFAULT: "var(--wt-radius-md)",
        lg: "var(--wt-radius-lg)",
        xl: "var(--wt-radius-xl)",
        "2xl": "var(--wt-radius-2xl)",
      },
      boxShadow: {
        sm: "var(--wt-shadow-sm)",
        md: "var(--wt-shadow-md)",
        lg: "var(--wt-shadow-lg)",
        xl: "var(--wt-shadow-xl)",
        neon: "var(--wt-shadow-neon)",
      },
      spacing: {
        "0.5": "var(--wt-space-0-5)",
        "1": "var(--wt-space-1)",
        "1.5": "var(--wt-space-1-5)",
        "2": "var(--wt-space-2)",
        "2.5": "var(--wt-space-2-5)",
        "3": "var(--wt-space-3)",
        "4": "var(--wt-space-4)",
        "5": "var(--wt-space-5)",
        "6": "var(--wt-space-6)",
        "7": "var(--wt-space-7)",
        "8": "var(--wt-space-8)",
      },
      height: {
        topbar: "var(--wt-topbar-h)",
        "pin-cell": "var(--wt-pin-cell-h)",
      },
      width: {
        sidebar: "var(--wt-sidebar-w)",
        drawer: "var(--wt-drawer-w)",
        modal: "var(--wt-modal-w)",
        "pin-cell": "var(--wt-pin-cell-w)",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-2px)" },
          "80%": { transform: "translateX(2px)" },
        },
      },
      animation: {
        shake: "shake 280ms ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
