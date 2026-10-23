import { toIsoDate, todayIso } from "./dates.js";
import { byId, el } from "./dom.js";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Calendar position survives re-renders, so saving an edit returns to the same day.
const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = null;

export function getSelectedDate() {
  return selectedDate;
}

export function clearSelectedDate() {
  selectedDate = null;
}

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

export function longDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function changeMonth(delta, onChange) {
  const next = new Date(viewYear, viewMonth + delta, 1);
  viewYear = next.getFullYear();
  viewMonth = next.getMonth();
  selectedDate = null;
  onChange();
}

// Draws the month grid. Tapping a day (or changing month) updates the selection and calls
// onChange, which should redraw the calendar along with anything that depends on the selection.
export function renderCalendar(workouts, onChange) {
  const byDate = workoutsByDate(workouts);
  const todayDate = todayIso();

  byId("calendarTitle").textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const showingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  byId("calendarNext").disabled = showingCurrentMonth;
  byId("calendarPrev").onclick = () => changeMonth(-1, onChange);
  byId("calendarNext").onclick = () => changeMonth(1, onChange);

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
          selectedDate = isoDate === selectedDate ? null : isoDate;
          onChange();
        },
      }),
    );
  }
}
