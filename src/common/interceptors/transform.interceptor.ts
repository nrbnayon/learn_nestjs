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
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // If data is already in our envelope format skip wrapping
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        const message =
          (data && typeof data === 'object' && data?.message) || 'Success';
        const payload =
          data && typeof data === 'object' && 'data' in data ? data.data : data;

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
}
