export interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  statusCode?: number;
  timestamp?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  code: string;
  timestamp?: string;
}

export class ResponseUtil {
  static success<T>(
    data: T,
    message = 'Success',
    statusCode = 200,
  ): SuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      statusCode,
      timestamp: new Date().toISOString(),
    };
  }

  static created<T>(
    data: T,
    message = 'Created successfully',
  ): SuccessResponse<T> {
    return this.success(data, message, 201);
  }

  static noContent(message = 'Operation successful'): SuccessResponse<null> {
    return this.success<null>(null, message, 204);
  }

  static paginated<T>(
    data: T[],
    meta: Record<string, unknown>,
    message = 'Success',
  ): Record<string, unknown> {
    return {
      success: true,
      message,
      data,
      meta,
      statusCode: 200,
      timestamp: new Date().toISOString(),
    };
  }
}
