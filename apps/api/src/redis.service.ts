import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.redis.on("error", (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSec = 15): Promise<void> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSec);
    } catch {
      // ignore cache failures
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // noop
    }
  }
}
