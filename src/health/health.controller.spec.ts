import { HealthController } from './health.controller.js';
import { HealthResolver } from './health.resolver.js';

describe('health', () => {
  it('reports ok over REST', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });

  it('answers ping over GraphQL', () => {
    expect(new HealthResolver().ping()).toBe('pong');
  });
});
