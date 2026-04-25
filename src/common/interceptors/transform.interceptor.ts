import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data: unknown) => {
        // If data is already in our envelope format skip wrapping
        if (this.isEnvelope(data)) {
          return data;
        }

        const message = this.getMessage(data);
        const payload = this.getPayload(data);

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: payload ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isEnvelope(value: unknown): value is ApiResponse<T> {
    return Boolean(value) && typeof value === 'object' && 'success' in value;
  }

  private getMessage(value: unknown): string {
    if (value && typeof value === 'object' && 'message' in value) {
      const message = (value as { message?: unknown }).message;
      return typeof message === 'string' ? message : 'Success';
    }

    return 'Success';
  }

  private getPayload(value: unknown): T | null {
    if (value && typeof value === 'object' && 'data' in value) {
      return (value as { data?: T }).data ?? null;
    }

    return (value as T) ?? null;
  }
}
