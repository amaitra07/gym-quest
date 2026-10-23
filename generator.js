import { exerciseTypeFor } from "./exercises.js";

// Each workout kind is a list of slots. A slot picks one exercise from its
// options (never one already chosen) and gives the target for it.
// `reps` applies to strength exercises, `minutes` to cardio, `seconds` to timed holds.
export const WORKOUT_KINDS = {
  push: {
    label: "Push day",
    slots: [
      { options: ["Bench Press", "Incline Dumbbell Press"], sets: 4, reps: 8, rest: 90 },
      { options: ["Overhead Press", "Dumbbell Shoulder Press"], sets: 3, reps: 10, rest: 60 },
      { options: ["Incline Dumbbell Press", "Dips", "Dumbbell Fly", "Push-up"], sets: 3, reps: 10, rest: 60 },
      { options: ["Lateral Raise"], sets: 3, reps: 15, rest: 45 },
      { options: ["Tricep Pushdown", "Overhead Tricep Extension", "Skull Crusher"], sets: 3, reps: 12, rest: 60 },
    ],
  },
  pull: {
    label: "Pull day",
    slots: [
      { options: ["Barbell Row", "Dumbbell Row"], sets: 4, reps: 8, rest: 90 },
      { options: ["Pull-up", "Lat Pulldown"], sets: 4, reps: 8, rest: 90 },
      { options: ["Seated Cable Row", "Dumbbell Row"], sets: 3, reps: 10, rest: 60 },
      { options: ["Face Pull"], sets: 3, reps: 15, rest: 45 },
      { options: ["Bicep Curl", "Hammer Curl"], sets: 3, reps: 12, rest: 60 },
    ],
  },
  legs: {
    label: "Leg day",
    slots: [
      { options: ["Squat", "Leg Press"], sets: 4, reps: 8, rest: 90 },
      { options: ["Romanian Deadlift"], sets: 3, reps: 10, rest: 60 },
      { options: ["Lunge", "Bulgarian Split Squat"], sets: 3, reps: 10, rest: 60 },
      { options: ["Leg Curl"], sets: 3, reps: 12, rest: 60 },
      { options: ["Calf Raise"], sets: 4, reps: 15, rest: 45 },
      { options: ["Plank", "Wall Sit"], sets: 3, seconds: 45, rest: 45 },
    ],
  },
  fullBody: {
    label: "Full body",
    slots: [
      { options: ["Squat", "Deadlift"], sets: 3, reps: 8, rest: 90 },
      { options: ["Bench Press", "Push-up"], sets: 3, reps: 8, rest: 90 },
      { options: ["Barbell Row", "Pull-up"], sets: 3, reps: 8, rest: 90 },
      { options: ["Overhead Press", "Dumbbell Shoulder Press"], sets: 3, reps: 10, rest: 60 },
      { options: ["Plank"], sets: 3, seconds: 30, rest: 45 },
    ],
  },
  cardio: {
    label: "Cardio",
    slots: [
      { options: ["Running", "Cycling", "Rowing", "Swimming"], sets: 1, minutes: 30, rest: 0 },
      { options: ["Running", "Cycling", "Rowing", "Swimming"], sets: 1, minutes: 10, rest: 0 },
    ],
  },
};

// Returns [{ name, type, sets, target, rest }]: `target` is one of { reps },
// { minutes } or { seconds }, and `rest` is the seconds between sets. `random` can be replaced in tests.
export function generateWorkout(kind, random = Math.random) {
  const chosen = new Set();
  const exercises = [];
  for (const slot of WORKOUT_KINDS[kind].slots) {
    const available = slot.options.filter((name) => !chosen.has(name));
    if (available.length === 0) continue;
    const name = available[Math.floor(random() * available.length)];
    chosen.add(name);
    const target = slot.reps
      ? { reps: slot.reps }
      : slot.minutes
        ? { minutes: slot.minutes }
        : { seconds: slot.seconds };
    exercises.push({ name, type: exerciseTypeFor(name, []), sets: slot.sets, target, rest: slot.rest });
  }
  return exercises;
}

export function describeTarget({ type, sets, target }) {
  if (type === "strength") return `${sets} × ${target.reps}`;
  if (type === "cardio") return `${target.minutes} min`;
  return `${sets} × ${target.seconds}s`;
}
