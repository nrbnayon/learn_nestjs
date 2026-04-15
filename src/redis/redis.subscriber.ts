/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type RedisMessageHandler = (channel: string, message: string) => void;

@Injectable()
export class RedisSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriber.name);
  private subscriber: Redis | null = null;
  private disabled = false;
  private readonly handlers = new Map<string, Set<RedisMessageHandler>>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const subscriber = new Redis({
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password') || undefined,
      db: this.configService.get<number>('redis.db', 0),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    subscriber.on('error', (err) => this.logger.error('❌ Redis subscriber error', err));

    try {
      await subscriber.connect();
      this.subscriber = subscriber;
      this.subscriber.on('connect', () => this.logger.log('✅ Redis subscriber connected'));

      this.subscriber.on('message', (channel: string, message: string) => {
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          channelHandlers.forEach((handler) => {
            try {
              handler(channel, message);
            } catch (err) {
              this.logger.error(`Error in handler for channel ${channel}`, err);
            }
          });
        }
      });

      this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        const patternHandlers = this.handlers.get(pattern);
        if (patternHandlers) {
          patternHandlers.forEach((handler) => {
            try {
              handler(channel, message);
            } catch (err) {
              this.logger.error(`Error in pmessage handler for pattern ${pattern}`, err);
            }
          });
        }
      });
    } catch (error) {
      this.disabled = true;
      this.subscriber = null;
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis subscriber disabled: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.logger.log('Redis subscriber disconnected');
    }
  }

  /**
   * Subscribe to a Redis channel and register a handler.
   */
  async subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    if (this.disabled || !this.subscriber) return;
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      this.logger.log(`Subscribed to channel: ${channel}`);
    }
    this.handlers.get(channel)!.add(handler);
  }

  /**
   * Subscribe to a Redis pattern channel.
   */
  async psubscribe(pattern: string, handler: RedisMessageHandler): Promise<void> {
    if (this.disabled || !this.subscriber) return;
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
      await this.subscriber.psubscribe(pattern);
      this.logger.log(`Pattern subscribed: ${pattern}`);
    }
    this.handlers.get(pattern)!.add(handler);
  }

  /**
   * Unsubscribe a specific handler from a channel.
   */
  async unsubscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    if (this.disabled || !this.subscriber) return;
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;

    channelHandlers.delete(handler);
    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
      this.logger.log(`Unsubscribed from channel: ${channel}`);
    }
  }
}
