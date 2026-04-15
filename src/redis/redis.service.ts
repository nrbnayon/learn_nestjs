/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryStore = new Map<string, string>();
  private useMemoryFallback = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const client = new Redis({
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password') || undefined,
      db: this.configService.get<number>('redis.db', 0),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    client.on('error', (err) => this.logger.error('❌ Redis error', err));

    try {
      await client.connect();
      this.client = client;
      this.client.on('connect', () => this.logger.log('✅ Redis connected'));
      this.client.on('ready', () => this.logger.log('✅ Redis ready'));
      this.client.on('close', () => this.logger.warn('Redis connection closed'));
      this.logger.log('Redis client initialized');
    } catch (error) {
      this.useMemoryFallback = true;
      this.client = null;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis unavailable, using in-memory fallback: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  // ── Key/Value Operations ──────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    if (this.useMemoryFallback || !this.client) {
      return this.memoryStore.get(key) ?? null;
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      this.memoryStore.set(key, value);
      return;
    }
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    if (this.useMemoryFallback || !this.client) {
      return this.memoryStore.delete(key) ? 1 : 0;
    }
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.useMemoryFallback || !this.client) {
      return this.memoryStore.has(key);
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      return;
    }
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemoryFallback || !this.client) {
      return -1;
    }
    return this.client.ttl(key);
  }

  // ── JSON helpers ─────────────────────────────────────────────────────────

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ── Hash Operations ───────────────────────────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      this.memoryStore.set(`${key}:${field}`, value);
      return;
    }
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (this.useMemoryFallback || !this.client) {
      return this.memoryStore.get(`${key}:${field}`) ?? null;
    }
    return this.client.hget(key, field);
  }

  async hdel(key: string, field: string): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      this.memoryStore.delete(`${key}:${field}`);
      return;
    }
    await this.client.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.useMemoryFallback || !this.client) {
      const result: Record<string, string> = {};
      for (const [storedKey, storedValue] of this.memoryStore.entries()) {
        if (storedKey.startsWith(`${key}:`)) {
          result[storedKey.slice(key.length + 1)] = storedValue;
        }
      }
      return result;
    }
    return this.client.hgetall(key);
  }

  // ── Set Operations ────────────────────────────────────────────────────────

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      this.memoryStore.set(key, JSON.stringify(members));
      return;
    }
    await this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      const existing = JSON.parse(this.memoryStore.get(key) ?? '[]') as string[];
      this.memoryStore.set(key, JSON.stringify(existing.filter((member) => !members.includes(member))));
      return;
    }
    await this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (this.useMemoryFallback || !this.client) {
      return JSON.parse(this.memoryStore.get(key) ?? '[]') as string[];
    }
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (this.useMemoryFallback || !this.client) {
      return (JSON.parse(this.memoryStore.get(key) ?? '[]') as string[]).includes(member);
    }
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  // ── Pub/Sub Helpers ───────────────────────────────────────────────────────

  async publish(channel: string, message: string): Promise<void> {
    if (this.useMemoryFallback || !this.client) {
      this.logger.debug(`Redis publish skipped in fallback mode: ${channel}`);
      return;
    }
    await this.client.publish(channel, message);
  }

  async publishJson<T>(channel: string, data: T): Promise<void> {
    await this.publish(channel, JSON.stringify(data));
  }

  // ── Pattern Keys ──────────────────────────────────────────────────────────

  async keys(pattern: string): Promise<string[]> {
    if (this.useMemoryFallback || !this.client) {
      const prefix = pattern.replace(/\*/g, '');
      return [...this.memoryStore.keys()].filter((key) => key.startsWith(prefix));
    }
    return this.client.keys(pattern);
  }

  async flushPrefix(prefix: string): Promise<void> {
    const keys = await this.keys(`${prefix}*`);
    if (keys.length) {
      if (this.useMemoryFallback || !this.client) {
        keys.forEach((key) => this.memoryStore.delete(key));
        return;
      }
      await this.client.del(...keys);
    }
  }

  // ── Increment ─────────────────────────────────────────────────────────────

  async incr(key: string): Promise<number> {
    if (this.useMemoryFallback || !this.client) {
      const nextValue = Number(this.memoryStore.get(key) ?? '0') + 1;
      this.memoryStore.set(key, String(nextValue));
      return nextValue;
    }
    return this.client.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (this.useMemoryFallback || !this.client) {
      const nextValue = Number(this.memoryStore.get(key) ?? '0') + increment;
      this.memoryStore.set(key, String(nextValue));
      return nextValue;
    }
    return this.client.incrby(key, increment);
  }
}
