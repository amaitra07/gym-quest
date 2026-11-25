// Which muscles each built-in exercise trains, and how many sets each muscle got lately, for
// the muscle map on Progress. An exercise's main muscles count a full set each; the muscles
// that help count half, the usual way coaches tally weekly sets.

import { addDays } from "./dates.js";

export const MUSCLES = [
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "traps", label: "Traps" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "forearms", label: "Forearms" },
  { key: "back", label: "Lats and upper back" },
  { key: "lowerBack", label: "Lower back" },
  { key: "abs", label: "Abs" },
  { key: "obliques", label: "Obliques" },
  { key: "glutes", label: "Glutes" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "calves", label: "Calves" },
];

// [main muscles, helper muscles] for each built-in exercise.
const EXERCISE_MUSCLES = {
  "Bench Press": [["chest"], ["triceps", "shoulders"]],
  "Incline Dumbbell Press": [["chest"], ["shoulders", "triceps"]],
  "Dips": [["chest", "triceps"], ["shoulders"]],
  "Dumbbell Fly": [["chest"], ["shoulders"]],
  "Push-up": [["chest"], ["triceps", "shoulders", "abs"]],
  "Overhead Press": [["shoulders"], ["triceps", "traps"]],
  "Dumbbell Shoulder Press": [["shoulders"], ["triceps"]],
  "Lateral Raise": [["shoulders"], []],
  "Face Pull": [["shoulders"], ["back", "traps"]],
  "Tricep Pushdown": [["triceps"], []],
  "Overhead Tricep Extension": [["triceps"], []],
  "Skull Crusher": [["triceps"], []],
  "Deadlift": [["glutes", "hamstrings", "lowerBack"], ["back", "traps", "quads", "forearms"]],
  "Barbell Row": [["back"], ["biceps", "traps", "lowerBack"]],
  "Dumbbell Row": [["back"], ["biceps", "traps"]],
  "Seated Cable Row": [["back"], ["biceps", "traps"]],
  "Lat Pulldown": [["back"], ["biceps", "forearms"]],
  "Pull-up": [["back"], ["biceps", "forearms"]],
  "Superman": [["lowerBack"], ["glutes"]],
  "Bicep Curl": [["biceps"], ["forearms"]],
  "Hammer Curl": [["biceps", "forearms"], []],
  "Squat": [["quads", "glutes"], ["hamstrings", "lowerBack", "abs"]],
  "Leg Press": [["quads"], ["glutes"]],
  "Bodyweight Squat": [["quads"], ["glutes"]],
  "Lunge": [["quads", "glutes"], ["hamstrings"]],
  "Bulgarian Split Squat": [["quads", "glutes"], ["hamstrings"]],
  "Romanian Deadlift": [["hamstrings", "glutes"], ["lowerBack", "forearms"]],
  "Leg Curl": [["hamstrings"], []],
  "Glute Bridge": [["glutes"], ["hamstrings"]],
  "Calf Raise": [["calves"], []],
  "Crunch": [["abs"], ["obliques"]],
  "Plank": [["abs", "obliques"], ["shoulders"]],
  "Wall Sit": [["quads"], []],
};

// The muscles an exercise trains, or null for cardio and exercises the app doesn't know.
export function musclesFor(name) {
  const key = Object.keys(EXERCISE_MUSCLES).find((known) => known.toLowerCase() === name.trim().toLowerCase());
  return key ? { main: EXERCISE_MUSCLES[key][0], helpers: EXERCISE_MUSCLES[key][1] } : null;
}

// Sets per muscle over the `days` days ending `today` (YYYY-MM-DD). Returns a Map of muscle
// key to { sets, exercises }, where exercises maps an exercise name to the sets it added.
// Every muscle is present, with 0 sets if it wasn't trained.
export function setsPerMuscle(workouts, today, days = 7) {
  const from = addDays(today, -(days - 1));
  const tally = new Map(MUSCLES.map(({ key }) => [key, { sets: 0, exercises: new Map() }]));
  for (const workout of workouts) {
    if (workout.date < from || workout.date > today || !Array.isArray(workout.exercises)) continue;
    for (const exercise of workout.exercises) {
      const muscles = musclesFor(exercise.name);
      if (!muscles) continue;
      const count = exercise.sets.length;
      const add = (key, amount) => {
        const entry = tally.get(key);
        entry.sets += amount;
        entry.exercises.set(exercise.name, (entry.exercises.get(exercise.name) ?? 0) + amount);
      };
      for (const key of muscles.main) add(key, count);
      for (const key of muscles.helpers) add(key, count / 2);
    }
  }
  return tally;
}

// How filled in a muscle looks: 0 none, 1 light (under 5 sets), 2 good (5 to 9), 3 plenty (10+).
export function muscleLevel(sets) {
  if (sets <= 0) return 0;
  if (sets < 5) return 1;
  if (sets < 10) return 2;
  return 3;
}

// "9 sets", "4½ sets", "1 set".
export function setsText(sets) {
  const whole = Math.floor(sets);
  const text = sets - whole >= 0.5 ? `${whole === 0 ? "" : whole}½` : String(whole);
  return `${text} ${sets === 1 ? "set" : "sets"}`;
}
