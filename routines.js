import { byId, el } from "./dom.js";
import { summarize } from "./history-row.js";

// One tappable row for a saved workout; `actionText` says what tapping does.
function routineRow(routine, actionText, onTap) {
  return el("li", {},
    el("button", {
      class: "history-item",
      type: "button",
      "aria-label": `${actionText} ${routine.name}`,
      onclick: () => onTap(routine),
    },
    el("span", { class: "history-main" },
      el("span", { class: "history-name", text: routine.name }),
      el("span", { class: "muted", text: summarize(routine) })),
    el("span", { class: "history-side" },
      el("span", { class: "xp", text: actionText }))));
}

// The "Workouts" tab: build, edit and delete saved workouts.
export function renderRoutines(routines, { onEdit, onCreate }) {
  byId("routineList").replaceChildren(...routines.map((routine) => routineRow(routine, "Edit", onEdit)));
  byId("routineEmpty").hidden = routines.length > 0;
  byId("newRoutineButton").onclick = onCreate;
}

// The "Log" tab: pick a saved workout to start it, resume an unfinished one, or start empty.
export function renderLogPicker(routines, draft, { onStart, onResume, onEmpty, onCreate }) {
  const resume = byId("resumeCard");
  resume.hidden = draft === null;
  if (draft !== null) {
    resume.replaceChildren(
      el("h2", { text: "Unfinished workout" }),
      el("button", {
        class: "primary-button",
        type: "button",
        text: `Resume ${draft.name.trim() || "your workout"}`,
        onclick: onResume,
      }));
  }

  byId("pickerList").replaceChildren(...routines.map((routine) => routineRow(routine, "Start", onStart)));
  byId("pickerHeading").hidden = routines.length === 0;
  byId("pickerEmpty").hidden = routines.length > 0;
  byId("emptyWorkoutButton").onclick = onEmpty;
  byId("createFromPickerButton").onclick = onCreate;
}
