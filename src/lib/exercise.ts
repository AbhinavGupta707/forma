// MET values from the 2024 Adult Compendium of Physical Activities (typical intensities).

export interface Activity {
  key: string;
  label: string;
  met: number;
}

export const ACTIVITIES: readonly Activity[] = [
  { key: "walking", label: "Walking (moderate pace)", met: 3.5 },
  { key: "brisk_walking", label: "Walking (brisk)", met: 4.3 },
  { key: "hiking", label: "Hiking", met: 6.0 },
  { key: "running", label: "Running (~10 km/h)", met: 9.8 },
  { key: "jogging", label: "Jogging", met: 7.0 },
  { key: "sprinting", label: "Running (fast, ~14 km/h)", met: 12.8 },
  { key: "cycling", label: "Cycling (moderate)", met: 7.5 },
  { key: "cycling_easy", label: "Cycling (leisure)", met: 4.0 },
  { key: "stationary_bike", label: "Stationary bike", met: 6.8 },
  { key: "weightlifting", label: "Weight training", met: 5.0 },
  { key: "weightlifting_vigorous", label: "Weight training (vigorous)", met: 6.0 },
  { key: "hiit", label: "HIIT / circuit training", met: 8.0 },
  { key: "swimming", label: "Swimming (moderate)", met: 7.0 },
  { key: "rowing", label: "Rowing machine", met: 7.0 },
  { key: "elliptical", label: "Elliptical", met: 5.0 },
  { key: "stairs", label: "Stair climbing", met: 9.0 },
  { key: "yoga", label: "Yoga", met: 2.5 },
  { key: "pilates", label: "Pilates", met: 3.0 },
  { key: "dancing", label: "Dancing", met: 5.0 },
  { key: "basketball", label: "Basketball", met: 6.5 },
  { key: "soccer", label: "Soccer / football", met: 7.0 },
  { key: "tennis", label: "Tennis", met: 7.3 },
  { key: "badminton", label: "Badminton", met: 5.5 },
  { key: "cricket", label: "Cricket", met: 4.8 },
  { key: "boxing", label: "Boxing (bag)", met: 7.8 },
  { key: "jump_rope", label: "Jump rope", met: 11.0 },
];

const DEFAULT_MET = 4;

export function findActivity(key: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.key === key);
}

/** Gross calories burned: MET × body weight (kg) × duration (h). */
export function exerciseKcal(activityKey: string, minutes: number, weightKg: number): number {
  const met = findActivity(activityKey)?.met ?? DEFAULT_MET;
  return Math.round(met * weightKg * (minutes / 60));
}
