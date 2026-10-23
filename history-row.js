import { formatDate } from "./dates.js";
import { el } from "./dom.js";

export function summarize(workout) {
  const setCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const exerciseWord = workout.exercises.length === 1 ? "exercise" : "exercises";
  const setWord = setCount === 1 ? "set" : "sets";
  return `${workout.exercises.length} ${exerciseWord} · ${setCount} ${setWord}`;
}

// One tappable row that opens the workout for editing.
export function workoutRow(workout, onOpenWorkout) {
  const button = el(
    "button",
    {
      class: "history-item",
      type: "button",
      "aria-label": `Edit ${workout.name}`,
      onclick: () => onOpenWorkout(workout),
    },
    el("span", { class: "history-main" },
      el("span", { class: "history-name", text: workout.name }),
      el("span", { class: "muted", text: summarize(workout) })),
    el("span", { class: "history-side" },
      el("span", { class: "when", text: formatDate(workout.date) }),
      el("span", { class: "xp", text: `+${workout.xp || 0} XP` })),
  );
  return el("li", {}, button);
}
