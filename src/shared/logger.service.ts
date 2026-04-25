import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get('app.nodeEnv') !== 'production';
  }

  private formatMessage(level: string, message: any, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    return `${timestamp} [${level.toUpperCase()}] ${ctx} ${message}`;
  }

  log(message: any, context?: string): void {
    console.log(this.formatMessage('log', message, context));
  }

  error(message: any, trace?: string, context?: string): void {
    console.error(this.formatMessage('error', message, context));
    if (trace && this.isDevelopment) {
      console.error(trace);
    }
  }

  warn(message: any, context?: string): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug(message: any, context?: string): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose(message: any, context?: string): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('verbose', message, context));
    }
  }

  // ── Contextual helpers ────────────────────────────────────────────────────

  http(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
  ): void {
    const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    this.log(`${emoji} ${method} ${url} ${statusCode} ${duration}ms`, 'HTTP');
  }

  ws(event: string, userId: string, extra?: string): void {
    this.debug(
      `[WS] ${event} | user:${userId}${extra ? ' | ' + extra : ''}`,
      'WebSocket',
    );
  }
}
