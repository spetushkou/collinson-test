// The failures a caller can act on, told apart by `code` - the value the API is meant to
// report as `extensions.code`, so a client branches on it rather than on message text.
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
