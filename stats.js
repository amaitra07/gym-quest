import { daysAgoIso } from "./dates.js";

const LEVEL_TITLES = [
  [1, "Fresh Start"],
  [4, "Iron Regular"],
  [8, "Gym Veteran"],
  [12, "Discipline Forged"],
  [16, "Peak Chaser"],
  [20, "Living Legend"],
];

const XP_PER_STRENGTH_SET = 8;
const XP_PER_TIMED_SET = 6;
const XP_PER_CARDIO_MINUTE = 1;

// XP comes from the work actually logged: strength and timed sets earn a fixed
// amount each, and cardio earns per minute.
export function computeXp(workout) {
  let xp = 0;
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (exercise.type === "strength") xp += XP_PER_STRENGTH_SET;
      else if (exercise.type === "timed") xp += XP_PER_TIMED_SET;
      else xp += Math.round(set.minutes) * XP_PER_CARDIO_MINUTE;
    }
  }
  return xp;
}

export function totalXp(workouts) {
  return workouts.reduce((sum, workout) => sum + (workout.xp || 0), 0);
}

function xpForLevelStep(level) {
  return 100 + (level - 1) * 20;
}

export function levelInfo(xp) {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevelStep(level)) {
    remaining -= xpForLevelStep(level);
    level += 1;
  }
  return { level, into: remaining, needed: xpForLevelStep(level) };
}

export function titleForLevel(level) {
  return LEVEL_TITLES.filter(([minLevel]) => level >= minLevel).at(-1)[1];
}

// A streak counts consecutive days with a workout, ending today or yesterday,
// so it is not lost until a full day has been missed.
export function currentStreak(workouts) {
  const days = new Set(workouts.map((workout) => workout.date));
  let offset = days.has(daysAgoIso(0)) ? 0 : 1;
  let streak = 0;
  while (days.has(daysAgoIso(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}
