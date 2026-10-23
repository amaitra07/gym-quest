import { isSetFilled } from "./exercises.js";

// Personal records and progress. Exercises are matched by name, ignoring case, so
// "bench press" and "Bench Press" are the same lift.

const normalizeName = (name) => name.trim().toLowerCase();

// Epley formula: the heaviest single rep a set suggests you could do.
export function estimateOneRepMax(weight, reps) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

// One number per set so sets can be compared. Strength uses the estimated one-rep max,
// so a heavier set of fewer reps can beat a lighter set of more reps; bodyweight sets
// (no weight) use reps. Cardio uses distance when given, otherwise minutes.
export function setScore(type, set) {
  if (type === "strength") {
    const weight = set.weight ?? 0;
    const reps = set.reps ?? 0;
    return weight > 0 ? estimateOneRepMax(weight, reps) : reps;
  }
  if (type === "cardio") return set.distance > 0 ? set.distance : (set.minutes ?? 0);
  return set.seconds ?? 0;
}

export function bestSet(type, sets) {
  let best = null;
  for (const set of sets) {
    if (!isSetFilled(type, set)) continue;
    if (best === null || setScore(type, set) > setScore(type, best)) best = set;
  }
  return best;
}

function newestLast(workouts) {
  return [...workouts].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
  );
}

// Every session of one exercise, oldest first, each with its best set and that set's score.
export function exerciseSessions(workouts, name) {
  const wanted = normalizeName(name);
  const sessions = [];
  for (const workout of newestLast(workouts)) {
    const exercise = workout.exercises.find((item) => normalizeName(item.name) === wanted);
    const best = exercise ? bestSet(exercise.type, exercise.sets) : null;
    if (best === null) continue;
    sessions.push({
      workoutId: workout.id,
      date: workout.date,
      type: exercise.type,
      sets: exercise.sets.filter((set) => isSetFilled(exercise.type, set)),
      best,
      score: setScore(exercise.type, best),
    });
  }
  return sessions;
}

// One entry per exercise ever logged, most recently done first.
export function listExercises(workouts) {
  const byName = new Map();
  for (const workout of newestLast(workouts)) {
    for (const exercise of workout.exercises) {
      const best = bestSet(exercise.type, exercise.sets);
      if (best === null) continue;
      const key = normalizeName(exercise.name);
      const entry = byName.get(key) ?? { sessions: 0, record: null };
      entry.name = exercise.name;
      entry.type = exercise.type;
      entry.lastDate = workout.date;
      entry.sessions += 1;
      if (entry.record === null || setScore(exercise.type, best) > setScore(exercise.type, entry.record.set)) {
        entry.record = { set: best, date: workout.date };
      }
      byName.set(key, entry);
    }
  }
  return [...byName.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0));
}

// The numbers shown for one exercise: its best set and, for strength, the heaviest
// weight and the best estimated one-rep max.
export function exerciseSummary(workouts, name) {
  const sessions = exerciseSessions(workouts, name);
  if (sessions.length === 0) return null;
  const { type } = sessions[0];
  let record = sessions[0];
  let heaviest = null;
  for (const session of sessions) {
    if (session.score > record.score) record = session;
    if (type !== "strength") continue;
    for (const set of session.sets) {
      if ((set.weight ?? 0) > (heaviest?.set.weight ?? 0)) heaviest = { set, date: session.date };
    }
  }
  return {
    type,
    sessions,
    record: { set: record.best, date: record.date },
    heaviest,
    oneRepMax: type === "strength" && heaviest ? Math.round(record.score) : null,
  };
}

// Chart points for an exercise, flagging each session that beat every earlier one.
export function progressPoints(sessions) {
  let best = -Infinity;
  return sessions.map((session, index) => {
    const isRecord = index > 0 && session.score > best;
    best = Math.max(best, session.score);
    return { date: session.date, value: Math.round(session.score * 10) / 10, isRecord };
  });
}

// Exercises in `workout` where it beat everything in `pastWorkouts`. A first-ever
// attempt sets a baseline and does not count, and a tie is not a record.
export function findNewRecords(pastWorkouts, workout) {
  const records = [];
  for (const exercise of workout.exercises) {
    const best = bestSet(exercise.type, exercise.sets);
    if (best === null) continue;
    const earlier = exerciseSessions(pastWorkouts, exercise.name);
    if (earlier.length === 0) continue;
    const earlierBest = Math.max(...earlier.map((session) => session.score));
    if (setScore(exercise.type, best) > earlierBest + 1e-9) {
      records.push({ name: exercise.name, type: exercise.type, set: best });
    }
  }
  return records;
}

// What the finished-workout screen and share card show.
export function workoutSummary(workout, records) {
  let setCount = 0;
  let volume = 0;
  const lines = [];
  for (const exercise of workout.exercises) {
    const filled = exercise.sets.filter((set) => isSetFilled(exercise.type, set));
    if (filled.length === 0) continue;
    setCount += filled.length;
    if (exercise.type === "strength") {
      volume += filled.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
    }
    lines.push({ name: exercise.name, type: exercise.type, set: bestSet(exercise.type, filled) });
  }
  return {
    name: workout.name,
    date: workout.date,
    xp: workout.xp ?? 0,
    exerciseCount: lines.length,
    setCount,
    volume: Math.round(volume),
    lines,
    records,
  };
}
