// Ready-made beginner plans, built only from the app's built-in exercises so each one has
// instructions. The shape of the week changes with how many days you train, following
// mainstream guidance: beginners do best on 2 to 3 full-body sessions on non-consecutive
// days (American College of Sports Medicine); working each muscle group about twice a week
// beats once (Schoenfeld and colleagues, 2016); the same muscles get about 48 hours before
// they are trained hard again; and adults should also get regular easy cardio (World Health
// Organization). The workouts themselves were written for this app, not copied from a study.

export const STARTER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export const STARTER_EQUIPMENT = [
  { value: "gym", label: "A gym with machines and barbells" },
  { value: "dumbbells", label: "Dumbbells only" },
  { value: "none", label: "No equipment" },
];

const REST_SECONDS = 60;

// Strength sets leave the weight blank: a beginner picks it on the day.
const lift = (name, sets, reps) => ({ name, type: "strength", sets, set: { weight: null, reps } });
const hold = (name, sets, seconds) => ({ name, type: "timed", sets, set: { seconds } });
const cardio = (name, minutes) => ({ name, type: "cardio", sets: 1, set: { minutes, distance: null } });

const WORKOUT_NAMES = {
  fullA: "Full body A",
  fullB: "Full body B",
  fullC: "Full body C",
  upper: "Upper body",
  lower: "Lower body",
  push: "Push day",
  pull: "Pull day",
  legs: "Leg day",
  cardio: "Easy cardio",
  core: "Core and recovery",
};

const EASY_CARDIO = [cardio("Walking", 25)];

const WORKOUTS = {
  gym: {
    fullA: [lift("Leg Press", 3, 10), lift("Bench Press", 3, 8), lift("Lat Pulldown", 3, 10), lift("Dumbbell Shoulder Press", 2, 10), hold("Plank", 3, 30)],
    fullB: [lift("Squat", 3, 8), lift("Seated Cable Row", 3, 10), lift("Incline Dumbbell Press", 3, 10), lift("Leg Curl", 3, 12), lift("Bicep Curl", 2, 12)],
    fullC: [lift("Romanian Deadlift", 3, 10), lift("Push-up", 3, 8), lift("Dumbbell Row", 3, 10), lift("Lunge", 3, 10), lift("Tricep Pushdown", 2, 12)],
    upper: [lift("Bench Press", 3, 8), lift("Lat Pulldown", 3, 10), lift("Dumbbell Shoulder Press", 3, 10), lift("Seated Cable Row", 3, 10), lift("Bicep Curl", 2, 12), lift("Tricep Pushdown", 2, 12)],
    lower: [lift("Squat", 3, 8), lift("Romanian Deadlift", 3, 10), lift("Leg Press", 3, 10), lift("Leg Curl", 3, 12), lift("Calf Raise", 3, 15), hold("Plank", 3, 30)],
    push: [lift("Bench Press", 3, 8), lift("Incline Dumbbell Press", 3, 10), lift("Dumbbell Shoulder Press", 3, 10), lift("Lateral Raise", 2, 12), lift("Tricep Pushdown", 3, 12)],
    pull: [lift("Lat Pulldown", 3, 10), lift("Seated Cable Row", 3, 10), lift("Dumbbell Row", 3, 10), lift("Face Pull", 2, 15), lift("Bicep Curl", 3, 12)],
    legs: [lift("Squat", 3, 8), lift("Leg Press", 3, 10), lift("Romanian Deadlift", 3, 10), lift("Leg Curl", 3, 12), lift("Calf Raise", 3, 15)],
    cardio: EASY_CARDIO,
  },
  dumbbells: {
    fullA: [lift("Lunge", 3, 10), lift("Dumbbell Shoulder Press", 3, 10), lift("Dumbbell Row", 3, 10), lift("Bicep Curl", 2, 12), hold("Plank", 3, 30)],
    fullB: [lift("Bulgarian Split Squat", 3, 8), lift("Push-up", 3, 8), lift("Romanian Deadlift", 3, 10), lift("Lateral Raise", 2, 12), lift("Hammer Curl", 2, 12)],
    fullC: [lift("Glute Bridge", 3, 12), lift("Push-up", 3, 8), lift("Dumbbell Row", 3, 10), lift("Calf Raise", 3, 15), lift("Overhead Tricep Extension", 2, 12)],
    upper: [lift("Dumbbell Shoulder Press", 3, 10), lift("Dumbbell Row", 3, 10), lift("Push-up", 3, 8), lift("Lateral Raise", 2, 12), lift("Bicep Curl", 2, 12), lift("Overhead Tricep Extension", 2, 12)],
    lower: [lift("Lunge", 3, 10), lift("Romanian Deadlift", 3, 10), lift("Bulgarian Split Squat", 2, 8), lift("Glute Bridge", 3, 12), lift("Calf Raise", 3, 15), hold("Plank", 3, 30)],
    push: [lift("Push-up", 3, 8), lift("Dumbbell Shoulder Press", 3, 10), lift("Lateral Raise", 3, 12), lift("Overhead Tricep Extension", 3, 12)],
    pull: [lift("Dumbbell Row", 4, 10), lift("Superman", 3, 12), lift("Bicep Curl", 3, 12), lift("Hammer Curl", 2, 12)],
    legs: [lift("Lunge", 3, 10), lift("Romanian Deadlift", 3, 10), lift("Bulgarian Split Squat", 2, 8), lift("Calf Raise", 3, 15), hold("Plank", 3, 30)],
    cardio: EASY_CARDIO,
  },
  none: {
    fullA: [lift("Bodyweight Squat", 3, 12), lift("Push-up", 3, 8), lift("Glute Bridge", 3, 12), hold("Plank", 3, 30)],
    fullB: [lift("Lunge", 3, 10), lift("Push-up", 3, 8), lift("Superman", 3, 12), hold("Wall Sit", 3, 30)],
    fullC: [lift("Bulgarian Split Squat", 3, 8), lift("Push-up", 3, 8), lift("Calf Raise", 3, 15), lift("Crunch", 3, 12)],
    cardio: EASY_CARDIO,
    core: [hold("Plank", 3, 30), lift("Glute Bridge", 2, 12), lift("Superman", 2, 12), lift("Crunch", 2, 12)],
  },
};

// Each week as [weekday, workout] pairs (weekday 0 is Sunday), starting on Monday, plus a
// sentence saying why the week is shaped that way.
const FULL_BODY_WEEKS = {
  1: {
    days: [[1, "fullA"]],
    why: "One full-body session works every major muscle. Add a second day when you can: twice a week builds strength faster than once.",
  },
  2: {
    days: [[1, "fullA"], [4, "fullB"]],
    why: "Two full-body sessions, days apart, so every muscle is trained twice a week with plenty of recovery.",
  },
  3: {
    days: [[1, "fullA"], [3, "fullB"], [5, "fullC"]],
    why: "Three full-body sessions with a rest day after each: the standard recommendation for beginners.",
  },
};

const WEIGHTS_WEEKS = {
  ...FULL_BODY_WEEKS,
  4: {
    days: [[1, "upper"], [2, "lower"], [4, "upper"], [5, "lower"]],
    why: "An upper and lower body split: each half is trained twice a week and rests while you train the other.",
  },
  5: {
    days: [[1, "upper"], [2, "lower"], [4, "push"], [5, "pull"], [6, "legs"]],
    why: "Upper and lower early in the week, then push, pull and legs: every muscle twice a week, never two hard days in a row for the same one.",
  },
  6: {
    days: [[1, "push"], [2, "pull"], [3, "legs"], [4, "push"], [5, "pull"], [6, "legs"]],
    why: "Push, pull, legs, twice through: each muscle is trained twice with two days before it comes round again. Sunday is a full rest day.",
  },
  7: {
    days: [[1, "push"], [2, "pull"], [3, "legs"], [4, "push"], [5, "pull"], [6, "legs"], [0, "cardio"]],
    why: "Push, pull, legs, twice through, and an easy walk on Sunday instead of a seventh lifting day, because muscles grow while they recover.",
  },
};

// Without equipment there is too little variety to split by muscle, so extra days are
// easy cardio between the strength days.
const NO_EQUIPMENT_WEEKS = {
  ...FULL_BODY_WEEKS,
  4: {
    days: [[1, "fullA"], [2, "cardio"], [4, "fullB"], [5, "cardio"]],
    why: "Two full-body strength days, each followed by an easy walk, so muscles recover while you keep moving.",
  },
  5: {
    days: [[1, "fullA"], [2, "cardio"], [3, "fullB"], [5, "fullC"], [6, "cardio"]],
    why: "Three full-body strength days and two easy walks: strength and cardio in the amounts health guidelines recommend.",
  },
  6: {
    days: [[1, "fullA"], [2, "cardio"], [3, "fullB"], [4, "cardio"], [5, "fullC"], [6, "cardio"]],
    why: "Strength and easy walks on alternate days, so no muscle is worked hard two days running. Sunday is a full rest day.",
  },
  7: {
    days: [[1, "fullA"], [2, "cardio"], [3, "fullB"], [4, "cardio"], [5, "fullC"], [6, "cardio"], [0, "core"]],
    why: "Strength and easy walks on alternate days, with a light core session on Sunday instead of a fourth hard day.",
  },
};

const WEEKS = { gym: WEIGHTS_WEEKS, dumbbells: WEIGHTS_WEEKS, none: NO_EQUIPMENT_WEEKS };

// A starter plan as { routines, schedule, why }: the saved workouts to add, the weekday
// each one is planned for, and a sentence explaining the week. `makeId` returns a new
// unique id each time it is called. Returns null for a number of days or a kind of
// equipment the app does not offer.
export function buildStarterPlan(daysPerWeek, equipment, makeId) {
  const week = WEEKS[equipment]?.[daysPerWeek];
  if (!week) return null;

  const routineByKey = new Map();
  for (const [, key] of week.days) {
    if (routineByKey.has(key)) continue;
    routineByKey.set(key, {
      id: makeId(),
      name: WORKOUT_NAMES[key],
      exercises: WORKOUTS[equipment][key].map((exercise) => ({
        id: makeId(),
        name: exercise.name,
        type: exercise.type,
        restSeconds: exercise.type === "cardio" ? 0 : REST_SECONDS,
        sets: Array.from({ length: exercise.sets }, () => ({ ...exercise.set })),
      })),
    });
  }
  const schedule = Object.fromEntries(week.days.map(([weekday, key]) => [weekday, routineByKey.get(key).id]));
  return { routines: [...routineByKey.values()], schedule, why: week.why };
}
