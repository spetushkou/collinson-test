export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  dbUrl: string;
  forecastTtlMinutes: number;
  upstreamTimeoutMs: number;
  openMeteo: { forecastUrl: string; marineUrl: string; geocodingUrl: string };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Invalid configuration:\n  ${problems.join('\n  ')}`);
    this.name = 'ConfigError';
  }
}

const NODE_ENVS = ['development', 'production', 'test'] as const;

// Reads the environment once at boot. Every problem is collected before throwing, so a
// misconfigured start names all of its bad keys at once rather than one per restart.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const positiveInt = (key: string, fallback: number, max: number): number => {
    const raw = env[key];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0 || value > max) {
      problems.push(`${key} must be an integer from 1 to ${max}, got "${raw}"`);
      return fallback;
    }
    return value;
  };

  const baseUrl = (key: string, fallback: string): string => {
    const raw = env[key] ?? fallback;
    // `new URL` alone accepts any "scheme:rest" string, so "localhost:9999" would pass with
    // "localhost:" as its scheme and fail only at the first upstream call.
    let usable = false;
    try {
      const url = new URL(raw);
      usable = ['http:', 'https:'].includes(url.protocol) && url.host !== '';
    } catch {
      usable = false;
    }
    if (!usable) problems.push(`${key} must be an http(s) URL, got "${raw}"`);
    return raw.replace(/\/+$/, '');
  };

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    problems.push(
      `NODE_ENV must be one of ${NODE_ENVS.join(', ')}, got "${nodeEnv}"`,
    );
  }

  const dbUrl = env.DB_URL ?? 'file:./data/weather.sqlite';
  if (dbUrl.trim() === '') problems.push('DB_URL must not be empty');

  const config: AppConfig = {
    port: positiveInt('PORT', 4000, 65535),
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    dbUrl,
    forecastTtlMinutes: positiveInt('FORECAST_TTL_MINUTES', 60, 7 * 24 * 60),
    // setTimeout overflows above 2^31-1 ms and fires at once; a minute is already generous.
    upstreamTimeoutMs: positiveInt('UPSTREAM_TIMEOUT_MS', 5000, 60_000),
    openMeteo: {
      forecastUrl: baseUrl(
        'OPEN_METEO_FORECAST_URL',
        'https://api.open-meteo.com',
      ),
      marineUrl: baseUrl(
        'OPEN_METEO_MARINE_URL',
        'https://marine-api.open-meteo.com',
      ),
      geocodingUrl: baseUrl(
        'OPEN_METEO_GEOCODING_URL',
        'https://geocoding-api.open-meteo.com',
      ),
    },
  };

  if (problems.length) throw new ConfigError(problems);
  return config;
}
