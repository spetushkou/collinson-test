import type { ArgumentsHost } from '@nestjs/common';
import { AppErrorFilter } from './app-error.filter.js';
import { AppError } from './errors.js';

function host(type: 'graphql' | 'http') {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: unknown) {
      sent.body = body;
      return this;
    },
  };
  const argumentsHost = {
    getType: () => type,
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, sent };
}

describe('AppErrorFilter', () => {
  const error = new AppError('PLACE_NOT_FOUND', 'no place called "x"');

  it('hands the error back to GraphQL to format', () => {
    const { argumentsHost, sent } = host('graphql');
    expect(new AppErrorFilter().catch(error, argumentsHost)).toBe(error);
    expect(sent).toEqual({});
  });

  it('answers a REST request with a status code instead of leaving it hanging', () => {
    const { argumentsHost, sent } = host('http');
    new AppErrorFilter().catch(error, argumentsHost);
    expect(sent).toEqual({
      status: 404,
      body: { code: 'PLACE_NOT_FOUND', message: 'no place called "x"' },
    });
  });
});
