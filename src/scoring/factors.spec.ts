import { band, codeFactor, formatNumber } from './factors.js';

const bands = [
  { below: 5, points: 0, label: 'no base' },
  { below: 20, points: 10 },
];
const last = { points: 25 };

describe('band', () => {
  it('includes the lower bound of a range and excludes the upper one', () => {
    expect(band('snow base', 4.9, 'cm', bands, last).points).toBe(0);
    expect(band('snow base', 5, 'cm', bands, last).points).toBe(10);
    expect(band('snow base', 19.9, 'cm', bands, last).points).toBe(10);
    expect(band('snow base', 20, 'cm', bands, last).points).toBe(25);
  });

  it('shows the value with its unit, and the label when the range has one', () => {
    expect(band('snow base', 12, 'cm', bands, last)).toEqual({
      name: 'snow base',
      value: '12 cm',
      points: 10,
    });
    expect(band('snow base', 3, 'cm', bands, last).value).toBe(
      '3 cm - no base',
    );
  });

  it('scores a missing value 0 and says so', () => {
    expect(band('snow base', null, 'cm', bands, last)).toEqual({
      name: 'snow base',
      value: 'no data',
      points: 0,
    });
  });
});

describe('codeFactor', () => {
  const cases = [
    { codes: [0, 1, 2], points: 10, label: 'clear' },
    { codes: [45, 48], points: -15, label: 'fog' },
  ];

  it('matches a weather code to its case', () => {
    expect(codeFactor('sky', 45, cases, { points: 0, label: 'cloud' })).toEqual(
      {
        name: 'sky',
        value: 'fog (code 45)',
        points: -15,
      },
    );
  });

  it('falls back for any other code, and says no data for a missing one', () => {
    expect(
      codeFactor('sky', 61, cases, { points: 0, label: 'cloud' }).value,
    ).toBe('cloud (code 61)');
    expect(
      codeFactor('sky', null, cases, { points: 0, label: 'cloud' }),
    ).toEqual({
      name: 'sky',
      value: 'no data',
      points: 0,
    });
  });
});

describe('formatNumber', () => {
  it('keeps one decimal at most and drops a trailing .0', () => {
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(1.25)).toBe('1.3');
    expect(formatNumber(-4.0)).toBe('-4');
  });
});
