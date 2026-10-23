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
