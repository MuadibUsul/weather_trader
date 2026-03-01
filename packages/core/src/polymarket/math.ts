export type DecimalConfig = {
  priceDp: number;
  qtyDp: number;
  cashDp: number;
};

export const DEFAULT_DECIMALS: DecimalConfig = {
  priceDp: 4,
  qtyDp: 4,
  cashDp: 4,
};

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
