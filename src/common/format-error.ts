import { unwrapResolverError } from '@apollo/server/errors';
import type { GraphQLFormattedError } from 'graphql';
import { AppError } from './errors.js';

// An AppError becomes `extensions.code`, so a client can branch on BAD_USER_INPUT,
// PLACE_NOT_FOUND or UPSTREAM_UNAVAILABLE rather than on message text. Anything else is a bug:
// in production its message and stack stay in the log, not in the response.
export function formatError(
  production: boolean,
): (formatted: GraphQLFormattedError, error: unknown) => GraphQLFormattedError {
  return (formatted, error) => {
    const original = unwrapResolverError(error);
    if (original instanceof AppError) {
      return {
        message: original.message,
        path: formatted.path,
        extensions: { code: original.code },
      };
    }
    if (production && formatted.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      return {
        message: 'Internal server error',
        path: formatted.path,
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      };
    }
    return formatted;
  };
}
