import { HealthController } from './health.controller.js';

describe('health', () => {
  it('reports ok over REST', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
