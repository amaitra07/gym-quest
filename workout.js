import { formatDate, todayIso } from "./dates.js";
import { byId, confirmAction, el, fillContainer, icon, showToast } from "./dom.js";
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
import { runGuidedWorkout } from "./player.js";
import { workoutSummary } from "./records.js";
import { computeXp } from "./stats.js";
import { clearDraft, loadUnit, saveDraft, saveUnit } from "./storage.js";

const DEFAULT_WORKOUT_NAME = "Workout";
const DEFAULT_REST_SECONDS = 60;

// The workout being edited: { workout, isNew, isDirty, handlers, kind, step, renaming, fromReview, isAddingExercise }.
// `kind` is "log" for a workout being logged or edited from history, or "routine" for a
// saved workout (a reusable template with no date). A new logged workout is saved as a
// draft after every change; anything else is edited as a copy and only replaces the
// original when saved. A new saved workout starts on the "name" step (just a name field),
// then moves to the "build" step where exercises are added, with the name as the title.
// After a guided workout, a logged workout opens on the read-only "review" step first;
// "Edit" there switches to "build", and Back from that returns to the review.
let session = null;

// The running guided workout, if any (see player.js).
let guidedRun = null;

export function createWorkout() {
  return { id: newId(), createdAt: Date.now(), name: "", date: todayIso(), exercises: [] };
}

const isRoutine = () => session.kind === "routine";

// With `autoStart`, the guided workout begins straight away (used when picking a saved workout).
export function openWorkout(workout, isNew, handlers, { kind = "log", autoStart = false } = {}) {
  const step = kind === "routine" && isNew ? "name" : "build";
  session = { workout, isNew, isDirty: false, handlers, kind, step, renaming: false, fromReview: false, isAddingExercise: false, isDetailsOpen: false };
  guidedRun = null;
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
  if (session.step === "build" && session.fromReview) {
    session.step = "review";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (await confirmLeaveWorkout()) session.handlers.onClose();
}

function startEditing() {
  session.step = "build";
  render();
  window.scrollTo(0, 0);
}

function startRename() {
  session.step = "name";
  session.renaming = true;
  render();
}

function addExercise(name, type) {
  const restSeconds = type === "cardio" ? 0 : DEFAULT_REST_SECONDS;
  const exercise = { id: newId(), name, type, restSeconds, sets: [] };
  addSet(exercise, false);
  session.workout.exercises.push(exercise);
  session.isAddingExercise = false;
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
    session.step = "review";
    session.fromReview = true;
    render();
    window.scrollTo(0, 0);
  });
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

// A saved workout's title is its name, with a pencil to rename it.
function renderTitle() {
  if (!isRoutine()) {
    return el("h2", { class: "screen-title", text: session.isNew ? "Log workout" : "Edit workout" });
  }
  return el("div", { class: "title-group" },
    el("h2", { class: "screen-title", text: session.workout.name }),
    el("button", {
      class: "icon-button",
      type: "button",
      "aria-label": "Rename this workout",
      onclick: startRename,
    }, icon("edit")));
}

function renderTopBar(unit) {
  return el("div", { class: "top-bar" },
    el("button", { class: "back-button", type: "button", onclick: goBack }, icon("back"), "Back"),
    renderTitle(),
    el("button", {
      class: "unit-button",
      type: "button",
      text: unit,
      "aria-label": `Weight unit is ${unit}. Tap to switch.`,
      onclick: toggleUnit,
    }));
}

// The first step of a new saved workout, and the rename screen: just a name field.
function renderNameStep() {
  const { workout } = session;
  const nameInput = el("input", {
    class: "text-input",
    type: "text",
    maxlength: "40",
    placeholder: "Push day, Leg day, Morning run…",
    value: workout.name,
  });
  const confirmName = () => {
    const name = nameInput.value.trim();
    if (name === "") {
      showToast("Give this workout a name first.");
      nameInput.focus();
      return;
    }
    if (name !== workout.name) {
      workout.name = name;
      markChanged();
    }
    session.step = "build";
    session.renaming = false;
    render();
  };
  // Backing out of a rename returns to the exercises; backing out of a new workout leaves.
  const goBackFromName = () => {
    if (!session.renaming) {
      goBack();
      return;
    }
    session.step = "build";
    session.renaming = false;
    render();
  };
  byId("workoutScreen").replaceChildren(
    el("div", { class: "top-bar" },
      el("button", { class: "back-button", type: "button", onclick: goBackFromName }, icon("back"), "Back"),
      el("h2", { class: "screen-title", text: session.renaming ? "Rename workout" : "New saved workout" })),
    el("form", {
      class: "panel details",
      onsubmit: (event) => {
        event.preventDefault();
        confirmName();
      },
    },
    el("label", { class: "field" }, el("span", { text: "What's this workout called?" }), nameInput),
    el("button", { class: "primary-button", type: "submit", text: "Continue" })));
  nameInput.focus();
}

// The name and date of a logged workout, folded away so the sets stay near the top. The
// summary line shows what is currently set; tapping it opens the fields. A saved workout
// shows its name as the title instead.
function renderDetails() {
  if (isRoutine()) return null;
  const { workout } = session;
  const summaryText = () => `${workout.name.trim() || DEFAULT_WORKOUT_NAME} · ${formatDate(workout.date)}`;
  const summaryLabel = el("span", { class: "details-summary-text", text: summaryText() });
  const nameInput = el("input", {
    class: "text-input",
    type: "text",
    maxlength: "40",
    placeholder: "Push day, Leg day, Morning run…",
    value: workout.name,
    onInput: (event) => {
      workout.name = event.target.value;
      summaryLabel.textContent = summaryText();
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
      summaryLabel.textContent = summaryText();
      markChanged();
    },
  });
  return el("details", {
    class: "panel details",
    ...(session.isDetailsOpen ? { open: "" } : {}),
    onToggle: (event) => {
      session.isDetailsOpen = event.target.open;
    },
  },
  el("summary", {}, summaryLabel, el("span", { class: "details-summary-action", text: "Name and date" })),
  el("div", { class: "details-fields" },
    el("label", { class: "field" }, el("span", { text: "Workout name" }), nameInput),
    el("label", { class: "field" }, el("span", { text: "Date" }), dateInput)));
}

// The labels sit in one header above all of an exercise's sets, so each row is just the
// set number and its boxes. The boxes keep their own labels for screen readers.
function setFieldLabel(field, unit) {
  return field.usesWeightUnit ? `${field.label} (${unit})` : field.label;
}

function renderSetHeader(exercise, unit) {
  const fields = EXERCISE_TYPES[exercise.type].fields;
  return el("div", { class: "set-grid set-header", "aria-hidden": "true", style: `--fields: ${fields.length}` },
    el("span", { text: "Set" }),
    ...fields.map((field) => el("span", { text: setFieldLabel(field, unit) })),
    el("span"));
}

function renderSetRow(exercise, set, index, unit) {
  const fields = EXERCISE_TYPES[exercise.type].fields;
  const inputs = fields.map((field) => el("input", {
    class: "number-input",
    type: "number",
    inputmode: field.step === "1" ? "numeric" : "decimal",
    min: "0",
    step: field.step,
    value: set[field.key] ?? "",
    "aria-label": `${setFieldLabel(field, unit)}, set ${index + 1}`,
    onInput: (event) => updateSetValue(set, field.key, event.target.value),
  }));
  return el("div", { class: "set-grid set-row", style: `--fields: ${fields.length}` },
    el("span", { class: "set-number", text: String(index + 1) }),
    ...inputs,
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
    exercise.sets.length > 0 ? renderSetHeader(exercise, unit) : null,
    ...exercise.sets.map((set, index) => renderSetRow(exercise, set, index, unit)),
    el("button", {
      class: "secondary-button",
      type: "button",
      text: "+ Add set",
      onclick: () => addSet(exercise),
    }),
    el("label", { class: "rest-row" },
      el("span", { text: "Rest between sets (seconds)" }),
      el("input", {
        class: "number-input",
        type: "number",
        inputmode: "numeric",
        min: "0",
        step: "5",
        value: exercise.restSeconds ?? "",
        onInput: (event) => updateRest(exercise, event.target.value),
      })));
}

function openAddExercise() {
  session.isAddingExercise = true;
  render();
  byId("workoutScreen").querySelector(".add-exercise input")?.focus();
}

// A small plus button below the exercises. It opens the form, which closes again once an
// exercise is added. With no exercises yet the form is open from the start.
function renderAddExercise() {
  const hasExercises = session.workout.exercises.length > 0;
  if (hasExercises && !session.isAddingExercise) {
    return el("button", {
      class: "add-exercise-button",
      type: "button",
      "aria-label": "Add an exercise",
      onclick: openAddExercise,
    }, icon("plus"));
  }
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
    el("div", { class: "exercise-head" },
      el("h3", { text: "Add an exercise" }),
      hasExercises
        ? el("button", {
          class: "icon-button",
          type: "button",
          "aria-label": "Cancel adding an exercise",
          onclick: () => {
            session.isAddingExercise = false;
            render();
          },
        }, icon("close"))
        : null),
    nameOptions,
    nameInput,
    typeSelect,
    el("button", { class: "secondary-button", type: "submit", text: "+ Add exercise" }));
}

// One short line saying what to do next on the screen, which changes as the workout fills in.
function guidanceText() {
  const hasExercises = session.workout.exercises.length > 0;
  if (isRoutine()) {
    return hasExercises
      ? "Set the reps for each set. Tap Save workout when you're done."
      : "Add your first exercise below.";
  }
  if (!session.isNew) return "Fix anything that's wrong, then tap Save changes.";
  return hasExercises
    ? "Fill in each set as you do it. When you're done, tap Finish workout."
    : "Add your first exercise below, for example Squat.";
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
      }, icon("play"), el("span", { class: "button-text" },
        "Start workout",
        el("span", { class: "button-note", text: "One set at a time, with rest timers" })))
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

// A read-only look at the finished workout, as it will be saved, with an Edit button for
// fixing anything that is wrong.
function renderReview() {
  const unit = loadUnit();
  const cleaned = cleanWorkout(session.workout);
  const summary = workoutSummary(cleaned, []);
  const name = session.workout.name.trim() || DEFAULT_WORKOUT_NAME;
  const stat = (label, value) => el("div", { class: "record-card" },
    el("span", { class: "muted", text: label }),
    el("strong", { text: value }));

  const exerciseCards = cleaned.exercises.map((exercise) => el("section", { class: "panel" },
    el("h3", { text: exercise.name }),
    el("p", { class: "muted", text: EXERCISE_TYPES[exercise.type].label }),
    el("ul", { class: "history" }, ...exercise.sets.map((set, position) => el("li", { class: "session-row" },
      el("span", { class: "session-date", text: `Set ${position + 1}` }),
      el("span", { class: "session-sets", text: describeSet(exercise.type, set, unit) }))))));

  fillContainer(
    byId("workoutScreen"),
    el("div", { class: "top-bar" },
      el("button", { class: "back-button", type: "button", onclick: goBack }, icon("back"), "Back"),
      el("h2", { class: "screen-title", text: "Review workout" }),
      el("button", { class: "pill-button", type: "button", onclick: startEditing }, icon("edit"), "Edit")),
    el("section", { class: "panel" },
      el("h2", { class: "review-name", text: name }),
      el("p", { class: "muted", text: formatDate(session.workout.date) })),
    cleaned.exercises.length > 0
      ? el("div", { class: "record-cards" },
        stat("Exercises", String(summary.exerciseCount)),
        stat("Sets", String(summary.setCount)),
        stat(`${unit} lifted`, summary.volume.toLocaleString()))
      : el("section", { class: "panel" },
        el("p", { class: "empty", text: "Nothing is logged yet. Tap Edit to add your sets." })),
    ...exerciseCards,
    el("div", { class: "action-bar" },
      el("button", { class: "primary-button", type: "button", text: "Finish workout", onclick: finishWorkout }),
      el("button", { class: "text-button", type: "button", text: "Discard workout", onclick: discardOrDeleteWorkout })));
}

function render() {
  if (session.step === "review") {
    renderReview();
    return;
  }
  if (isRoutine() && session.step === "name") {
    renderNameStep();
    return;
  }
  const unit = loadUnit();
  const exercises = session.workout.exercises.map((exercise) => renderExercise(exercise, unit));
  fillContainer(
    byId("workoutScreen"),
    renderTopBar(unit),
    el("p", { class: "guide", text: guidanceText() }),
    renderDetails(),
    ...exercises,
    renderAddExercise(),
    renderActionBar());
}
