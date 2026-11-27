// Each exercise has a type that decides which numbers a set records.
// `requiredField` is the one value a set needs to count as logged.
export const EXERCISE_TYPES = {
  strength: {
    label: "Strength",
    requiredField: "reps",
    fields: [
      { key: "weight", label: "Weight", step: "0.5", usesWeightUnit: true },
      { key: "reps", label: "Reps", step: "1", short: "reps" },
    ],
  },
  cardio: {
    label: "Cardio",
    requiredField: "minutes",
    fields: [
      { key: "minutes", label: "Minutes", step: "1", short: "min" },
      { key: "distance", label: "Distance", step: "0.1" },
    ],
  },
  timed: {
    label: "Timed hold",
    requiredField: "seconds",
    fields: [{ key: "seconds", label: "Seconds", step: "5", short: "sec" }],
  },
};

const LIBRARY = [
  ["Bench Press", "strength"],
  ["Incline Dumbbell Press", "strength"],
  ["Dips", "strength"],
  ["Dumbbell Fly", "strength"],
  ["Overhead Press", "strength"],
  ["Dumbbell Shoulder Press", "strength"],
  ["Lateral Raise", "strength"],
  ["Tricep Pushdown", "strength"],
  ["Overhead Tricep Extension", "strength"],
  ["Skull Crusher", "strength"],
  ["Push-up", "strength"],
  ["Deadlift", "strength"],
  ["Barbell Row", "strength"],
  ["Dumbbell Row", "strength"],
  ["Seated Cable Row", "strength"],
  ["Lat Pulldown", "strength"],
  ["Pull-up", "strength"],
  ["Face Pull", "strength"],
  ["Bicep Curl", "strength"],
  ["Hammer Curl", "strength"],
  ["Squat", "strength"],
  ["Leg Press", "strength"],
  ["Romanian Deadlift", "strength"],
  ["Lunge", "strength"],
  ["Bulgarian Split Squat", "strength"],
  ["Leg Curl", "strength"],
  ["Calf Raise", "strength"],
  ["Bodyweight Squat", "strength"],
  ["Glute Bridge", "strength"],
  ["Superman", "strength"],
  ["Crunch", "strength"],
  ["Walking", "cardio"],
  ["Running", "cardio"],
  ["Cycling", "cardio"],
  ["Rowing", "cardio"],
  ["Swimming", "cardio"],
  ["Plank", "timed"],
  ["Wall Sit", "timed"],
];

// The small unit shown beside a number as it's typed: "lb", "reps", "min", "sec".
export function fieldUnit(field, unit) {
  return field.usesWeightUnit ? unit : field.short ?? "";
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

export function isSetFilled(type, set) {
  const value = set[EXERCISE_TYPES[type].requiredField];
  return Number.isFinite(value) && value > 0;
}

// Notes that only matter while logging (a weight suggestion, the "Find your weight" progress)
// aren't saved with the workout. The weight that was found, and "bodyweight", are.
function withoutSuggestion(exercise) {
  const copy = { ...exercise };
  delete copy.suggestion;
  delete copy.findingWeight;
  delete copy.feelNote;
  return copy;
}

// Drops sets with nothing logged, and exercises left with no sets.
export function cleanWorkout(workout) {
  const exercises = workout.exercises
    .map((exercise) => ({
      ...withoutSuggestion(exercise),
      sets: exercise.sets.filter((set) => isSetFilled(exercise.type, set)),
    }))
    .filter((exercise) => exercise.sets.length > 0);
  return { ...workout, exercises };
}

function withoutTick(set) {
  const copy = { ...set };
  delete copy.done;
  return copy;
}

// What a new workout saves: only the sets ticked as done (and filled in), without the tick
// itself, since every saved set was done.
export function keepDoneSets(workout) {
  const exercises = workout.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.done === true).map(withoutTick),
  }));
  return cleanWorkout({ ...workout, exercises });
}

export function exerciseNames(workouts) {
  const names = new Map(LIBRARY.map(([name]) => [normalizeName(name), name]));
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      names.set(normalizeName(exercise.name), exercise.name);
    }
  }
  return [...names.values()].sort();
}

// Past workouts decide the type first, so a renamed or custom exercise keeps its type.
export function exerciseTypeFor(name, workouts) {
  const wanted = normalizeName(name);
  for (const workout of workouts) {
    const match = workout.exercises.find((exercise) => normalizeName(exercise.name) === wanted);
    if (match) return match.type;
  }
  const known = LIBRARY.find(([libraryName]) => normalizeName(libraryName) === wanted);
  return known ? known[1] : null;
}

// The sets from the most recent other workout that included this exercise.
export function lastPerformance(workouts, name, excludeWorkoutId) {
  const wanted = normalizeName(name);
  const newestFirst = [...workouts]
    .filter((workout) => workout.id !== excludeWorkoutId)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  for (const workout of newestFirst) {
    const match = workout.exercises.find((exercise) => normalizeName(exercise.name) === wanted);
    if (match) return { date: workout.date, sets: match.sets, foundWeight: match.foundWeight ?? null, bodyweight: match.bodyweight === true };
  }
  return null;
}

// The sets of the most recent `count` other workouts that included this exercise, newest first.
export function recentPerformances(workouts, name, count) {
  const wanted = normalizeName(name);
  return [...workouts]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .map((workout) => workout.exercises.find((exercise) => normalizeName(exercise.name) === wanted))
    .filter(Boolean)
    .slice(0, count)
    .map((exercise) => exercise.sets.filter((set) => isSetFilled("strength", set)));
}

// How much one step of weight is: 5 lb or 2.5 kg.
export const WEIGHT_STEP = { lb: 5, kg: 2.5 };

// Double progression for a rep range (`range` is { reps, repsTop }): after a session where
// every set reached the top of the range, add one step of weight; after two sessions in a
// row with a set below the bottom, drop about 5%; otherwise stay and keep adding reps.
// `sessions` holds the sets of recent sessions, newest first. Returns null for no change, or
// { change: "up" | "down" | "harder", from, to }. Without weights it can only say "harder".
export function suggestNextWeight(sessions, range, unit = "lb") {
  const [last, before] = sessions;
  if (!range?.repsTop || !last?.length) return null;
  const step = WEIGHT_STEP[unit] ?? WEIGHT_STEP.lb;
  const working = Math.max(...last.map((set) => set.weight ?? 0));
  const allAtTop = last.every((set) => set.reps >= range.repsTop);
  if (working <= 0) return allAtTop ? { change: "harder", from: null, to: null } : null;
  if (allAtTop) return { change: "up", from: working, to: working + step };
  const belowBottom = (sets) => sets.some((set) => set.reps < range.reps);
  if (belowBottom(last) && before?.length && belowBottom(before)) {
    const lighter = Math.max(step, Math.round((working * 0.95) / step) * step);
    return lighter < working ? { change: "down", from: working, to: lighter } : null;
  }
  return null;
}

// What the suggestion says, for Get ready, the log grid and the guided set screen.
export function suggestionText(suggestion, range, unit) {
  if (suggestion.change === "up") return `↑ ${suggestion.to} ${unit}: you hit ${range.repsTop} reps on every set last time`;
  if (suggestion.change === "down") return `↓ ${suggestion.to} ${unit}: under ${range.reps} reps two sessions running, so a little lighter`;
  return `You hit ${range.repsTop} reps on every set last time. Time to add weight, or try a harder version.`;
}

// "Keep 135": puts back last time's weight on the sets not done yet and drops the suggestion.
export function keepPreviousWeight(exercise) {
  const { suggestion } = exercise;
  if (!suggestion || suggestion.from === null) return;
  for (const set of exercise.sets) {
    if (set.done !== true && set.weight === suggestion.to) set.weight = suggestion.from;
  }
  delete exercise.suggestion;
}

// A new set starts from last time's matching set, then from the set just before it.
export function nextSetDefaults(type, lastSets, ownSets) {
  const source = lastSets?.[ownSets.length] ?? ownSets.at(-1) ?? {};
  const set = {};
  for (const { key } of EXERCISE_TYPES[type].fields) {
    set[key] = source[key] ?? null;
  }
  if (source.repsTop) set.repsTop = source.repsTop;
  return set;
}

// A fresh workout to log from a saved one. Reps, minutes and rest come from the saved
// workout; strength weights come from the last time each exercise was done, falling
// back to the weight saved with the workout. An exercise with a rep range may also get a
// suggested weight (see suggestNextWeight), filled in and noted in `exercise.suggestion`.
export function workoutFromRoutine(routine, pastWorkouts, date, unit = "lb") {
  const exercises = routine.exercises.map((exercise) => {
    const last = lastPerformance(pastWorkouts, exercise.name, null);
    const sets = [];
    for (const savedSet of exercise.sets) {
      const set = { ...savedSet };
      if (exercise.type === "strength" && last) {
        // A weight found with "Find your weight" last time goes on every set.
        set.weight = last.foundWeight ?? nextSetDefaults(exercise.type, last.sets, sets).weight ?? savedSet.weight;
      }
      sets.push(set);
    }
    const range = exercise.type === "strength" ? exercise.sets.find((set) => set.repsTop) : null;
    const suggestion = range ? suggestNextWeight(recentPerformances(pastWorkouts, exercise.name, 2), range, unit) : null;
    if (suggestion?.to !== null && suggestion?.to !== undefined) {
      for (const set of sets) if (set.weight > 0) set.weight = suggestion.to;
    }
    const started = { ...exercise, id: newId(), sets };
    if (last?.bodyweight) started.bodyweight = true;
    if (suggestion) started.suggestion = suggestion;
    return started;
  });
  return { id: newId(), createdAt: Date.now(), name: routine.name, date, exercises };
}

// Reps can be a range: "6-8" means a set counts from 6 reps and tops out at 8. It is stored
// as `reps` (the bottom, or the actual reps once done) and `repsTop` (the top). Returns
// { reps, repsTop }, with repsTop null for a plain number, or null if it isn't a target.
export function parseRepRange(text) {
  const match = String(text).trim().match(/^(\d+)(?:\s*(?:-|–|to)\s*(\d+))?$/i);
  if (!match) return null;
  let low = Number(match[1]);
  let high = match[2] === undefined ? null : Number(match[2]);
  if (high !== null && high < low) [low, high] = [high, low];
  if (low < 1) return null;
  return { reps: low, repsTop: high === null || high === low ? null : high };
}

// "6–8" for a range, "8" for a plain number.
export function repTargetText(set) {
  return set.repsTop ? `${set.reps}–${set.repsTop}` : String(set.reps ?? "");
}

// A set as a target to aim for: like describeSet, but a rep range shows as the range.
export function describeTarget(type, set, unit) {
  if (type !== "strength" || !set.repsTop) return describeSet(type, set, unit);
  return set.weight > 0 ? `${set.weight} ${unit} × ${repTargetText(set)}` : `${repTargetText(set)} reps`;
}

export function describeSet(type, set, unit) {
  if (type === "strength") {
    return set.weight > 0 ? `${set.weight} ${unit} × ${set.reps}` : `${set.reps} reps`;
  }
  if (type === "cardio") {
    return set.distance ? `${set.minutes} min, ${set.distance} dist` : `${set.minutes} min`;
  }
  return `${set.seconds}s`;
}

// The text on a set's line in the editor. A set with nothing typed yet reads "Not filled in".
export function setLineText(type, set, unit) {
  return isSetFilled(type, set) ? describeSet(type, set, unit) : "Not filled in";
}
