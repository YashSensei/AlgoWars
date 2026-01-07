// Valid HTTP status codes for Hono's ContentfulStatusCode type
type HttpStatusCode = 400 | 401 | 403 | 404 | 409 | 500;

export class AppError extends Error {
  public statusCode: HttpStatusCode;
  public code?: string;

  constructor(message: string, statusCode: HttpStatusCode = 500, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  NotFound: (resource = "Resource") => new AppError(`${resource} not found`, 404, "NOT_FOUND"),
  Unauthorized: (msg = "Unauthorized") => new AppError(msg, 401, "UNAUTHORIZED"),
  Forbidden: (msg = "Forbidden") => new AppError(msg, 403, "FORBIDDEN"),
  BadRequest: (msg: string) => new AppError(msg, 400, "BAD_REQUEST"),
  Conflict: (msg: string) => new AppError(msg, 409, "CONFLICT"),
} as const;
