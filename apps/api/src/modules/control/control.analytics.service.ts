import { Injectable } from "@nestjs/common";
import type { Environment, PnlAttributionRowDto } from "@weather-trader/shared";
import { ControlStoreService } from "./control.store";

type GroupBy = "strategy" | "city" | "date";
type Range = "1D" | "7D" | "30D" | "ALL";

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeSinceMs(range: Range): number {
  const now = Date.now();
  if (range === "1D") return now - DAY_MS;
  if (range === "7D") return now - DAY_MS * 7;
  if (range === "30D") return now - DAY_MS * 30;
  return 0;
}

function cityFromMarketId(marketId: string): string {
  const token = marketId.split("_")[0];
  if (!token) return "unknown";
  return token.toUpperCase();
}

function dateBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ControlAnalyticsService {
  constructor(private readonly store: ControlStoreService) {}

  getPnlAttribution(env: Environment, range: Range, groupBy: GroupBy): PnlAttributionRowDto[] {
    const sinceMs = rangeSinceMs(range);
    const orders = this.store.listOrders({ env, sinceMs, limit: 10000 });
    const grouped = new Map<string, typeof orders>();

    for (const order of orders) {
      const key =
        groupBy === "strategy"
          ? order.strategyId ?? "manual"
          : groupBy === "city"
            ? cityFromMarketId(order.marketId)
            : dateBucket(order.createdAt);
      const arr = grouped.get(key) ?? [];
      arr.push(order);
      grouped.set(key, arr);
    }

    const rows: PnlAttributionRowDto[] = [];
    for (const [key, list] of grouped.entries()) {
      const realizedPnl = list.reduce((sum, item) => sum + item.pnl, 0);
      const wins = list.filter((item) => item.pnl > 0).length;
      const losses = list.filter((item) => item.pnl <= 0).length;
      const fees = list.reduce((sum, item) => sum + item.fee, 0);
      const slippageLoss = Number((list.reduce((sum, item) => sum + item.amount * 0.0008, 0)).toFixed(4));
      const fillCount = list.filter((item) => item.status === "filled" || item.status === "partial_filled").length;
      const fillRate = list.length === 0 ? 0 : Number(((fillCount / list.length) * 100).toFixed(4));
      const edgeContribution = Number((list.reduce((sum, item) => sum + item.pnl + item.fee + slippageLoss * 0.3, 0)).toFixed(4));
      const rejectLoss = Number((list.filter((item) => item.status === "rejected").length * 2).toFixed(4));
      rows.push({
        key,
        realizedPnl: Number(realizedPnl.toFixed(4)),
        wins,
        losses,
        winRate: list.length === 0 ? 0 : Number(((wins / list.length) * 100).toFixed(4)),
        fees: Number(fees.toFixed(4)),
        slippageLoss,
        fillRate,
        edgeContribution,
        rejectLoss,
      });
    }

    rows.sort((a, b) => b.realizedPnl - a.realizedPnl);
    return rows;
  }

  reconcileFillsVsPnl(env: Environment, range: Range): {
    fillPnl: number;
    snapshotPnl: number;
    diff: number;
    withinTolerance: boolean;
  } {
    const sinceMs = rangeSinceMs(range);
    const fills = this.store.listFills({ env, sinceMs });
    const orders = this.store.listOrders({ env, sinceMs, limit: 10000 });
    const snapshots = this.store.listPnlSnapshots({ env, strategyId: null, sinceMs });

    const fillPnl = orders.reduce((sum, item) => sum + item.pnl, 0);
    const snapshotPnl = snapshots.reduce((sum, item) => sum + item.realizedPnl, 0);
    const diff = Number((fillPnl - snapshotPnl).toFixed(6));
    const tolerance = Math.max(1, fills.length * 0.01);

    return {
      fillPnl: Number(fillPnl.toFixed(6)),
      snapshotPnl: Number(snapshotPnl.toFixed(6)),
      diff,
      withinTolerance: Math.abs(diff) <= tolerance,
    };
  }
}
