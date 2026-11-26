// "Find your weight": coaching for a beginner whose exercise has no weight yet. Each built-in
// exercise has a safe place to start and a step to move by; after each set the person says
// how it felt, and the next set is moved up, down or kept. The aim, as most coaches teach it,
// is a weight where the last one or two reps are hard but form still holds.

// Where to start, how far to move, and (for barbells) the lightest it can go, which is the
// empty bar, by kind of equipment, in lb and kg.
const EMPTY_BAR = { lb: 45, kg: 20 };
const KINDS = {
  bar: { start: EMPTY_BAR, floor: EMPTY_BAR, step: { lb: 10, kg: 5 }, text: (weight, unit) => `Start with the empty bar (${weight} ${unit}).` },
  deadlift: { start: { lb: 95, kg: 40 }, floor: EMPTY_BAR, step: { lb: 20, kg: 10 }, text: (weight, unit) => `Start light: the bar with small plates, about ${weight} ${unit} in all.` },
  dumbbells: { start: { lb: 10, kg: 4 }, step: { lb: 5, kg: 2 }, text: (weight, unit) => `Start with a light pair of dumbbells, ${weight} ${unit} each.` },
  lightDumbbells: { start: { lb: 5, kg: 2 }, step: { lb: 2.5, kg: 1 }, text: (weight, unit) => `Start very light: ${weight} ${unit} dumbbells. This one feels heavy fast.` },
  machine: { start: { lb: 40, kg: 20 }, step: { lb: 10, kg: 5 }, text: (weight, unit) => `Start near the top of the stack, around ${weight} ${unit}.` },
  legPress: { start: { lb: 90, kg: 40 }, step: { lb: 20, kg: 10 }, text: (weight, unit) => `Start light, around ${weight} ${unit}. Legs are strong, so expect to go up.` },
  cable: { start: { lb: 20, kg: 10 }, step: { lb: 5, kg: 2.5 }, text: (weight, unit) => `Start with a light pin on the cable, around ${weight} ${unit}.` },
};

// Built-in exercises by kind. Bodyweight ones (push-ups, crunches) are left out: there is
// no weight to find.
const EXERCISE_KINDS = {
  "Bench Press": "bar",
  "Squat": "bar",
  "Overhead Press": "bar",
  "Barbell Row": "bar",
  "Romanian Deadlift": "bar",
  "Skull Crusher": "bar",
  "Deadlift": "deadlift",
  "Incline Dumbbell Press": "dumbbells",
  "Dumbbell Shoulder Press": "dumbbells",
  "Dumbbell Row": "dumbbells",
  "Bicep Curl": "dumbbells",
  "Hammer Curl": "dumbbells",
  "Overhead Tricep Extension": "dumbbells",
  "Lunge": "dumbbells",
  "Bulgarian Split Squat": "dumbbells",
  "Dumbbell Fly": "lightDumbbells",
  "Lateral Raise": "lightDumbbells",
  "Lat Pulldown": "machine",
  "Seated Cable Row": "machine",
  "Leg Curl": "machine",
  "Calf Raise": "machine",
  "Leg Press": "legPress",
  "Tricep Pushdown": "cable",
  "Face Pull": "cable",
};

function kindFor(name) {
  const key = Object.keys(EXERCISE_KINDS).find((known) => known.toLowerCase() === name.trim().toLowerCase());
  return key ? KINDS[EXERCISE_KINDS[key]] : null;
}

// Where to start for this exercise: { weight, text }, or null for a bodyweight or unknown one.
export function startingPoint(name, unit = "lb") {
  const kind = kindFor(name);
  if (!kind) return null;
  const weight = kind.start[unit] ?? kind.start.lb;
  return { weight, text: kind.text(weight, unit) };
}

export const FEELINGS = [
  { value: "easy", label: "Easy", hint: "Could do 4+ more" },
  { value: "right", label: "Just right", hint: "1–3 more at most" },
  { value: "hard", label: "Too hard", hint: "Couldn't finish or form broke" },
];

// The lightest weight this exercise can use: the empty bar for barbell lifts, otherwise one
// step (the lightest dumbbell or pin).
export function lightestWeight(name, unit = "lb") {
  const kind = kindFor(name);
  if (!kind) return unit === "kg" ? 2.5 : 5;
  return kind.floor ? kind.floor[unit] ?? kind.floor.lb : kind.step[unit] ?? kind.step.lb;
}

// The weight for the next set after one at `weight` that felt `feeling`: a step up if it was
// easy, a step down if too hard (never below the lightest it can go, such as the empty bar),
// the same if just right.
export function nextWeightFromFeel(name, weight, feeling, unit = "lb") {
  const kind = kindFor(name);
  const step = kind ? kind.step[unit] ?? kind.step.lb : unit === "kg" ? 2.5 : 5;
  if (feeling === "easy") return weight + step;
  if (feeling === "hard") return Math.max(lightestWeight(name, unit), weight - step);
  return weight;
}

// The note shown with the next set: why the weight moved, or, when the lightest weight was
// still too hard, what to do instead.
export function feelNote(feeling, weight, unit, name = "") {
  if (feeling === "easy") return `Last set felt easy, so try ${weight} ${unit}.`;
  if (feeling === "hard" && weight <= lightestWeight(name, unit) && kindFor(name)?.floor) {
    return `The empty bar (${weight} ${unit}) is as light as a barbell goes. Do fewer reps with good form, or swap to dumbbells for now.`;
  }
  if (feeling === "hard") return `Last set was too hard, so try ${weight} ${unit}.`;
  return `${weight} ${unit} felt just right. Stay there.`;
}
