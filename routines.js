import { WEEKDAY_NAMES } from "./dates.js";
import { button, byId, el, listRow } from "./dom.js";
import { summarize } from "./history-row.js";
import { weekOf } from "./plan.js";

// One tappable row for a saved workout; `actionText` says what tapping does.
function routineRow(routine, actionText, onTap) {
  return listRow({
    title: routine.name,
    detail: summarize(routine),
    sideBottom: actionText,
    label: `${actionText} ${routine.name}`,
    onTap: () => onTap(routine),
  });
}

// A Log tab row for a saved workout, with two ways to do it: "Guided" runs the timers,
// and "Log" opens the set grid to type in what you did and save it.
function pickerRow(routine, onStart, onLog) {
  const choice = (text, fill, onTap) => el("ion-button", {
    size: "small", fill, class: "picker-choice", text,
    "aria-label": `${text} ${routine.name}`, onclick: () => onTap(routine),
  });
  return el("ion-item", { detail: "false" },
    el("ion-label", {}, el("h2", { text: routine.name }), el("p", { text: summarize(routine) })),
    el("div", { slot: "end", class: "picker-choices" },
      choice("Guided", "solid", onStart),
      choice("Log", "outline", onLog)));
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

// The "Workouts" tab: this week's plan, plus build, edit and delete saved workouts.
export function renderRoutines(routines, { schedule, workouts, today, onPickDay, onEdit, onCreate, onStarterPlan }) {
  renderWeek(routines, schedule, workouts, today, onPickDay);
  byId("routineList").replaceChildren(...routines.map((routine) => routineRow(routine, "Edit", onEdit)));
  byId("routineHeading").hidden = routines.length === 0;
  byId("routineEmpty").hidden = routines.length > 0;
  byId("newRoutineButton").onclick = onCreate;
  byId("createFromRoutinesButton").onclick = onCreate;
  byId("starterFromRoutinesButton").onclick = onStarterPlan;
}

// The "Log" tab: pick a saved workout to run it guided or log it by hand, resume an unfinished one, or start empty.
export function renderLogPicker(routines, draft, { onStart, onLog, onResume, onEmpty, onActivity, onCreate, onStarterPlan }) {
  const resume = byId("resumeCard");
  resume.hidden = draft === null;
  if (draft !== null) {
    resume.replaceChildren(
      el("h2", { class: "section-title", text: "Unfinished workout" }),
      button("primary", { text: `Resume ${draft.name.trim() || "your workout"}`, onclick: onResume }));
  }

  byId("pickerList").replaceChildren(...routines.map((routine) => pickerRow(routine, onStart, onLog)));
  byId("pickerHeading").hidden = routines.length === 0;
  byId("pickerEmpty").hidden = routines.length > 0;
  byId("emptyWorkoutButton").onclick = onEmpty;
  byId("activityButton").onclick = onActivity;
  byId("createFromPickerButton").onclick = onCreate;
  byId("starterFromPickerButton").onclick = onStarterPlan;
}
