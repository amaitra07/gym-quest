import { toIsoDate, todayIso } from "./dates.js";
import { byId, el } from "./dom.js";
import { workoutRow } from "./history-row.js";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Calendar position survives re-renders, so saving an edit returns to the same day.
const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = null;

// One entry per week-row cell: an ISO date, or null for the blanks before the
// 1st and after the last day of the month.
export function monthCells(year, month) {
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toIsoDate(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function workoutsByDate(workouts) {
  const byDate = new Map();
  for (const workout of workouts) {
    byDate.set(workout.date, [...(byDate.get(workout.date) ?? []), workout]);
  }
  return byDate;
}

function longDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function changeMonth(delta, rerender) {
  const next = new Date(viewYear, viewMonth + delta, 1);
  viewYear = next.getFullYear();
  viewMonth = next.getMonth();
  selectedDate = null;
  rerender();
}

function renderDetails(byDate, onOpenWorkout) {
  const details = byId("calendarDetails");
  details.replaceChildren();
  if (selectedDate === null) {
    details.append(el("p", { class: "empty", text: "Tap a day to see what you did." }));
    return;
  }
  details.append(el("h3", { class: "calendar-day-title", text: longDate(selectedDate) }));
  const dayWorkouts = byDate.get(selectedDate) ?? [];
  if (dayWorkouts.length === 0) {
    details.append(el("p", { class: "empty", text: "No workout logged this day." }));
    return;
  }
  const list = el("ul", { class: "history" });
  list.append(...dayWorkouts.map((workout) => workoutRow(workout, onOpenWorkout)));
  details.append(list);
}

export function renderCalendar(workouts, onOpenWorkout) {
  const rerender = () => renderCalendar(workouts, onOpenWorkout);
  const byDate = workoutsByDate(workouts);
  const todayDate = todayIso();

  byId("calendarTitle").textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const showingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  byId("calendarNext").disabled = showingCurrentMonth;
  byId("calendarPrev").onclick = () => changeMonth(-1, rerender);
  byId("calendarNext").onclick = () => changeMonth(1, rerender);

  const grid = byId("calendarGrid");
  grid.replaceChildren(
    ...WEEKDAY_LABELS.map((label) => el("span", { class: "calendar-weekday", text: label })),
  );
  for (const isoDate of monthCells(viewYear, viewMonth)) {
    if (isoDate === null) {
      grid.append(el("span", { class: "calendar-blank" }));
      continue;
    }
    const count = byDate.get(isoDate)?.length ?? 0;
    const classes = ["calendar-day"];
    if (count > 0) classes.push("has-workout");
    if (isoDate === todayDate) classes.push("is-today");
    if (isoDate === selectedDate) classes.push("is-selected");
    const workoutWord = count === 1 ? "workout" : "workouts";
    grid.append(
      el("button", {
        class: classes.join(" "),
        type: "button",
        "aria-label": `${longDate(isoDate)}, ${count === 0 ? "no workouts" : `${count} ${workoutWord}`}`,
        "aria-pressed": String(isoDate === selectedDate),
        text: String(Number(isoDate.slice(8))),
        onclick: () => {
          selectedDate = isoDate;
          rerender();
        },
      }),
    );
  }
  renderDetails(byDate, onOpenWorkout);
}
