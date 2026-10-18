import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import type { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import type { Response } from 'express';
import { AppError, ErrorCode } from './errors.js';

const HTTP_STATUS: Record<ErrorCode, HttpStatus> = {
  BAD_USER_INPUT: HttpStatus.BAD_REQUEST,
  PLACE_NOT_FOUND: HttpStatus.NOT_FOUND,
  UPSTREAM_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

// An AppError is an answer, not a fault: the caller asked for a place that does not exist,
// or the weather source is down. In GraphQL, returning it hands it to formatError (which
// turns it into extensions.code) without Nest logging it as an unhandled exception. A REST
// route gets a status code instead - returning there would leave the request hanging.
@Catch(AppError)
export class AppErrorFilter implements GqlExceptionFilter {
  catch(error: AppError, host: ArgumentsHost): AppError | void {
    if (host.getType<GqlContextType>() === 'graphql') return error;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HTTP_STATUS[error.code])
      .json({ code: error.code, message: error.message });
  }
}
