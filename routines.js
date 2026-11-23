import { WEEKDAY_NAMES } from "./dates.js";
import { byId, el, listRow } from "./dom.js";
import { summarize } from "./history-row.js";
import { weekOf } from "./plan.js";

// One tappable row for a plan; `actionText` says what tapping does.
function routineRow(routine, actionText, onTap) {
  return listRow({
    title: routine.name,
    detail: summarize(routine),
    sideBottom: actionText,
    label: `${actionText} ${routine.name}`,
    onTap: () => onTap(routine),
  });
}

// The first word of a name, short enough to fit in a day cell ("Push day" becomes "Push").
function shortName(name) {
  return name.trim().split(/\s+/)[0];
}

// One week, Sunday first, with the workout planned for each day. A dot marks days you
// already trained. `onPickDay(weekday)` is called when a day is tapped.
function renderWeek(routines, schedule, workouts, today, onPickDay) {
  const trainedDates = new Set(workouts.map((workout) => workout.date));
  const days = weekOf(today).map((day) => {
    const routine = routines.find((item) => item.id === schedule[day.weekday]);
    const classes = ["week-day"];
    if (day.isToday) classes.push("is-today");
    if (routine) classes.push("is-planned");
    const dayNumber = Number(day.iso.slice(8));
    const plan = routine ? routine.name : "rest day";
    return el("button", {
      class: classes.join(" "),
      type: "button",
      "aria-label": `${WEEKDAY_NAMES[day.weekday]} ${dayNumber}: ${plan}. Tap to change.`,
      onclick: () => onPickDay(day.weekday),
    },
    el("span", { class: "week-letter", text: WEEKDAY_NAMES[day.weekday][0] }),
    el("span", { class: "week-number", text: String(dayNumber) }),
    el("span", { class: "week-plan", text: routine ? shortName(routine.name) : "–" }),
    trainedDates.has(day.iso) ? el("span", { class: "week-done", "aria-hidden": "true" }) : null);
  });
  byId("weekStrip").replaceChildren(...days);
}

// The "Plans" tab: this week's plan, plus build, edit and delete plans. The week only
// shows once there is a plan to put in it.
export function renderRoutines(routines, { schedule, workouts, today, onPickDay, onEdit, onCreate }) {
  renderWeek(routines, schedule, workouts, today, onPickDay);
  byId("weekHeading").hidden = routines.length === 0;
  byId("weekCard").hidden = routines.length === 0;
  byId("routineList").replaceChildren(...routines.map((routine) => routineRow(routine, "Edit", onEdit)));
  byId("routineHeading").hidden = routines.length === 0;
  byId("routineEmpty").hidden = routines.length > 0;
  byId("newRoutineButton").onclick = onCreate;
  byId("createFromRoutinesButton").onclick = onCreate;
}

// What "Start something else" on Home offers: every plan except the one Home already shows,
// then an empty workout and an activity. Each option is { label, value }, where value is
// { kind: "routine", routine }, { kind: "empty" } or { kind: "activity" }.
export function startMenuOptions(routines, featuredId = null) {
  return [
    ...routines
      .filter((routine) => routine.id !== featuredId)
      .map((routine) => ({ label: routine.name, value: { kind: "routine", routine } })),
    { label: "Empty workout", value: { kind: "empty" } },
    { label: "Run, sport or other activity", value: { kind: "activity" } },
  ];
}
