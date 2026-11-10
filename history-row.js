import { activitySummary } from "./activity.js";
import { formatDate } from "./dates.js";
import { el, listRow } from "./dom.js";

export function summarize(workout) {
  if (workout.kind === "activity") return activitySummary(workout);
  const setCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const exerciseWord = workout.exercises.length === 1 ? "exercise" : "exercises";
  const setWord = setCount === 1 ? "set" : "sets";
  return `${workout.exercises.length} ${exerciseWord} · ${setCount} ${setWord}`;
}

// One row that opens the workout for editing when tapped. Swiping it left shows Delete.
export function workoutRow(workout, onOpenWorkout, onDeleteWorkout) {
  const row = el("ion-item-sliding", {},
    listRow({
      title: workout.name,
      detail: summarize(workout),
      sideTop: formatDate(workout.date),
      sideBottom: `+${workout.xp || 0} XP`,
      label: `Edit ${workout.name}`,
      onTap: () => onOpenWorkout(workout),
    }),
    el("ion-item-options", { side: "end" },
      el("ion-item-option", {
        color: "danger",
        text: "Delete",
        onclick: () => {
          row.close();
          onDeleteWorkout(workout);
        },
      })));
  return row;
}
