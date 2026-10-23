import { clearSelectedDate, getSelectedDate, longDate, renderCalendar } from "./calendar.js";
import { byId } from "./dom.js";
import { workoutRow } from "./history-row.js";

// Newest first; with a day selected, only that day's workouts.
export function visibleWorkouts(workouts, selectedDate) {
  return workouts
    .filter((workout) => selectedDate === null || workout.date === selectedDate)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

function emptyMessage(hasAnyWorkouts) {
  return hasAnyWorkouts
    ? "No workout logged this day."
    : "No workouts yet. Tap “Log” below when you’re ready to log your first one.";
}

export function renderHistory(workouts, onOpenWorkout) {
  const selectedDate = getSelectedDate();
  const shown = visibleWorkouts(workouts, selectedDate);
  const rerender = () => renderHistory(workouts, onOpenWorkout);

  renderCalendar(workouts, rerender);
  byId("historyHeading").textContent =
    selectedDate === null ? "All workouts" : longDate(selectedDate);
  byId("showAllButton").hidden = selectedDate === null;
  byId("showAllButton").onclick = () => {
    clearSelectedDate();
    rerender();
  };

  const list = byId("historyList");
  list.replaceChildren(...shown.map((workout) => workoutRow(workout, onOpenWorkout)));
  const empty = byId("historyEmpty");
  empty.hidden = shown.length > 0;
  empty.textContent = emptyMessage(workouts.length > 0);
}
