import type { Market } from "@/lib/api";
import { MarketCard } from "./MarketCard";

export function MarketGrid({
  markets,
  onPick,
}: {
  markets: Market[];
  onPick?: (marketId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2 lg:grid-cols-3">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} onPick={onPick} />
      ))}
    </div>
  );
}
