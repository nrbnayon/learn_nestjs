import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, originalUrl, ip } = request;
    const userAgent = request.headers?.['user-agent'] ?? '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${originalUrl} ${statusCode} ${duration}ms — ${ip} "${userAgent}"`,
          );
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.error(
            `${method} ${originalUrl} ERROR ${duration}ms — ${message}`,
          );
        },
      }),
    );
  }
}
