import { localWindow } from './window.js';

describe('localWindow', () => {
  const now = new Date('2026-10-19T05:00:00Z');

  it("starts on the place's own today, not the server's", () => {
    // 05:00 UTC is still the 18th in Honolulu (UTC-10) and already the 19th in Auckland.
    expect(localWindow('Pacific/Honolulu', now)[0]).toBe('2026-10-18');
    expect(localWindow('Pacific/Auckland', now)[0]).toBe('2026-10-19');
  });

  it('covers seven consecutive days', () => {
    expect(localWindow('Europe/Paris', now)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('crosses a daylight-saving change and a month end without a gap', () => {
    // Paris leaves summer time on 2026-10-25.
    const days = localWindow('Europe/Paris', new Date('2026-10-28T10:00:00Z'));
    expect(days).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    expect(
      new Set(localWindow('Europe/Paris', new Date('2026-10-22T10:00:00Z')))
        .size,
    ).toBe(7);
  });
});
