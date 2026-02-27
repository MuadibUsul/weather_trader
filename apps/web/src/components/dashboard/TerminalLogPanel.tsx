import { TerminalLog } from "@/components/common/TerminalLog";

const lines = [
  { time: "10:42:05", text: "Order #8829 filled. Execution time: 12ms." },
  { time: "10:42:04", text: "Risk check passed (Limit: 5000/10000).", tone: "success" as const },
  { time: "10:42:04", text: "Submitting BUY order for NYC_GT_85..." },
  {
    time: "10:41:55",
    text: "Warning: Volatility spike detected in NYC bucket.",
    tone: "warning" as const,
  },
  { time: "10:40:00", text: "Oracle update received. Block 1928374." },
];

export function TerminalLogPanel() {
  return <TerminalLog lines={lines} className="h-full" />;
}
