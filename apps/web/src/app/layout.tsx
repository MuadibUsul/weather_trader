import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/layout/AppProviders";
import { EnvironmentSwitchConfirmModal } from "@/components/modal/EnvironmentSwitchConfirmModal";

export const metadata: Metadata = {
  title: "WeatherTrader Pro V3",
  description: "High-fidelity weather quant trading system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="bg-background-dark text-text-main font-display antialiased min-h-screen">
        <AppProviders>
          {children}
          <EnvironmentSwitchConfirmModal />
        </AppProviders>
      </body>
    </html>
  );
}

