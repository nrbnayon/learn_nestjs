import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message ?? message;
        errors = Array.isArray(resp.message) ? resp.message : undefined;
        if (errors) message = 'Validation failed';
        code = resp.error ?? this.getErrorCode(status);
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      const prismaError = exception;
      status = HttpStatus.BAD_REQUEST;
      code = `PRISMA_${prismaError.code}`;

      switch (prismaError.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = `A record with this ${(prismaError.meta?.target as string[])?.join(', ')} already exists`;
          code = 'DUPLICATE_ENTRY';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = 'NOT_FOUND';
          break;
        case 'P2003':
          message = 'Foreign key constraint failed';
          code = 'FK_CONSTRAINT';
          break;
        default:
          message = 'Database operation failed';
      }
    } else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      code = 'VALIDATION_ERROR';
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const responseBody: Record<string, any> = {
      success: false,
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    if (errors) {
      responseBody.errors = errors;
    }

    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      responseBody.stack = exception.stack;
    }

    this.logger.warn(
      `[${request.method}] ${request.url} → ${status} | ${message}`,
    );

    response.status(status).json(responseBody);
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codeMap[status] ?? 'INTERNAL_ERROR';
  }
}
