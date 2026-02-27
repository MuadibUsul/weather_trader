export type Market = {
  id: string;
  title: string;
  location: string;
  odds: number;
  change24h: number;
  oi: number;
  live: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getMarkets() {
  return request<Market[]>("/markets");
}

export function getOrders() {
  return request("/orders");
}
