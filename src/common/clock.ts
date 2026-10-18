// The current time as a dependency, so tests can move it: lookups and forecasts expire by age.
export type Clock = () => Date;

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = () => new Date();
