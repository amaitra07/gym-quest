import { todayIso } from "./dates.js";
import { button, byId, confirmAction, el, fieldRow, fieldText, insetList, setHeader } from "./dom.js";
import { newId } from "./exercises.js";
import { computeXp } from "./stats.js";
import { loadUnit } from "./storage.js";

// An activity (a run, a pickup game, yoga…) is saved in the same list as workouts, with
// `kind: "activity"` and no exercises, so History, the calendar and the streak count it.
// Shape: { id, createdAt, kind, name, date, minutes, distance, distanceUnit, notes, xp, exercises }.
const OTHER = "Other";
const MAX_MINUTES = 1440;
const MAX_NAME_LENGTH = 40;
const MAX_NOTES_LENGTH = 200;

// `hasDistance` activities also ask how far you went.
const ACTIVITIES = [
  { name: "Run", hasDistance: true },
  { name: "Walk", hasDistance: true },
  { name: "Bike", hasDistance: true },
  { name: "Swim", hasDistance: true },
  { name: "Hike", hasDistance: true },
  { name: "Basketball", hasDistance: false },
  { name: "Soccer", hasDistance: false },
  { name: "Tennis", hasDistance: false },
  { name: "Yoga", hasDistance: false },
  { name: OTHER, hasDistance: true },
];

export function isActivity(workout) {
  return workout.kind === "activity";
}

export function createActivity() {
  return {
    id: newId(),
    createdAt: Date.now(),
    kind: "activity",
    name: "",
    date: todayIso(),
    minutes: null,
    distance: null,
    distanceUnit: distanceUnitFor(loadUnit()),
    notes: "",
    exercises: [],
  };
}

// Pounds-and-feet users get miles; kilogram users get kilometres.
export function distanceUnitFor(weightUnit) {
  return weightUnit === "kg" ? "km" : "mi";
}

const OTHER_CHOICE = ACTIVITIES.at(-1);

// Returns a sentence saying what to fix, or null when the activity can be saved.
export function activityProblem(activity) {
  if (activity.name.trim() === "") return "Choose an activity, or type a name for “Other”.";
  if (!(activity.minutes > 0) || activity.minutes > MAX_MINUTES) return "Enter how many minutes it took (1 to 1440).";
  if (activity.distance !== null && !(activity.distance > 0)) return "Distance must be more than 0, or left empty.";
  return null;
}

// "30 min · 3 mi" for the History rows and the Home tile.
export function activitySummary(activity) {
  const parts = [`${activity.minutes} min`];
  if (activity.distance) parts.push(`${activity.distance} ${activity.distanceUnit}`);
  return parts.join(" · ");
}

// What gets stored: trimmed text, a date that is not in the future, and its XP.
export function cleanActivity(activity) {
  const cleaned = {
    ...activity,
    name: activity.name.trim(),
    notes: activity.notes.trim(),
    date: activity.date > todayIso() ? todayIso() : activity.date,
  };
  cleaned.xp = computeXp(cleaned);
  return cleaned;
}

// The "Log an activity" screen. `handlers` are { onSave(activity, isNew), onDelete(id), onClose }.
export function openActivity(activity, isNew, handlers) {
  const state = { activity, errorText: "" };

  const numberOrNull = (text) => (text.trim() === "" ? null : Number(text));

  const save = () => {
    const problem = activityProblem(state.activity);
    if (problem !== null) {
      state.errorText = problem;
      render();
      return;
    }
    handlers.onSave(cleanActivity(state.activity), isNew);
  };

  const remove = async () => {
    if (await confirmAction(`Delete this ${state.activity.name.trim() || "activity"}?`, "Delete")) {
      handlers.onDelete(state.activity.id);
    }
  };

  const chooseActivity = (choice) => {
    // Picking a built-in activity names it; "Other" clears the name so it can be typed.
    state.activity.name = choice.name === OTHER ? "" : choice.name;
    state.chosenOther = choice.name === OTHER;
    state.errorText = "";
    render();
  };

  const render = () => {
    const { activity: current } = state;
    // Nothing is selected until a new activity gets a name; a typed name means "Other".
    const selected = state.chosenOther ? OTHER_CHOICE : ACTIVITIES.find((choice) => choice.name === current.name);

    const choices = ACTIVITIES.map((choice) => el("ion-button", {
      class: choice === selected ? "choice primary-action" : "choice secondary-action",
      shape: "round",
      "aria-pressed": String(choice === selected),
      text: choice.name,
      onclick: () => chooseActivity(choice),
    }));

    const nameField = state.chosenOther
      ? el("ion-input", {
        label: "What did you do?",
        "label-placement": "stacked",
        type: "text",
        maxlength: String(MAX_NAME_LENGTH),
        placeholder: "Climbing, pickleball, dance…",
        value: current.name,
        onIonInput: (event) => {
          current.name = fieldText(event.target);
        },
      })
      : null;

    const durationField = el("ion-input", {
      label: "Minutes",
      class: "value-end",
      type: "number",
      inputmode: "decimal",
      min: "1",
      max: String(MAX_MINUTES),
      step: "1",
      placeholder: "30",
      value: current.minutes ?? "",
      onIonInput: (event) => {
        current.minutes = numberOrNull(fieldText(event.target));
      },
    });

    const hasDistance = selected?.hasDistance ?? false;
    const distanceField = hasDistance
      ? el("ion-input", {
        label: `Distance (${current.distanceUnit})`,
        class: "value-end",
        type: "number",
        inputmode: "decimal",
        min: "0",
        step: "0.1",
        placeholder: "Optional",
        value: current.distance ?? "",
        onIonInput: (event) => {
          current.distance = numberOrNull(fieldText(event.target));
        },
      })
      : null;

    const dateField = el("ion-input", {
      label: "Date",
      class: "value-end",
      type: "date",
      max: todayIso(),
      value: current.date,
      onIonInput: (event) => {
        current.date = fieldText(event.target) || todayIso();
      },
    });

    const notesField = el("ion-input", {
      label: "Notes, optional",
      "label-placement": "stacked",
      type: "text",
      maxlength: String(MAX_NOTES_LENGTH),
      placeholder: "Won 21–18, felt strong…",
      value: current.notes,
      onIonInput: (event) => {
        current.notes = fieldText(event.target);
      },
    });

    setHeader("activity", { title: isNew ? "Log an activity" : "Edit activity", onBack: handlers.onClose });
    byId("activityContent").replaceChildren(
      el("form", {
        class: "activity-form",
        onsubmit: (event) => {
          event.preventDefault();
          save();
        },
      },
      el("p", { class: "guide", text: "Pick what you did, then say how long it took." }),
      el("div", { class: "choices", role: "group", "aria-label": "Activity" }, ...choices),
      insetList(
        nameField ? fieldRow(nameField) : null,
        fieldRow(durationField),
        distanceField ? fieldRow(distanceField) : null,
        fieldRow(dateField),
        fieldRow(notesField)),
      state.errorText ? el("p", { class: "form-error", role: "alert", text: state.errorText }) : null,
      button("primary", { type: "submit", text: isNew ? "Save activity" : "Save changes" }),
      isNew ? null : button("text", { color: "danger", text: "Delete activity", onclick: remove })));
  };

  state.chosenOther = activity.name !== "" && !ACTIVITIES.some((choice) => choice.name === activity.name);
  render();
}
