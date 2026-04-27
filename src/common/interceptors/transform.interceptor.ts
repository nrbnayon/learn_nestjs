import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  meta?: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    const status = response.statusCode;

    // Get message from decorator if present
    const decoratorMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data: unknown) => {
        // If data is already in our envelope format skip wrapping
        if (this.isEnvelope(data)) {
          return data;
        }

        let finalMessage = decoratorMessage || 'Success';
        let finalData = data;
        let finalMeta: unknown = undefined;

        // If the return value has a 'message', 'data', or 'meta' property, we extract them
        if (
          data &&
          typeof data === 'object' &&
          ('message' in data || 'data' in data || 'meta' in data)
        ) {
          const obj = data as {
            message?: string;
            data?: unknown;
            meta?: unknown;
          };
          if (obj.message) {
            finalMessage = obj.message;
          }
          // If 'data' property exists, use it as finalData, otherwise use the whole object
          finalData = 'data' in obj ? obj.data : data;
          finalMeta = obj.meta;
        }

        const result: ApiResponse<T> = {
          success: true,
          statusCode: status,
          message: finalMessage,
          data: (finalData as T) ?? (null as T),
          timestamp: new Date().toISOString(),
        };

        if (finalMeta) {
          result.meta = finalMeta;
        }

        return result;
      }),
    );
  }

  private isEnvelope(value: unknown): value is ApiResponse<T> {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      'success' in value &&
      'statusCode' in value &&
      'message' in value
    );
  }
}
