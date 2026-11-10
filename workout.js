import { formatDate, todayIso } from "./dates.js";
import {
  button,
  byId,
  confirmAction,
  detailRow,
  el,
  fieldRow,
  fieldText,
  fillContainer,
  focusField,
  icon,
  insetList,
  scrollToTop,
  setHeader,
  showToast,
} from "./dom.js";
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
import { summarize } from "./history-row.js";
import { restoreGuidedState, runGuidedWorkout } from "./player.js";
import { workoutSummary } from "./records.js";
import { computeXp } from "./stats.js";
import { clearDraft, clearGuidedRun, loadGuidedRun, loadUnit, saveDraft, saveGuidedRun, saveUnit } from "./storage.js";

const DEFAULT_WORKOUT_NAME = "Workout";
const DEFAULT_REST_SECONDS = 60;
const MAX_SUGGESTIONS = 4;
const DETAILS_SECTION = "details";

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

// With `autoStart` (used when picking a saved workout), the screen first lists the
// exercises, and the guided workout begins when "Begin workout" is tapped. With `resumeGuided`, a guided workout that was running when the app was closed
// opens again, paused where it left off, if its saved position still fits this workout.
export function openWorkout(workout, isNew, handlers, { kind = "log", autoStart = false, resumeGuided = false } = {}) {
  const step = autoStart ? "preview" : kind === "routine" && isNew ? "name" : "build";
  session = { workout, isNew, isDirty: false, handlers, kind, step, renaming: false, fromReview: false, isAddingExercise: false, isDetailsOpen: false, openExerciseId: undefined };
  guidedRun = null;
  render();
  if (!autoStart && resumeGuided) {
    const resumeFrom = restoreGuidedState(loadGuidedRun(), workout);
    if (resumeFrom) startGuidedWorkout(resumeFrom);
    else clearGuidedRun();
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

// Asks before throwing anything away. A running guided workout is not thrown away: it is
// paused and kept where it is, so Resume brings it back. A new logged workout needs no
// question either: it stays saved as a draft. Resolves true if it is fine to leave this screen.
export async function confirmLeaveWorkout() {
  const isOnlyCopy = !session.isNew || isRoutine();
  if (isOnlyCopy && session.isDirty) {
    if (!(await confirmAction("Discard your changes to this workout?", "Discard changes"))) return false;
  }
  if (guidedRun?.isRunning()) guidedRun.suspend();
  else guidedRun?.stop();
  guidedRun = null;
  return true;
}

async function goBack() {
  if (session.step === "preview") {
    session.handlers.onClose();
    return;
  }
  if (session.step === "build" && session.fromReview) {
    session.step = "review";
    render();
    scrollToTop("workout");
    return;
  }
  if (await confirmLeaveWorkout()) session.handlers.onClose();
}

// Leaving the preview starts the workout; it only becomes an unfinished workout (the
// Resume card) from here, so backing out of the preview leaves nothing behind.
function beginFromPreview() {
  saveDraft(session.workout);
  session.step = "build";
  startGuidedWorkout();
}

function startEditing() {
  session.step = "build";
  render();
  scrollToTop("workout");
}

function startRename() {
  session.step = "name";
  session.renaming = true;
  render();
}

function addExercise(name, type) {
  const restSeconds = type === "cardio" ? 0 : DEFAULT_REST_SECONDS;
  const exercise = { id: newId(), name, type, restSeconds, sets: [] };
  addSet(exercise);
  session.workout.exercises.push(exercise);
  session.openExerciseId = exercise.id;
  session.isAddingExercise = false;
  markChanged();
  render();
}

// Adds a set that starts from last time's matching set (or the set before it).
function addSet(exercise) {
  const last = lastPerformance(pastWorkouts(), exercise.name, session.workout.id);
  exercise.sets.push(nextSetDefaults(exercise.type, last?.sets, exercise.sets));
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
  if (session.openExerciseId === exercise.id) session.openExerciseId = undefined;
  markChanged();
  render();
}

function parseNumber(rawValue) {
  const value = rawValue === "" ? null : Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Runs the workout as it is on screen (unsaved numbers included); when it ends
// the log screen comes back so the user can review and save.
function startGuidedWorkout(resumeFrom = null) {
  const hasLoggedSet = session.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => isSetFilled(exercise.type, set)));
  if (!hasLoggedSet) {
    showToast("Add an exercise and fill in at least one set first.");
    return;
  }
  scrollToTop("workout");
  guidedRun = runGuidedWorkout(byId("workoutContent"), session.workout, loadUnit(), () => {
    guidedRun = null;
    session.step = "review";
    session.fromReview = true;
    render();
    scrollToTop("workout");
  }, { resumeFrom, onProgress: (state) => (state === null ? clearGuidedRun() : saveGuidedRun(state)) });
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

function backHeader(title, end = [], onBack = goBack) {
  setHeader("workout", { title, onBack, end });
}

// A saved workout's title is its name, with a pencil to rename it. The unit button
// switches every weight on the screen between lb and kg.
function renderBuildHeader(unit) {
  const title = isRoutine() ? session.workout.name : session.isNew ? "Log workout" : "Edit workout";
  backHeader(title, [
    isRoutine()
      ? el("ion-button", { "aria-label": "Rename this workout", onclick: startRename }, icon("edit"))
      : null,
    el("ion-button", {
      class: "unit-toggle",
      text: unit,
      "aria-label": `Weight unit is ${unit}. Tap to switch.`,
      onclick: toggleUnit,
    }),
  ]);
}

// The first step of a new saved workout, and the rename screen: just a name field.
function renderNameStep() {
  const { workout } = session;
  const nameInput = el("ion-input", {
    label: "What's this workout called?",
    "label-placement": "stacked",
    type: "text",
    maxlength: "40",
    placeholder: "Push day, Leg day, Morning run…",
    value: workout.name,
  });
  const confirmName = () => {
    const name = fieldText(nameInput).trim();
    if (name === "") {
      showToast("Give this workout a name first.");
      focusField(nameInput);
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
  backHeader(session.renaming ? "Rename workout" : "New saved workout", [], goBackFromName);
  byId("workoutContent").replaceChildren(
    el("form", {
      onsubmit: (event) => {
        event.preventDefault();
        confirmName();
      },
    },
    insetList(fieldRow(nameInput)),
    button("primary", { type: "submit", text: "Continue" })));
  focusField(nameInput);
}

// The name and date of a logged workout, folded away so the sets stay near the top. The
// summary line shows what is currently set; tapping it opens the fields. A saved workout
// shows its name as the title instead.
function renderDetails() {
  if (isRoutine()) return null;
  const { workout } = session;
  const summaryText = () => `${workout.name.trim() || DEFAULT_WORKOUT_NAME} · ${formatDate(workout.date)}`;
  const summaryLabel = el("ion-label", { text: summaryText() });
  const nameInput = el("ion-input", {
    label: "Workout name",
    class: "value-end",
    type: "text",
    maxlength: "40",
    placeholder: "Push day, Leg day…",
    value: workout.name,
    onIonInput: (event) => {
      workout.name = fieldText(event.target);
      summaryLabel.textContent = summaryText();
      markChanged();
    },
  });
  const dateInput = el("ion-input", {
    label: "Date",
    class: "value-end",
    type: "date",
    max: todayIso(),
    value: workout.date,
    onIonInput: (event) => {
      workout.date = fieldText(event.target) || todayIso();
      summaryLabel.textContent = summaryText();
      markChanged();
    },
  });
  const group = el("ion-accordion-group", {
    class: "details",
    value: session.isDetailsOpen ? DETAILS_SECTION : undefined,
    onIonChange: (event) => {
      // The fields inside send the same event when they change; only the fold itself counts.
      if (event.target === group) session.isDetailsOpen = event.detail.value === DETAILS_SECTION;
    },
  },
  el("ion-accordion", { value: DETAILS_SECTION },
    el("ion-item", { slot: "header", lines: "none" },
      summaryLabel,
      el("ion-note", { slot: "end", text: "Name and date" })),
    el("ion-list", { slot: "content", lines: "none" }, fieldRow(nameInput), fieldRow(dateInput))));
  return group;
}

function setFieldLabel(field, unit) {
  return field.usesWeightUnit ? `${field.label} (${unit})` : field.label;
}

// Only one exercise shows its sets at a time; the others fold into a single line. Until one
// is picked, the first is open. `null` means the person folded them all.
function openExercise() {
  const { openExerciseId, workout } = session;
  if (openExerciseId === null) return null;
  return workout.exercises.find((exercise) => exercise.id === openExerciseId) ?? workout.exercises[0] ?? null;
}

function toggleExercise(exercise) {
  session.openExerciseId = openExercise() === exercise ? null : exercise.id;
  render();
}

function setCountText(exercise) {
  const count = exercise.sets.length;
  return `${EXERCISE_TYPES[exercise.type].label} · ${count} ${count === 1 ? "set" : "sets"}`;
}

function renderExerciseHead(exercise, isOpen) {
  return el("div", { class: "exercise-head" },
    el("button", {
      class: "exercise-toggle",
      type: "button",
      "aria-expanded": String(isOpen),
      "aria-label": `${exercise.name}, ${setCountText(exercise)}. ${isOpen ? "Tap to fold." : "Tap to open."}`,
      onclick: () => toggleExercise(exercise),
    },
    el("span", { class: "exercise-title" },
      el("h3", { text: exercise.name }),
      el("p", { class: "muted", text: setCountText(exercise) })),
    icon("forward")),
    isOpen
      ? el("button", {
        class: "icon-button",
        type: "button",
        "aria-label": `Remove ${exercise.name}`,
        onclick: () => removeExercise(exercise),
      }, icon("close"))
      : null);
}

// Each open exercise is a grid: set number, what you did last time in that set, then one
// box per number. A box turns lime when it beats the same box last time.
function renderSetRow(exercise, set, index, lastSet, unit) {
  const fields = EXERCISE_TYPES[exercise.type].fields;
  const inputs = fields.map((field) => {
    const lastValue = lastSet?.[field.key];
    const isBetter = (value) => Number.isFinite(lastValue) && Number.isFinite(value) && value > lastValue;
    const input = el("input", {
      class: `number-input${isBetter(set[field.key]) ? " is-better" : ""}`,
      type: "number",
      inputmode: field.step === "1" || field.step === "5" ? "numeric" : "decimal",
      min: "0",
      step: field.step,
      value: set[field.key] ?? "",
      "aria-label": `${setFieldLabel(field, unit)}, set ${index + 1}`,
      onInput: (event) => {
        set[field.key] = parseNumber(event.target.value);
        input.classList.toggle("is-better", isBetter(set[field.key]));
        markChanged();
      },
    });
    return input;
  });
  return el("div", { class: "set-grid set-row", style: `--fields: ${fields.length}` },
    el("span", { class: "set-number", text: String(index + 1) }),
    el("span", { class: "set-last", text: lastSet && isSetFilled(exercise.type, lastSet) ? describeSet(exercise.type, lastSet, unit) : "—" }),
    ...inputs,
    el("button", {
      class: "icon-button",
      type: "button",
      "aria-label": `Remove set ${index + 1} of ${exercise.name}`,
      onclick: () => removeSet(exercise, index),
    }, icon("close")));
}

function renderSetHeader(exercise, unit) {
  const fields = EXERCISE_TYPES[exercise.type].fields;
  return el("div", { class: "set-grid set-header", "aria-hidden": "true", style: `--fields: ${fields.length}` },
    el("span", { text: "Set" }),
    el("span", { text: "Last" }),
    ...fields.map((field) => el("span", { text: setFieldLabel(field, unit) })),
    el("span"));
}

function renderExercise(exercise, unit) {
  if (openExercise() !== exercise) {
    return el("section", { class: "card exercise is-folded" }, renderExerciseHead(exercise, false));
  }
  const last = lastPerformance(pastWorkouts(), exercise.name, session.workout.id);
  return el("section", { class: "card exercise is-open" },
    renderExerciseHead(exercise, true),
    exercise.sets.length > 0 ? renderSetHeader(exercise, unit) : null,
    ...exercise.sets.map((set, index) => renderSetRow(exercise, set, index, last?.sets[index], unit)),
    el("ion-button", {
      class: "add-set",
      fill: "clear",
      size: "small",
      onclick: () => {
        addSet(exercise);
        markChanged();
        render();
        const rows = byId("workoutContent").querySelectorAll(".exercise.is-open .set-row");
        rows[rows.length - 1]?.querySelector("input")?.focus();
      },
    }, icon("plus", "start"), "Set"),
    el("label", { class: "rest-row" },
      el("span", { text: "Rest between sets (seconds)" }),
      el("input", {
        class: "number-input",
        type: "number",
        inputmode: "numeric",
        min: "0",
        step: "5",
        value: exercise.restSeconds ?? "",
        onInput: (event) => {
          exercise.restSeconds = parseNumber(event.target.value);
          markChanged();
        },
      })));
}

function openAddExercise() {
  session.isAddingExercise = true;
  session.openExerciseId = null;
  render();
  focusField(byId("workoutContent").querySelector(".add-exercise ion-input"));
}

// Exercises you have done or that the app knows whose name contains what was typed, with
// names that start with it first.
function suggestNames(typed, knownNames) {
  const query = typed.trim().toLowerCase();
  if (query === "") return [];
  const matches = knownNames.filter((name) => name.toLowerCase().includes(query) && name.toLowerCase() !== query);
  const startsWithQuery = (name) => name.toLowerCase().startsWith(query);
  return [...matches.filter(startsWithQuery), ...matches.filter((name) => !startsWithQuery(name))]
    .slice(0, MAX_SUGGESTIONS);
}

// An "Add exercise" button below the exercises. It opens the form, which closes again once
// an exercise is added. With no exercises yet the form is open from the start.
function renderAddExercise() {
  const hasExercises = session.workout.exercises.length > 0;
  if (hasExercises && !session.isAddingExercise) {
    return button("secondary", { class: "add-exercise-button", onclick: openAddExercise }, icon("plus", "start"), "Add exercise");
  }
  const knownNames = exerciseNames(pastWorkouts());
  const typeChoice = el("ion-segment", { "aria-label": "Exercise type", value: "strength" },
    ...Object.entries(EXERCISE_TYPES).map(([key, type]) =>
      el("ion-segment-button", { value: key }, el("ion-label", { text: type.label }))));
  const suggestions = el("ion-list", { class: "suggestions", lines: "none", "aria-label": "Matching exercises" });

  // Typing shows matching exercises to tap, and picks the type of one the app already knows.
  const onNameTyped = () => {
    const typed = fieldText(nameInput);
    const knownType = exerciseTypeFor(typed, pastWorkouts());
    if (knownType) typeChoice.value = knownType;
    suggestions.replaceChildren(...suggestNames(typed, knownNames).map((name) =>
      el("ion-item", {
        button: "true",
        detail: "false",
        onclick: () => addExercise(name, exerciseTypeFor(name, pastWorkouts()) ?? typeChoice.value),
      }, el("ion-label", { text: name }))));
  };
  const nameInput = el("ion-input", {
    type: "text",
    maxlength: "40",
    autocomplete: "off",
    placeholder: "Exercise name (e.g. Squat)",
    "aria-label": "Exercise name",
    onIonInput: onNameTyped,
  });

  return el("form", {
    class: "card add-exercise",
    onsubmit: (event) => {
      event.preventDefault();
      const name = fieldText(nameInput).trim();
      if (!name) {
        showToast("Type an exercise name first.");
        focusField(nameInput);
        return;
      }
      const knownName = knownNames.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
      addExercise(knownName ?? name, typeChoice.value);
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
    el("div", { class: "filled-field" }, nameInput),
    suggestions,
    typeChoice,
    button("primary", { type: "submit" }, icon("plus", "start"), "Add exercise"));
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
  return el("div", { class: "button-stack action-bar" },
    startsGuided
      ? button("secondary", { onclick: () => startGuidedWorkout() }, icon("play", "start"), "Start guided workout")
      : null,
    startsGuided
      ? el("p", { class: "muted button-note", text: "One set at a time, with rest timers" })
      : null,
    button("primary", { text: primaryText, onclick: finishWorkout }),
    button("text", { color: "danger", text: secondaryText, onclick: discardOrDeleteWorkout }));
}

// The big name of the workout with one line under it, at the top of the review and preview.
function renderHero(detail) {
  return el("div", { class: "hero" },
    el("h1", { class: "hero-title", text: session.workout.name.trim() || DEFAULT_WORKOUT_NAME }),
    el("p", { class: "muted", text: detail }));
}

// A read-only look at the finished workout, as it will be saved, with an Edit button for
// fixing anything that is wrong.
function renderReview() {
  const unit = loadUnit();
  const cleaned = cleanWorkout(session.workout);
  const summary = workoutSummary(cleaned, []);
  const stat = (label, value) => el("div", { class: "stat-card" },
    el("span", { class: "muted", text: label }),
    el("strong", { text: value }));

  const exerciseLists = cleaned.exercises.flatMap((exercise) => [
    el("h2", { class: "section-title", text: exercise.name }),
    insetList(...exercise.sets.map((set, position) =>
      detailRow(`Set ${position + 1}`, describeSet(exercise.type, set, unit)))),
  ]);

  backHeader("Review workout", [el("ion-button", { onclick: startEditing }, icon("edit", "start"), "Edit")]);
  fillContainer(
    byId("workoutContent"),
    renderHero(formatDate(session.workout.date)),
    cleaned.exercises.length > 0
      ? el("div", { class: "stat-cards" },
        stat("Exercises", String(summary.exerciseCount)),
        stat("Sets", String(summary.setCount)),
        stat(`${unit} lifted`, summary.volume.toLocaleString()))
      : el("section", { class: "card" },
        el("p", { class: "empty", text: "Nothing is logged yet. Tap Edit to add your sets." })),
    ...exerciseLists,
    el("div", { class: "button-stack action-bar" },
      button("primary", { text: "Finish workout", onclick: finishWorkout }),
      button("text", { color: "danger", text: "Discard workout", onclick: discardOrDeleteWorkout })));
}

// The exercises of a saved workout, shown before its first set begins.
function renderPreview() {
  const unit = loadUnit();
  const cleaned = cleanWorkout(session.workout);
  const rows = cleaned.exercises.map((exercise) => {
    const count = exercise.sets.length;
    return detailRow(exercise.name, `${count} ${count === 1 ? "set" : "sets"} · ${describeSet(exercise.type, exercise.sets[0], unit)}`);
  });
  backHeader("Get ready");
  fillContainer(
    byId("workoutContent"),
    renderHero(summarize(cleaned)),
    el("p", { class: "guide", text: "Look over today's exercises, then tap Begin workout." }),
    insetList(...rows),
    el("div", { class: "button-stack action-bar" },
      button("primary", { text: "Begin workout", onclick: beginFromPreview })));
}

function render() {
  if (session.step === "preview") {
    renderPreview();
    return;
  }
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
  renderBuildHeader(unit);
  fillContainer(
    byId("workoutContent"),
    el("p", { class: "guide", text: guidanceText() }),
    renderDetails(),
    ...exercises,
    renderAddExercise(),
    renderActionBar());
}
