export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class PaginationUtil {
  static readonly DEFAULT_PAGE = 1;
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  /**
   * Normalise and validate pagination query params.
   */
  static normalize(options: PaginationOptions): Required<PaginationOptions> {
    const page = Math.max(1, Number(options.page) || this.DEFAULT_PAGE);
    const limit = Math.min(
      this.MAX_LIMIT,
      Math.max(1, Number(options.limit) || this.DEFAULT_LIMIT),
    );
    return { page, limit };
  }

  /**
   * Convert page/limit to Prisma skip/take.
   */
  static toPrisma(options: Required<PaginationOptions>): { skip: number; take: number } {
    return {
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    };
  }

  /**
   * Build a paginated response envelope.
   */
  static paginate<T>(
    data: T[],
    total: number,
    options: Required<PaginationOptions>,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / options.limit);
    return {
      data,
      meta: {
        total,
        page: options.page,
        limit: options.limit,
        totalPages,
        hasNextPage: options.page < totalPages,
        hasPreviousPage: options.page > 1,
      },
    };
  }
}
