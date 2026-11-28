import { clearSelectedDate, getSelectedDate, longDate, renderCalendar } from "./calendar.js";
import { todayIso } from "./dates.js";
import { byId } from "./dom.js";
import { workoutRow } from "./history-row.js";

// Newest first; with a day selected, only that day's workouts.
export function visibleWorkouts(workouts, selectedDate) {
  return workouts
    .filter((workout) => selectedDate === null || workout.date === selectedDate)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

function emptyMessage(selectedDate) {
  return selectedDate !== null
    ? "No workout logged this day."
    : "No workouts yet. Start one from Home, or tap a day above to log one you already did.";
}

// A workout can be logged for today or any earlier day, never one still to come.
export function canLogForDay(selectedDate, today = todayIso()) {
  return selectedDate !== null && selectedDate <= today;
}

// "Feb 3": short enough for a button.
function shortDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function renderHistory(workouts, onOpenWorkout, onDeleteWorkout, onLogDay) {
  const selectedDate = getSelectedDate();
  const shown = visibleWorkouts(workouts, selectedDate);
  const rerender = () => renderHistory(workouts, onOpenWorkout, onDeleteWorkout, onLogDay);

  renderCalendar(workouts, rerender);
  byId("historyHeading").textContent =
    selectedDate === null ? "All workouts" : longDate(selectedDate);
  byId("showAllButton").hidden = selectedDate === null;
  byId("showAllButton").onclick = () => {
    clearSelectedDate();
    rerender();
  };

  const list = byId("historyList");
  list.replaceChildren(...shown.map((workout) => workoutRow(workout, onOpenWorkout, onDeleteWorkout)));
  byId("historyHint").hidden = shown.length === 0;
  byId("historyEmpty").hidden = shown.length > 0;
  byId("historyEmpty").textContent = emptyMessage(selectedDate);

  const logDayButton = byId("logDayButton");
  logDayButton.hidden = !canLogForDay(selectedDate);
  if (canLogForDay(selectedDate)) {
    byId("logDayText").textContent = `Log a workout for ${shortDay(selectedDate)}`;
    logDayButton.onclick = () => onLogDay(selectedDate);
  }
}
