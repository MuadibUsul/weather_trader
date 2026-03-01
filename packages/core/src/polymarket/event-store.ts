import type { ExecutionEvent } from "./types";

export class EventStore {
  private readonly events: ExecutionEvent[] = [];

  append(event: ExecutionEvent): void {
    this.events.unshift(event);
  }

  appendMany(items: ExecutionEvent[]): void {
    for (const item of items) {
      this.append(item);
    }
  }

  list(limit = 500): ExecutionEvent[] {
    return this.events.slice(0, limit);
  }

  replace(items: ExecutionEvent[]): void {
    this.events.splice(0, this.events.length, ...items);
  }

  toJsonl(limit = 5000): string {
    return this.events
      .slice(0, limit)
      .reverse()
      .map((event) => JSON.stringify(event))
      .join("\n");
  }
}
