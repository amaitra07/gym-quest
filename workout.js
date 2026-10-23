import { formatDate, todayIso } from "./dates.js";
import { byId, confirmAction, el, icon, showToast } from "./dom.js";
import {
  EXERCISE_TYPES,
  cleanWorkout,
  describeSet,
  exerciseNames,
  exerciseTypeFor,
  isSetFilled,
  lastPerformance,
  newId,
  nextSetDefaults,
} from "./exercises.js";
import { WORKOUT_KINDS, describeTarget, generateWorkout } from "./generator.js";
import { runGuidedWorkout } from "./player.js";
import { computeXp } from "./stats.js";
import { clearDraft, loadUnit, saveDraft, saveUnit } from "./storage.js";

const DEFAULT_WORKOUT_NAME = "Workout";
const DEFAULT_REST_SECONDS = 60;

// The workout being edited: { workout, isNew, isDirty, handlers, kind }.
// `kind` is "log" for a workout being logged or edited from history, or "routine" for a
// saved workout (a reusable template with no date). A new logged workout is saved as a
// draft after every change; anything else is edited as a copy and only replaces the
// original when saved.
let session = null;

// The running guided workout, if any (see player.js).
let guidedRun = null;

// The generator panel's choice and its current suggestion (not saved with the workout).
let generatorKind = "push";
let generated = null;

export function createWorkout() {
  return { id: newId(), createdAt: Date.now(), name: "", date: todayIso(), exercises: [] };
}

const isRoutine = () => session.kind === "routine";

// With `autoStart`, the guided workout begins straight away (used when picking a saved workout).
export function openWorkout(workout, isNew, handlers, { kind = "log", autoStart = false } = {}) {
  session = { workout, isNew, isDirty: false, handlers, kind };
  guidedRun = null;
  generated = null;
  render();
  if (autoStart) {
    saveDraft(workout);
    startGuidedWorkout();
  }
}

function markChanged() {
  session.isDirty = true;
  if (session.isNew && !isRoutine()) saveDraft(session.workout);
}

function pastWorkouts() {
  return session.handlers.getWorkouts();
}

/* ---------- Actions ---------- */

// Asks before throwing anything away, then stops the guided workout if one is running.
// A new logged workout needs no question: it stays saved as a draft. Resolves true if it
// is fine to leave this screen.
export async function confirmLeaveWorkout() {
  if (guidedRun?.isRunning()) {
    const message = "Leave now? The guided workout will end, but your workout stays as you logged it.";
    if (!(await confirmAction(message, "Leave"))) return false;
  }
  const isOnlyCopy = !session.isNew || isRoutine();
  if (isOnlyCopy && session.isDirty) {
    if (!(await confirmAction("Discard your changes to this workout?", "Discard changes"))) return false;
  }
  guidedRun?.stop();
  guidedRun = null;
  return true;
}

async function goBack() {
  if (await confirmLeaveWorkout()) session.handlers.onClose();
}

function addExercise(name, type) {
  const restSeconds = type === "cardio" ? 0 : DEFAULT_REST_SECONDS;
  const exercise = { id: newId(), name, type, restSeconds, sets: [] };
  addSet(exercise, false);
  session.workout.exercises.push(exercise);
  markChanged();
  render();
}

function addSet(exercise, shouldRender = true) {
  const last = lastPerformance(pastWorkouts(), exercise.name, session.workout.id);
  exercise.sets.push(nextSetDefaults(exercise.type, last?.sets, exercise.sets));
  if (!shouldRender) return;
  markChanged();
  render();
}

function removeSet(exercise, index) {
  exercise.sets.splice(index, 1);
  markChanged();
  render();
}

async function removeExercise(exercise) {
  const hasData = exercise.sets.some((set) => isSetFilled(exercise.type, set));
  if (hasData && !(await confirmAction(`Remove ${exercise.name} and its sets?`, "Remove"))) return;
  session.workout.exercises = session.workout.exercises.filter((item) => item !== exercise);
  markChanged();
  render();
}

function parseNumber(rawValue) {
  const value = rawValue === "" ? null : Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateSetValue(set, key, rawValue) {
  set[key] = parseNumber(rawValue);
  markChanged();
}

function updateRest(exercise, rawValue) {
  exercise.restSeconds = parseNumber(rawValue);
  markChanged();
}

// Runs the workout as it is on screen (unsaved numbers included); when it ends
// the log screen comes back so the user can review and save.
function startGuidedWorkout() {
  const hasLoggedSet = session.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => isSetFilled(exercise.type, set)));
  if (!hasLoggedSet) {
    showToast("Add an exercise and fill in at least one set first.");
    return;
  }
  window.scrollTo(0, 0);
  guidedRun = runGuidedWorkout(byId("workoutScreen"), session.workout, loadUnit(), () => {
    guidedRun = null;
    render();
    window.scrollTo(0, 0);
    showToast("Review your workout, then save it.");
  });
}

function generate() {
  generated = { kind: generatorKind, exercises: generateWorkout(generatorKind) };
  render();
}

// Adds the suggested exercises with their sets prefilled: weights come from the
// last time each exercise was done, reps/minutes/seconds from the suggestion.
function useGeneratedWorkout() {
  const { workout } = session;
  for (const suggestion of generated.exercises) {
    const last = lastPerformance(pastWorkouts(), suggestion.name, workout.id);
    const sets = [];
    for (let index = 0; index < suggestion.sets; index += 1) {
      sets.push({ ...nextSetDefaults(suggestion.type, last?.sets, sets), ...suggestion.target });
    }
    workout.exercises.push({
      id: newId(),
      name: suggestion.name,
      type: suggestion.type,
      restSeconds: suggestion.rest,
      sets,
    });
  }
  if (!workout.name.trim()) workout.name = WORKOUT_KINDS[generated.kind].label;
  generated = null;
  markChanged();
  render();
  showToast("Workout added. Fill in your weights and adjust anything you like.");
}

function saveRoutine() {
  const cleaned = cleanWorkout(session.workout);
  const name = cleaned.name.trim();
  if (!name) {
    showToast("Give this workout a name first.");
    return;
  }
  if (cleaned.exercises.length === 0) {
    showToast("Add at least one exercise with a number in it first.");
    return;
  }
  session.handlers.onSave({ ...cleaned, name }, session.isNew);
}

function finishWorkout() {
  if (isRoutine()) {
    saveRoutine();
    return;
  }
  const cleaned = cleanWorkout(session.workout);
  if (cleaned.exercises.length === 0) {
    showToast("Log at least one set with a number in it before finishing.");
    return;
  }
  cleaned.name = cleaned.name.trim() || DEFAULT_WORKOUT_NAME;
  cleaned.date = cleaned.date > todayIso() ? todayIso() : cleaned.date;
  cleaned.xp = computeXp(cleaned);
  session.handlers.onSave(cleaned, session.isNew);
}

async function discardOrDeleteWorkout() {
  const { workout, isNew, handlers } = session;
  if (isNew) {
    const message = "Discard this workout? Nothing you entered will be saved.";
    if (!(await confirmAction(message, "Discard workout"))) return;
    if (!isRoutine()) clearDraft();
    handlers.onClose();
  } else {
    const message = isRoutine()
      ? `Delete the saved workout "${workout.name}"? Workouts you already logged are not affected.`
      : `Delete "${workout.name}"? Its XP will be removed too.`;
    if (!(await confirmAction(message, "Delete workout"))) return;
    handlers.onDelete(workout.id);
  }
}

function toggleUnit() {
  saveUnit(loadUnit() === "lb" ? "kg" : "lb");
  render();
}

/* ---------- Rendering ---------- */

function screenTitle() {
  if (isRoutine()) return session.isNew ? "New saved workout" : "Edit saved workout";
  return session.isNew ? "Log workout" : "Edit workout";
}

function renderTopBar(unit) {
  return el("div", { class: "top-bar" },
    el("button", { class: "back-button", type: "button", onclick: goBack }, icon("back"), "Back"),
    el("h2", { class: "screen-title", text: screenTitle() }),
    el("button", {
      class: "unit-button",
      type: "button",
      text: unit,
      "aria-label": `Weight unit is ${unit}. Tap to switch.`,
      onclick: toggleUnit,
    }));
}

function renderDetails() {
  const { workout } = session;
  const nameInput = el("input", {
    class: "text-input",
    type: "text",
    maxlength: "40",
    placeholder: "Push day, Leg day, Morning run…",
    value: workout.name,
    onInput: (event) => {
      workout.name = event.target.value;
      markChanged();
    },
  });
  const dateInput = el("input", {
    class: "text-input",
    type: "date",
    max: todayIso(),
    value: workout.date,
    onInput: (event) => {
      workout.date = event.target.value || todayIso();
      markChanged();
    },
  });
  return el("section", { class: "panel details" },
    el("label", { class: "field" }, el("span", { text: "Workout name" }), nameInput),
    isRoutine() ? null : el("label", { class: "field" }, el("span", { text: "Date" }), dateInput));
}

function renderGenerator() {
  const kindSelect = el("select", {
    class: "text-input",
    "aria-label": "Workout type",
    onchange: (event) => {
      generatorKind = event.target.value;
    },
  }, ...Object.entries(WORKOUT_KINDS).map(([key, kind]) =>
    el("option", { value: key, text: kind.label })));
  kindSelect.value = generatorKind;

  const preview = generated
    ? el("div", { class: "generated" },
      el("ul", { class: "generated-list" },
        ...generated.exercises.map((suggestion) => el("li", {},
          el("span", { text: suggestion.name }),
          el("span", { class: "generated-target", text: describeTarget(suggestion) })))),
      el("button", {
        class: "primary-button",
        type: "button",
        text: "Use this workout",
        onclick: useGeneratedWorkout,
      }))
    : null;

  return el("section", { class: "panel generator" },
    el("h3", { text: "Need ideas? Generate a workout" }),
    kindSelect,
    el("button", {
      class: "secondary-button",
      type: "button",
      text: generated ? "Generate another" : "Generate",
      onclick: generate,
    }),
    preview);
}

function renderSetRow(exercise, set, index, unit) {
  const fields = EXERCISE_TYPES[exercise.type].fields.map((field) => {
    const label = field.usesWeightUnit ? `${field.label} (${unit})` : field.label;
    return el("label", { class: "set-field" },
      el("span", { text: label }),
      el("input", {
        class: "number-input",
        type: "number",
        inputmode: field.step === "1" ? "numeric" : "decimal",
        min: "0",
        step: field.step,
        value: set[field.key] ?? "",
        onInput: (event) => updateSetValue(set, field.key, event.target.value),
      }));
  });
  return el("div", { class: "set-row" },
    el("span", { class: "set-number", text: `Set ${index + 1}` }),
    ...fields,
    el("button", {
      class: "icon-button",
      type: "button",
      "aria-label": `Remove set ${index + 1} of ${exercise.name}`,
      onclick: () => removeSet(exercise, index),
    }, icon("close")));
}

function renderExercise(exercise, unit) {
  const last = lastPerformance(pastWorkouts(), exercise.name, session.workout.id);
  const lastText = last
    ? `Last time (${formatDate(last.date)}): ${last.sets.map((set) => describeSet(exercise.type, set, unit)).join(", ")}`
    : null;
  return el("section", { class: "panel exercise" },
    el("div", { class: "exercise-head" },
      el("div", {},
        el("h3", { text: exercise.name }),
        el("p", { class: "muted", text: EXERCISE_TYPES[exercise.type].label })),
      el("button", {
        class: "icon-button",
        type: "button",
        "aria-label": `Remove ${exercise.name}`,
        onclick: () => removeExercise(exercise),
      }, icon("close"))),
    lastText ? el("p", { class: "hint", text: lastText }) : null,
    el("label", { class: "field rest-field" },
      el("span", { text: "Rest between sets (seconds)" }),
      el("input", {
        class: "number-input",
        type: "number",
        inputmode: "numeric",
        min: "0",
        step: "5",
        value: exercise.restSeconds ?? "",
        onInput: (event) => updateRest(exercise, event.target.value),
      })),
    ...exercise.sets.map((set, index) => renderSetRow(exercise, set, index, unit)),
    el("button", {
      class: "secondary-button",
      type: "button",
      text: "+ Add set",
      onclick: () => addSet(exercise),
    }));
}

function renderAddExercise() {
  const nameInput = el("input", {
    class: "text-input",
    type: "text",
    maxlength: "40",
    list: "exerciseNames",
    autocomplete: "off",
    placeholder: "Exercise name (e.g. Squat)",
    "aria-label": "Exercise name",
  });
  const typeSelect = el("select", { class: "text-input", "aria-label": "Exercise type" },
    ...Object.entries(EXERCISE_TYPES).map(([key, type]) => el("option", { value: key, text: type.label })));
  const nameOptions = el("datalist", { id: "exerciseNames" },
    ...exerciseNames(pastWorkouts()).map((name) => el("option", { value: name })));

  nameInput.addEventListener("input", () => {
    const knownType = exerciseTypeFor(nameInput.value, pastWorkouts());
    if (knownType) typeSelect.value = knownType;
  });

  return el("form", {
    class: "panel add-exercise",
    onsubmit: (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        showToast("Type an exercise name first.");
        nameInput.focus();
        return;
      }
      const knownName = exerciseNames(pastWorkouts()).find(
        (candidate) => candidate.toLowerCase() === name.toLowerCase(),
      );
      addExercise(knownName ?? name, typeSelect.value);
    },
  },
    el("h3", { text: "Add an exercise" }),
    nameOptions,
    nameInput,
    typeSelect,
    el("button", { class: "secondary-button", type: "submit", text: "+ Add exercise" }));
}

function renderActionBar() {
  const { isNew } = session;
  const startsGuided = isNew && !isRoutine();
  const primaryText = isRoutine() ? "Save workout" : isNew ? "Finish workout" : "Save changes";
  const secondaryText = isNew ? (isRoutine() ? "Discard" : "Discard workout") : "Delete workout";
  return el("div", { class: "action-bar" },
    startsGuided
      ? el("button", {
        class: "secondary-button start-guided",
        type: "button",
        onclick: startGuidedWorkout,
      }, icon("play"), "Start workout")
      : null,
    el("button", {
      class: "primary-button",
      type: "button",
      text: primaryText,
      onclick: finishWorkout,
    }),
    el("button", {
      class: "text-button",
      type: "button",
      text: secondaryText,
      onclick: discardOrDeleteWorkout,
    }));
}

function render() {
  const unit = loadUnit();
  const exercises = session.workout.exercises.map((exercise) => renderExercise(exercise, unit));
  byId("workoutScreen").replaceChildren(
    renderTopBar(unit),
    renderDetails(),
    session.isNew ? renderGenerator() : null,
    ...exercises,
    renderAddExercise(),
    renderActionBar());
}
