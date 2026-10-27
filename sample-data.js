import { addDays, weekdayOf } from "./dates.js";
import { computeXp } from "./stats.js";

// Sample Push / Pull / Legs data for trying the app out: three saved workouts, a weekly
// plan, and four weeks of logged sessions whose weights creep upward so Progress, records
// and the calendar have something to show. Weights are in pounds, the app's default unit.

const HISTORY_DAYS = 28;
const DAYS_PER_WEEK = 7;

// Monday to Saturday rotate Push, Pull, Legs twice; Sunday is a rest day.
const WEEKDAY_ROUTINE_KEYS = { 1: "push", 2: "pull", 3: "legs", 4: "push", 5: "pull", 6: "legs" };

const strength = (name, sets, reps, weight, step) => ({ name, type: "strength", restSeconds: 90, sets, reps, weight, step });

const ROUTINE_TEMPLATES = [
  {
    key: "push",
    name: "Push day",
    exercises: [
      strength("Bench Press", 4, 8, 135, 5),
      strength("Overhead Press", 3, 8, 85, 5),
      strength("Incline Dumbbell Press", 3, 10, 50, 2.5),
      strength("Lateral Raise", 3, 12, 15, 2.5),
      strength("Tricep Pushdown", 3, 12, 40, 2.5),
    ],
  },
  {
    key: "pull",
    name: "Pull day",
    exercises: [
      strength("Barbell Row", 4, 8, 115, 5),
      strength("Lat Pulldown", 3, 10, 100, 5),
      strength("Seated Cable Row", 3, 10, 90, 5),
      strength("Face Pull", 3, 15, 35, 2.5),
      strength("Bicep Curl", 3, 12, 25, 2.5),
      { name: "Rowing", type: "cardio", restSeconds: 0, sets: 1, minutes: 10, distance: 2 },
    ],
  },
  {
    key: "legs",
    name: "Leg day",
    exercises: [
      strength("Squat", 4, 6, 185, 10),
      strength("Romanian Deadlift", 3, 8, 155, 5),
      strength("Leg Press", 3, 10, 270, 10),
      strength("Leg Curl", 3, 12, 70, 5),
      strength("Calf Raise", 4, 15, 100, 5),
      { name: "Plank", type: "timed", restSeconds: 60, sets: 3, seconds: 60 },
    ],
  },
];

// `weeksAhead` is how many weeks of progress to add on top of the starting weight.
function buildSets(template, weeksAhead) {
  return Array.from({ length: template.sets }, () => {
    if (template.type === "cardio") return { minutes: template.minutes, distance: template.distance };
    if (template.type === "timed") return { seconds: template.seconds + 5 * weeksAhead };
    return { weight: template.weight + template.step * weeksAhead, reps: template.reps };
  });
}

function buildExercises(routineKey, idPrefix, weeksAhead) {
  const routine = ROUTINE_TEMPLATES.find((item) => item.key === routineKey);
  return routine.exercises.map((template, index) => ({
    id: `${idPrefix}-${index}`,
    name: template.name,
    type: template.type,
    restSeconds: template.restSeconds,
    sets: buildSets(template, weeksAhead),
  }));
}

// Everything the sample load writes: { routines, schedule, workouts }. History covers the
// four weeks before `today` (today itself is left open so "Up next" has a workout to offer).
export function buildSampleData(today) {
  const routines = ROUTINE_TEMPLATES.map(({ key, name }) => ({
    id: `sample-${key}`,
    name,
    exercises: buildExercises(key, `sample-${key}`, 0),
  }));

  const schedule = Object.fromEntries(
    Object.entries(WEEKDAY_ROUTINE_KEYS).map(([weekday, key]) => [weekday, `sample-${key}`]),
  );

  const workouts = [];
  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
    const date = addDays(today, -daysAgo);
    const key = WEEKDAY_ROUTINE_KEYS[weekdayOf(date)];
    if (!key) continue;
    const weeksAhead = Math.floor((HISTORY_DAYS - daysAgo) / DAYS_PER_WEEK);
    const [year, month, day] = date.split("-").map(Number);
    const workout = {
      id: `sample-${key}-${date}`,
      createdAt: new Date(year, month - 1, day, 18).getTime(),
      name: ROUTINE_TEMPLATES.find((item) => item.key === key).name,
      date,
      exercises: buildExercises(key, `sample-${key}-${date}`, weeksAhead),
    };
    workouts.push({ ...workout, xp: computeXp(workout) });
  }
  return { routines, schedule, workouts };
}
