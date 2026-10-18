import { scoreIndoorDay } from './indoor.js';
import { scoreOutdoorDay } from './outdoor.js';
import { scoreSkiingDay, skiingApplicability } from './skiing.js';
import { scoreSurfingDay, surfingApplicability } from './surfing.js';
import type { Activity, Applicability, DayInput, Factor } from './types.js';

export { scoreIndoorDay } from './indoor.js';
export { scoreOutdoorDay } from './outdoor.js';
export { scoreSkiingDay, skiingApplicability } from './skiing.js';
export { scoreSurfingDay, surfingApplicability } from './surfing.js';

const always = (): Applicability => ({ applicable: true });

export interface ActivityRules {
  activity: Activity;
  scoreDay: (day: DayInput) => Factor[];
  applicability: (days: DayInput[], marineFetched: boolean) => Applicability;
}

// In the order the API returns them. Scores are comparable within an activity, not across:
// indoor starts from a baseline of 50, surfing tops out at 90.
export const ACTIVITIES: readonly ActivityRules[] = [
  {
    activity: 'SKIING',
    scoreDay: scoreSkiingDay,
    applicability: skiingApplicability,
  },
  {
    activity: 'SURFING',
    scoreDay: scoreSurfingDay,
    applicability: surfingApplicability,
  },
  {
    activity: 'OUTDOOR_SIGHTSEEING',
    scoreDay: scoreOutdoorDay,
    applicability: always,
  },
  {
    activity: 'INDOOR_SIGHTSEEING',
    scoreDay: scoreIndoorDay,
    applicability: always,
  },
];
