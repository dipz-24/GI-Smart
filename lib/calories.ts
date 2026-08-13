export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateDailyCalories(profile: {
  weight: number;
  height: number;
  age: number;
  activity: string;
  goal?: string;
  targetWeight?: number | null;
  weeks?: number | null;
}) {
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  const maintenance = Math.round(bmr * (ACTIVITY_MULTIPLIERS[profile.activity] ?? 1.55));

  if (
    profile.goal === "Weight Loss" &&
    profile.targetWeight &&
    profile.targetWeight < profile.weight &&
    profile.weeks &&
    profile.weeks > 0
  ) {
    const requestedDeficit =
      ((profile.weight - profile.targetWeight) * 7700) / (profile.weeks * 7);
    const safeDeficit = Math.min(1000, Math.max(0, requestedDeficit));
    return Math.max(1200, Math.round(maintenance - safeDeficit));
  }

  return maintenance;
}

export function calculateDailyWater(weight: number, activity: string) {
  const activityLitres: Record<string, number> = {
    sedentary: 0,
    light: 0.2,
    moderate: 0.35,
    active: 0.5,
    very_active: 0.7,
  };
  const litres = weight * 0.03 + (activityLitres[activity] ?? 0.35);
  return Math.round(Math.max(1.5, Math.min(4, litres)) * 10) / 10;
}
