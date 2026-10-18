import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('returns the documented defaults for an empty environment', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      nodeEnv: 'development',
      dbUrl: 'file:./data/weather.sqlite',
      forecastTtlMinutes: 60,
      upstreamTimeoutMs: 5000,
      openMeteo: {
        forecastUrl: 'https://api.open-meteo.com',
        marineUrl: 'https://marine-api.open-meteo.com',
        geocodingUrl: 'https://geocoding-api.open-meteo.com',
      },
    });
  });

  it('parses numbers and accepts every NODE_ENV the service knows', () => {
    const config = loadConfig({
      PORT: '4001',
      FORECAST_TTL_MINUTES: '15',
      NODE_ENV: 'production',
    });
    expect(config.port).toBe(4001);
    expect(config.forecastTtlMinutes).toBe(15);
    expect(config.nodeEnv).toBe('production');
    expect(loadConfig({ NODE_ENV: 'test' }).nodeEnv).toBe('test');
  });

  it('drops a trailing slash from the upstream base URLs', () => {
    const config = loadConfig({
      OPEN_METEO_FORECAST_URL: 'http://localhost:9999/',
    });
    expect(config.openMeteo.forecastUrl).toBe('http://localhost:9999');
  });

  it.each([
    ['FORECAST_TTL_MINUTES', 'abc'],
    ['FORECAST_TTL_MINUTES', '0'],
    ['PORT', '-1'],
    ['UPSTREAM_TIMEOUT_MS', '1.5'],
    ['NODE_ENV', 'staging'],
    ['OPEN_METEO_FORECAST_URL', 'not a url'],
    ['DB_URL', ''],
  ])('rejects %s=%s and names the key', (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    expect(() => loadConfig({ [key]: value })).toThrow(key);
  });

  it('reports every bad key in one error', () => {
    let message = '';
    try {
      loadConfig({ PORT: 'x', NODE_ENV: 'staging' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('PORT');
    expect(message).toContain('NODE_ENV');
  });
});
