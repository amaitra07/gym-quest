import { addDays, weekdayOf } from "./dates.js";

// What to suggest doing next, and roughly how long a workout takes.

const SECONDS_PER_SET = 45;
const SECONDS_BETWEEN_EXERCISES = 60;
const ROUND_TO_MINUTES = 5;
const MINIMUM_MINUTES = 5;

const normalize = (name) => (name ?? "").trim().toLowerCase();

// A rough length: about 45 seconds of work per strength set, the rest time between sets,
// and a minute to move between exercises, rounded to the nearest 5 minutes.
export function estimateMinutes(workout) {
  let seconds = 0;
  for (const exercise of workout.exercises) {
    const restGaps = Math.max(exercise.sets.length - 1, 0) * (exercise.restSeconds ?? 0);
    if (exercise.type === "cardio") {
      seconds += exercise.sets.reduce((sum, set) => sum + (set.minutes ?? 0) * 60, 0);
    } else if (exercise.type === "timed") {
      seconds += exercise.sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0) + restGaps;
    } else {
      seconds += exercise.sets.length * SECONDS_PER_SET + restGaps;
    }
  }
  seconds += Math.max(workout.exercises.length - 1, 0) * SECONDS_BETWEEN_EXERCISES;
  const rounded = Math.round(seconds / 60 / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
  return Math.max(MINIMUM_MINUTES, rounded);
}

// The saved workout after the one you did most recently, in list order, wrapping around
// (Push, Pull, Legs, Push...). Starts with the first one if none has been logged yet.
export function nextRoutine(routines, workouts) {
  if (routines.length === 0) return null;
  const names = routines.map((routine) => normalize(routine.name));
  const newestFirst = [...workouts].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
  const latest = newestFirst.find((workout) => names.includes(normalize(workout.name)));
  if (!latest) return routines[0];
  return routines[(names.indexOf(normalize(latest.name)) + 1) % routines.length];
}

const DAYS_IN_WEEK = 7;

// The seven days of the week containing `today` (an ISO date), Sunday first. `weekday` is
// 0 for Sunday, the same number the weekly schedule uses as its key.
export function weekOf(today) {
  const sunday = addDays(today, -weekdayOf(today));
  return Array.from({ length: DAYS_IN_WEEK }, (_, weekday) => {
    const iso = addDays(sunday, weekday);
    return { iso, weekday, isToday: iso === today };
  });
}

// What to do next and when. `schedule` maps a weekday number to a saved workout's id.
// With a schedule: today's workout until you have trained today, then the next scheduled
// day (up to a week ahead). Without one: the rotation in nextRoutine. `daysAhead` is 0 for
// today, 1 for tomorrow and so on, or null when there is no schedule.
export function upNext(routines, schedule, workouts, today) {
  const scheduledOn = (isoDate) => routines.find((routine) => routine.id === schedule[weekdayOf(isoDate)]) ?? null;
  const hasSchedule = Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    routines.some((routine) => routine.id === schedule[day])).some(Boolean);
  if (!hasSchedule) {
    const routine = nextRoutine(routines, workouts);
    return routine === null ? null : { routine, daysAhead: null };
  }
  const trainedToday = workouts.some((workout) => workout.date === today);
  for (let daysAhead = trainedToday ? 1 : 0; daysAhead <= DAYS_IN_WEEK; daysAhead += 1) {
    const routine = scheduledOn(addDays(today, daysAhead));
    if (routine !== null) return { routine, daysAhead };
  }
  return null;
}
