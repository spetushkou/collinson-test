// The failures a caller can act on, carried to the GraphQL response as `extensions.code`.
export type ErrorCode =
  'BAD_USER_INPUT' | 'PLACE_NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
