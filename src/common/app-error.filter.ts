import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { AppError } from './errors.js';

// An AppError is an answer, not a fault: the caller asked for a place that does not exist,
// or the weather source is down. Returning it hands it to GraphQL (formatError turns it into
// extensions.code) without Nest logging it as an unhandled exception with a stack trace.
@Catch(AppError)
export class AppErrorFilter implements GqlExceptionFilter {
  catch(error: AppError): AppError {
    return error;
  }
}
