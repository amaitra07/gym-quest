// Each exercise has a type that decides which numbers a set records.
// `requiredField` is the one value a set needs to count as logged.
export const EXERCISE_TYPES = {
  strength: {
    label: "Strength",
    requiredField: "reps",
    fields: [
      { key: "weight", label: "Weight", step: "0.5", usesWeightUnit: true },
      { key: "reps", label: "Reps", step: "1" },
    ],
  },
  cardio: {
    label: "Cardio",
    requiredField: "minutes",
    fields: [
      { key: "minutes", label: "Minutes", step: "1" },
      { key: "distance", label: "Distance", step: "0.1" },
    ],
  },
  timed: {
    label: "Timed hold",
    requiredField: "seconds",
    fields: [{ key: "seconds", label: "Seconds", step: "5" }],
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
  ["Running", "cardio"],
  ["Cycling", "cardio"],
  ["Rowing", "cardio"],
  ["Swimming", "cardio"],
  ["Plank", "timed"],
  ["Wall Sit", "timed"],
];

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

// Drops sets with nothing logged, and exercises left with no sets.
export function cleanWorkout(workout) {
  const exercises = workout.exercises
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => isSetFilled(exercise.type, set)),
    }))
    .filter((exercise) => exercise.sets.length > 0);
  return { ...workout, exercises };
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
    if (match) return { date: workout.date, sets: match.sets };
  }
  return null;
}

// A new set starts from last time's matching set, then from the set just before it.
export function nextSetDefaults(type, lastSets, ownSets) {
  const source = lastSets?.[ownSets.length] ?? ownSets.at(-1) ?? {};
  const set = {};
  for (const { key } of EXERCISE_TYPES[type].fields) {
    set[key] = source[key] ?? null;
  }
  return set;
}

// A fresh workout to log from a saved one. Reps, minutes and rest come from the saved
// workout; strength weights come from the last time each exercise was done, falling
// back to the weight saved with the workout.
export function workoutFromRoutine(routine, pastWorkouts, date) {
  const exercises = routine.exercises.map((exercise) => {
    const last = lastPerformance(pastWorkouts, exercise.name, null);
    const sets = [];
    for (const savedSet of exercise.sets) {
      const set = { ...savedSet };
      if (exercise.type === "strength" && last) {
        set.weight = nextSetDefaults(exercise.type, last.sets, sets).weight ?? savedSet.weight;
      }
      sets.push(set);
    }
    return { ...exercise, id: newId(), sets };
  });
  return { id: newId(), createdAt: Date.now(), name: routine.name, date, exercises };
}

export function describeSet(type, set, unit) {
  if (type === "strength") return `${set.weight ?? 0}${unit} × ${set.reps}`;
  if (type === "cardio") {
    return set.distance ? `${set.minutes} min, ${set.distance} dist` : `${set.minutes} min`;
  }
  return `${set.seconds}s`;
}
