import { createStopwatch, formatClock } from "./clock.js";
import { beep, finalSecondsLeft } from "./countdown.js";
import { button, confirmAction, detailRow, el, icon, insetList, numberField, openSheet, setHeader } from "./dom.js";
import { EXERCISE_TYPES, fieldUnit, isSetFilled, keepPreviousWeight, repTargetText, suggestionText } from "./exercises.js";
import { howToFor, showHowTo } from "./how-to.js";
import { FEELINGS, feelNote, nextWeightFromFeel, startingPoint } from "./find-weight.js";
import { burstFrom } from "./motion.js";

const TICK_MS = 250;
// How long the set and rest backgrounds take to fade into each other (matches styles.css).
const PHASE_FADE_MS = 1200;

// One entry per set that was filled in, in the order they will be done.
export function buildSteps(workout) {
  const steps = [];
  for (const exercise of workout.exercises) {
    const sets = exercise.sets.filter((set) => isSetFilled(exercise.type, set));
    sets.forEach((set, position) => {
      steps.push({ exercise, set, setNumber: position + 1, setCount: sets.length });
    });
  }
  return steps;
}

// Where to go after finishing the set at `index`: a rest when the same exercise has sets
// left, the "Up next" screen before a new exercise, or straight on when the exercise has no
// rest time. Both pauses count down the finished exercise's rest. Returns null when the
// workout is over.
export function afterSet(steps, index) {
  const next = steps[index + 1];
  if (!next) return null;
  if (!(steps[index].exercise.restSeconds > 0)) return { index: index + 1, phase: "work" };
  const sameExercise = next.exercise === steps[index].exercise;
  return { index: index + 1, phase: sameExercise ? "rest" : "next" };
}

// The phases a guided run can be in: a set, a rest between sets, or "Up next" between
// exercises.
const PHASES = ["work", "rest", "next"];

// The set finished most recently before `index`, which "Last set" lets you fix; -1 if none.
// `completed` holds the indexes of finished sets.
export function lastFinishedIndex(completed, index) {
  let last = -1;
  for (const position of completed) {
    if (position < index && position > last) last = position;
  }
  return last;
}

// How much one tap of − or + changes each number when fixing a set.
function stepSize(fieldKey, unit) {
  if (fieldKey === "weight") return unit === "kg" ? 2.5 : 5;
  if (fieldKey === "distance") return 0.1;
  if (fieldKey === "seconds") return 5;
  return 1;
}

// Sets one number of a set, rounded to two decimals. The number a set needs in order to
// count (reps, minutes or seconds) never goes below 1; the others clear when they reach 0.
export function setSetValue(set, type, fieldKey, value) {
  const isRequired = EXERCISE_TYPES[type].requiredField === fieldKey;
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  if (isRequired) set[fieldKey] = Math.max(1, rounded);
  else set[fieldKey] = rounded > 0 ? rounded : null;
  return set[fieldKey];
}

// Moves one number of a set up (`direction` 1) or down (-1) by one step.
export function nudgeSetValue(set, type, fieldKey, direction, unit) {
  const current = Number.isFinite(set[fieldKey]) ? set[fieldKey] : 0;
  return setSetValue(set, type, fieldKey, current + direction * stepSize(fieldKey, unit));
}

// Copies `set`'s numbers to the sets of the same exercise still to come after `index`
// (finished ones keep what was done). Used by "Use for the rest of this exercise".
export function copyToLaterSets(steps, index, completed) {
  const { exercise, set } = steps[index];
  steps.forEach((step, position) => {
    if (position <= index || step.exercise !== exercise || completed.has(position)) return;
    for (const field of EXERCISE_TYPES[exercise.type].fields) step.set[field.key] = set[field.key] ?? null;
  });
}

// Adds a copy of `set` to `exercise`, straight after its last set.
export function addSetLike(exercise, set) {
  const copy = { ...set };
  delete copy.done;
  exercise.sets.push(copy);
  return copy;
}

// After sets were added or removed, the steps are rebuilt. This finds where things moved:
// the finished sets, and the set to stand on (`currentSet`, or else the first unfinished one).
export function remapPositions(newSteps, finishedSets, currentSet) {
  const completed = new Set();
  for (const set of finishedSets) {
    const position = newSteps.findIndex((step) => step.set === set);
    if (position !== -1) completed.add(position);
  }
  let index = newSteps.findIndex((step) => step.set === currentSet);
  if (index === -1) index = newSteps.findIndex((step, position) => !completed.has(position));
  return { index, completed };
}

// The first step of a later exercise, or -1 if this is the last exercise.
export function nextExerciseIndex(steps, index) {
  const current = steps[index].exercise;
  return steps.findIndex((step, position) => position > index && step.exercise !== current);
}

// How far through the workout you are. `completed` holds the indexes of the sets you
// finished (skipped sets do not count). Returns the totals plus one entry per exercise,
// in workout order, with its finished and total sets and whether it is the one in progress.
export function progressSummary(steps, completed, currentIndex, finished = false) {
  const byExercise = new Map();
  steps.forEach((step, position) => {
    const entry = byExercise.get(step.exercise) ?? { name: step.exercise.name, done: 0, total: 0, isCurrent: false };
    entry.total += 1;
    if (completed.has(position)) entry.done += 1;
    if (!finished && position === currentIndex) entry.isCurrent = true;
    byExercise.set(step.exercise, entry);
  });
  return {
    done: completed.size,
    total: steps.length,
    exercises: [...byExercise.values()].map((entry) => ({ ...entry, isDone: entry.done === entry.total })),
  };
}

// Timed holds and cardio count down; strength sets wait for "Done with set".
function workDurationSeconds(step) {
  if (step.exercise.type === "timed") return step.set.seconds;
  if (step.exercise.type === "cardio") return step.set.minutes * 60;
  return null;
}

// What a set asks for ("135 lb × 6–8 reps"), or with `asDone` what was done ("135 lb × 7 reps").
function targetText(step, unit, asDone = false) {
  const { type } = step.exercise;
  const { set } = step;
  if (type === "strength") {
    const reps = asDone ? set.reps : repTargetText(set);
    return set.weight ? `${set.weight} ${unit} × ${reps} reps` : `${reps} reps`;
  }
  if (type === "cardio") {
    return set.distance ? `${set.minutes} min · ${set.distance} distance` : `${set.minutes} min`;
  }
  return `${set.seconds} second hold`;
}

function hasRepRange(step) {
  return step.exercise.type === "strength" && step.set.repsTop > 0;
}

function setLabel(step) {
  return `Set ${step.setNumber} of ${step.setCount}`;
}

// This exercise's sets as thin gold segments: done, the one you are on (glowing), and to come.
function setSegments(step) {
  return el("div", { class: "set-segments", role: "img", "aria-label": setLabel(step) },
    ...Array.from({ length: step.setCount }, (_, position) => el("i", {
      class: position + 1 < step.setNumber ? "is-done" : position + 1 === step.setNumber ? "is-now" : "",
    })));
}

// Walks through the workout one set at a time with a total clock and rest
// countdowns. It never changes the workout; `onExit` returns to the log screen.
// Returns { stop, isRunning } so the caller can end it when the user navigates away.
// Checks a saved guided position against the workout it came from. Returns the position to
// pick up from, or null if it belongs to another workout or does not make sense.
export function restoreGuidedState(saved, workout) {
  if (saved === null || typeof saved !== "object" || saved.workoutId !== workout.id) return null;
  const stepCount = buildSteps(workout).length;
  const isStepNumber = (value) => Number.isInteger(value) && value >= 0 && value < stepCount;
  const isDuration = (value) => Number.isFinite(value) && value >= 0;
  const isValid = isStepNumber(saved.index)
    && PHASES.includes(saved.phase)
    && Array.isArray(saved.completed) && saved.completed.every(isStepNumber)
    && isDuration(saved.totalMs) && isDuration(saved.phaseMs);
  return isValid ? saved : null;
}

// `options.resumeFrom` is a position checked by restoreGuidedState: the run then opens
// paused where it left off. `options.onProgress(state)` is called every second with where
// the run has got to, and with null once it is over. `options.onEdit()` is called after the
// person fixes a finished set's numbers, which changes the workout in place.
export function runGuidedWorkout(container, workout, unit, onExit, { resumeFrom = null, onProgress = () => {}, onEdit = () => {} } = {}) {
  let steps = buildSteps(workout);
  const totalClock = createStopwatch(resumeFrom?.totalMs ?? 0);
  const phaseClock = createStopwatch(resumeFrom?.phaseMs ?? 0);
  let index = resumeFrom?.index ?? 0;
  let phase = resumeFrom?.phase ?? "work";
  let paused = resumeFrom !== null;
  let finished = false;
  let stopped = false;
  const completed = new Set(resumeFrom?.completed ?? []);
  let overview = null;
  let howToSheet = null;
  let editSheet = null;
  let totalNode = null;
  let countdownNode = null;
  let wakeLock = null;
  // The last of a rest's final three seconds that beeped, so each beeps once.
  let beepedSecond = null;
  // The set and rest backgrounds live outside the re-drawn screen, so one can fade into
  // the other instead of being swapped.
  const phaseBackground = el("div", { class: "phase-fx", "aria-hidden": "true" },
    el("div", { class: "phase-layer is-work" }),
    el("div", { class: "phase-layer is-rest" }));
  // It sits behind the whole screen, top bar included, so the bar matches the set or rest look.
  (container.closest(".ion-page") ?? container.parentElement)?.prepend(phaseBackground);
  let shownPhase = null;
  // The fraction of sets the progress bar last showed.
  let shownProgress = completed.size / Math.max(steps.length, 1);
  // True while "How many reps?" is showing after Done with set on a set with a rep range.
  let askingReps = false;
  // True while "How did it feel?" is showing, when helping someone find their weight.
  let askingFeel = false;

  const now = () => Date.now();

  function currentCountdownSeconds() {
    if (phase === "rest") return steps[index].exercise.restSeconds;
    // "Up next" waits for as long as the exercise just finished rests between its sets.
    if (phase === "next") return steps[index - 1]?.exercise.restSeconds ?? 0;
    return workDurationSeconds(steps[index]);
  }

  function enterPhase(nextIndex, nextPhase) {
    askingReps = false;
    askingFeel = false;
    index = nextIndex;
    phase = nextPhase;
    beepedSecond = null;
    phaseClock.reset();
    if (!paused) phaseClock.start(now());
    navigator.vibrate?.(150);
    render();
  }

  function finish() {
    finished = true;
    totalClock.pause(now());
    phaseClock.pause(now());
    stop();
    render();
  }

  // A set with a rep range asks how many reps you got, since that decides when to add weight.
  function askReps() {
    askingReps = true;
    render();
  }

  function recordReps(reps) {
    steps[index].set.reps = reps;
    askingReps = false;
    onEdit();
    if (isCoaching(steps[index])) askFeel();
    else completeSet();
  }

  /* ---------- Find your weight ---------- */

  // A strength exercise with no weight yet (and not marked bodyweight) gets coached: a card
  // before the first set, then "How did it feel?" after each set until one feels just right.
  function needsWeight(step) {
    return step.exercise.type === "strength" && !(step.set.weight > 0) && !step.exercise.bodyweight
      && startingPoint(step.exercise.name, unit) !== null;
  }

  function isCoaching(step) {
    return needsWeight(step) || step.exercise.findingWeight === true;
  }

  function afterDone(step) {
    if (hasRepRange(step)) return askReps;
    return isCoaching(step) ? askFeel : completeSet;
  }

  function askFeel() {
    askingFeel = true;
    render();
  }

  // The card in place of the rep target, before a weight has been picked.
  function findWeightCard(step) {
    const start = startingPoint(step.exercise.name, unit);
    return el("div", { class: "find-weight-card" },
      el("p", { class: "find-weight-title", text: "Find your weight" }),
      el("p", { text: start.text }),
      el("p", { class: "muted", text: `Do ${repTargetText(step.set)} reps. The last one or two should be hard, but your form should hold. After the set, say how it felt.` }),
      el("ion-button", {
        class: "how-to-link",
        fill: "clear",
        size: "small",
        text: "I'm using my bodyweight",
        onclick: () => {
          step.exercise.bodyweight = true;
          onEdit();
          render();
        },
      }));
  }

  // After the set: what weight was used, and how it felt. The answer moves the next sets.
  function feelPanel(step) {
    const { exercise, set } = step;
    let used = set.weight > 0 ? set.weight : startingPoint(exercise.name, unit)?.weight ?? 0;
    const value = el("span", { class: "feel-weight-value", text: `${used} ${unit}` });
    const nudge = (direction) => () => {
      used = Math.max(0, nextWeightFromFeel(exercise.name, used, direction > 0 ? "easy" : "hard", unit));
      value.textContent = `${used} ${unit}`;
    };
    const answer = (feeling) => () => {
      set.weight = used;
      const next = nextWeightFromFeel(exercise.name, used, feeling, unit);
      steps.forEach((later, position) => {
        if (position > index && later.exercise === exercise && !completed.has(position)) later.set.weight = next;
      });
      exercise.findingWeight = feeling !== "right";
      exercise.feelNote = feelNote(feeling, next, unit, exercise.name);
      exercise.foundWeight = next;
      askingFeel = false;
      onEdit();
      completeSet();
    };
    return el("div", { class: "feel-panel" },
      el("p", { class: "player-label", text: "Weight used" }),
      el("div", { class: "feel-weight" },
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": "Less weight", onclick: nudge(-1) }, icon("minus")),
        value,
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": "More weight", onclick: nudge(1) }, icon("plus"))),
      el("p", { class: "player-label", text: "How did it feel?" }),
      el("div", { class: "feel-choices" },
        ...FEELINGS.map((feeling) => el("button", {
          class: `feel-choice is-${feeling.value}`,
          type: "button",
          onclick: answer(feeling.value),
        }, el("strong", { text: feeling.label }), el("small", { text: feeling.hint })))));
  }

  // One chip per likely count: a couple below the range up to one above it, top of the range in lime.
  function repChips(step) {
    const { reps, repsTop } = step.set;
    const chips = [];
    for (let count = Math.max(1, reps - 2); count <= repsTop + 1; count += 1) {
      chips.push(el("ion-button", {
        class: `rep-chip${count === repsTop ? " is-top" : ""}`,
        fill: count === repsTop ? "solid" : "outline",
        "aria-label": `${count} reps`,
        onclick: () => recordReps(count),
      }, count === repsTop + 1 ? `${count}+` : String(count)));
    }
    return el("div", { class: "rep-ask" },
      el("p", { class: "player-label", text: "How many reps?" }),
      el("div", { class: "rep-chips" }, ...chips),
      el("ion-button", { class: "how-to-link", fill: "clear", size: "small", text: "Back", onclick: () => {
        askingReps = false;
        render();
      } }));
  }

  function completeSet() {
    burstFrom(container.querySelector(".step-action"));
    completed.add(index);
    steps[index].set.done = true;
    onEdit();
    const next = afterSet(steps, index);
    if (next === null) finish();
    else enterPhase(next.index, next.phase);
  }

  function skipRest() {
    enterPhase(index, "work");
  }

  function skipExercise() {
    const target = nextExerciseIndex(steps, index);
    if (target === -1) finish();
    else enterPhase(target, "work");
  }

  function togglePause() {
    paused = !paused;
    if (paused) {
      totalClock.pause(now());
      phaseClock.pause(now());
    } else {
      totalClock.start(now());
      phaseClock.start(now());
    }
    render();
  }

  async function endEarly() {
    if (!(await confirmAction("End the guided workout now? You can still review and save it.", "End workout"))) return;
    stop();
    onExit();
  }

  function saveProgress() {
    onProgress({
      workoutId: workout.id,
      index,
      phase,
      completed: [...completed],
      totalMs: totalClock.elapsedMs(now()),
      phaseMs: phaseClock.elapsedMs(now()),
    });
  }

  function tick() {
    if (finished || stopped) return;
    saveProgress();
    totalNode.textContent = formatClock(totalClock.elapsedMs(now()) / 1000);
    const seconds = currentCountdownSeconds();
    if (countdownNode && seconds !== null) {
      const remainingMs = seconds * 1000 - phaseClock.elapsedMs(now());
      countdownNode.textContent = formatClock(Math.ceil(remainingMs / 1000));
      if (phase !== "work" && !paused) countDownRestEnd(remainingMs);
      if (remainingMs <= 0 && !paused) completeCountdown();
    }
  }

  // Over a rest's last three seconds: a beep each second, the clock in lime, and a higher
  // beep when the next set starts.
  function countDownRestEnd(remainingMs) {
    const secondsLeft = finalSecondsLeft(remainingMs);
    countdownNode.classList.toggle("is-final", secondsLeft !== null);
    if (secondsLeft !== null && secondsLeft !== beepedSecond) {
      beepedSecond = secondsLeft;
      beep();
    }
    if (remainingMs <= 0) beep(true);
  }

  function completeCountdown() {
    if (phase === "work") completeSet();
    else skipRest();
  }

  const timer = setInterval(tick, TICK_MS);
  // Ends the run. With `keepPlace`, its position stays saved so it can be picked up again.
  function stop(keepPlace = false) {
    stopped = true;
    if (!keepPlace) onProgress(null);
    closeOverview();
    howToSheet?.close();
    editSheet?.close();
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
    // A finished run fades its background out on the done screen instead.
    if (!finished) phaseBackground.remove();
  }
  navigator.wakeLock?.request("screen").then((lock) => {
    wakeLock = lock;
    if (finished) lock.release().catch(() => {});
  }).catch(() => {});

  /* ---------- All exercises sheet ---------- */

  function overviewRow(entry) {
    const dots = Array.from({ length: entry.total }, (_, position) =>
      el("i", { class: position < entry.done ? "set-dot is-done" : "set-dot" }));
    const status = entry.isCurrent ? "Now" : entry.isDone ? "Done" : "";
    return el("li", { class: entry.isCurrent ? "overview-row is-current" : "overview-row" },
      el("span", { class: "overview-main" },
        el("span", { class: "overview-name", text: entry.name }),
        el("span", { class: "set-dots", "aria-hidden": "true" }, ...dots)),
      el("span", { class: "overview-side" },
        el("span", { class: "overview-count", text: `${entry.done} of ${entry.total} ${entry.total === 1 ? "set" : "sets"}` }),
        status ? el("span", { class: entry.isDone ? "overview-status is-done" : "overview-status", text: status }) : null));
  }

  // Redraws the sheet if it is open, so it stays in step as sets are finished.
  function renderOverview() {
    if (overview === null) return;
    const summary = progressSummary(steps, completed, index, finished);
    overview.content.replaceChildren(
      el("p", { class: "muted overview-total", text: `${summary.done} of ${summary.total} sets done` }),
      el("ul", { class: "overview-list" }, ...summary.exercises.map(overviewRow)));
  }

  function closeOverview() {
    overview?.close();
  }

  function openOverview() {
    overview = openSheet("All exercises", () => {
      overview = null;
    });
    renderOverview();
  }

  /* ---------- Rendering ---------- */

  // How many sets are done, as a bar. Tapping it opens the list of all exercises. It is
  // drawn at the last value shown and then moved, so a finished set slides it forward.
  function progressBar() {
    const { done, total } = progressSummary(steps, completed, index, finished);
    const percent = Math.round((done / total) * 100);
    const bar = el("ion-progress-bar", { value: shownProgress, "aria-label": `${percent}% of sets done` });
    if (shownProgress !== done / total) {
      shownProgress = done / total;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.value = shownProgress;
      }));
    }
    return el("button", {
      class: "progress-summary",
      type: "button",
      "aria-label": `${done} of ${total} sets done. Show all exercises.`,
      onclick: openOverview,
    },
    el("span", { class: "progress-row" },
      el("span", { class: "progress-count", text: `${done} of ${total} sets` }),
      el("span", { class: "progress-link" }, "All exercises", icon("forward"))),
    bar);
  }

  // Pause sits in the top-left corner, opposite End, out of the way of the big buttons.
  function pauseButton() {
    return el("ion-button", { onclick: togglePause }, icon(paused ? "play" : "pause", "start"), paused ? "Continue" : "Pause");
  }

  // − / + rows for each number of `set`; `onChanged` runs after every change.
  function stepperRows(exercise, set, onChanged) {
    return EXERCISE_TYPES[exercise.type].fields.map((field) => {
      const input = el("input", {
        class: "number-input",
        type: "number",
        inputmode: "decimal",
        min: "0",
        step: field.step,
        value: set[field.key] ?? "",
        "aria-label": setFieldName(field),
        onChange: (event) => {
          const typed = event.target.value === "" ? 0 : Number(event.target.value);
          event.target.value = setSetValue(set, exercise.type, field.key, typed) ?? "";
          onChanged();
        },
      });
      const nudge = (direction) => () => {
        input.value = nudgeSetValue(set, exercise.type, field.key, direction, unit) ?? "";
        onChanged();
      };
      return el("div", { class: "stepper-row" },
        el("span", { class: "stepper-label", text: field.label }),
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": `Less ${field.label.toLowerCase()}`, onclick: nudge(-1) }, icon("minus")),
        numberField(input, fieldUnit(field, unit)),
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": `More ${field.label.toLowerCase()}`, onclick: nudge(1) }, icon("plus")));
    });
  }

  function openEditSheet(title) {
    editSheet = openSheet(title, () => {
      editSheet = null;
      if (!stopped) render();
    });
    return editSheet;
  }

  // A sheet for fixing the numbers of the set finished last, for when you did less (or
  // more) than planned. Changes are saved as you tap.
  function editLastSet() {
    const position = lastFinishedIndex(completed, index);
    if (position === -1) return;
    const step = steps[position];
    openEditSheet(`${step.exercise.name} · ${setLabel(step)}`).content.append(
      el("p", { class: "guide", text: "Change it to what you actually did. It's saved straight away." }),
      ...stepperRows(step.exercise, step.set, onEdit));
  }

  // After sets were added or removed: rebuild the steps and stand on `currentSet`.
  function rebuildSteps(currentSet) {
    const finishedSets = [...completed].map((position) => steps[position].set);
    steps = buildSteps(workout);
    const moved = remapPositions(steps, finishedSets, currentSet);
    completed.clear();
    for (const position of moved.completed) completed.add(position);
    return moved.index;
  }

  // A sheet listing every set of this exercise: change any of them, add a set, or remove
  // one. A change can also go to the sets after it that are not done yet. The clock keeps
  // going.
  function editExerciseSets() {
    const { exercise } = steps[index];
    const sheet = openEditSheet(exercise.name);
    let forRest = true;
    const fields = EXERCISE_TYPES[exercise.type].fields;
    const restToggle = el("ion-checkbox", {
      class: "rest-toggle",
      "label-placement": "end",
      justify: "start",
      checked: true,
      onIonChange: (event) => {
        forRest = event.detail.checked;
      },
    }, "Changes also go to the sets after it");

    const valueInput = (step, position, field) => numberField(el("input", {
      class: "number-input",
      type: "number",
      inputmode: field.step === "1" || field.step === "5" ? "numeric" : "decimal",
      min: "0",
      step: field.step,
      value: step.set[field.key] ?? "",
      "aria-label": `${setFieldName(field)}, set ${step.setNumber}`,
      onChange: (event) => {
        const typed = event.target.value === "" ? 0 : Number(event.target.value);
        setSetValue(step.set, exercise.type, field.key, typed);
        if (forRest) copyToLaterSets(steps, position, completed);
        onEdit();
        draw();
      },
    }), fieldUnit(field, unit));

    const setRow = (step, position) => {
      const isCurrent = position === index;
      const isDone = completed.has(position);
      const remove = el("button", {
        class: "icon-button",
        type: "button",
        "aria-label": `Remove set ${step.setNumber}`,
        onclick: () => removeSet(position),
      }, icon("close"));
      remove.disabled = steps.length === 1;
      return el("div", { class: `sheet-set-row${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`, style: `--fields: ${fields.length}` },
        el("span", { class: "sheet-set-label" },
          el("strong", { text: String(step.setNumber) }),
          el("small", { text: isCurrent ? "Now" : isDone ? "Done" : "" })),
        ...fields.map((field) => valueInput(step, position, field)),
        remove);
    };

    function draw() {
      const rows = [];
      steps.forEach((step, position) => {
        if (step.exercise === exercise) rows.push(setRow(step, position));
      });
      sheet.content.replaceChildren(
        el("p", { class: "guide", text: "Change any set, before or after you do it. It's saved straight away." }),
        el("div", { class: "sheet-set-row sheet-set-header", "aria-hidden": "true", style: `--fields: ${fields.length}` },
          el("span", { text: "Set" }),
          ...fields.map((field) => el("span", { text: field.label })),
          el("span")),
        ...rows,
        button("secondary", {
          class: "add-set-button",
          onclick: () => {
            const exerciseSteps = steps.filter((step) => step.exercise === exercise);
            addSetLike(exercise, exerciseSteps.at(-1).set);
            index = rebuildSteps(steps[index].set);
            onEdit();
            draw();
          },
        }, icon("plus", "start"), "Add a set"),
        restToggle);
    }

    // Removing the set you are on moves you to the next one; removing another keeps your place.
    function removeSet(position) {
      const removed = steps[position];
      const isCurrent = position === index;
      const standOn = isCurrent ? steps[position + 1]?.set ?? null : steps[index].set;
      exercise.sets.splice(exercise.sets.indexOf(removed.set), 1);
      const nextIndex = rebuildSteps(standOn);
      onEdit();
      if (nextIndex === -1) {
        sheet.close();
        finish();
        return;
      }
      if (isCurrent) {
        enterPhase(nextIndex, "work");
        if (steps[nextIndex].exercise !== exercise) {
          sheet.close();
          return;
        }
      } else {
        index = nextIndex;
      }
      draw();
    }

    draw();
  }



  function setFieldName(field) {
    return field.usesWeightUnit ? `${field.label} (${unit})` : field.label;
  }

  // The big button for the current step. It is switched off while the workout is paused.
  function stepButton(text, onclick) {
    const stepAction = button("primary", { class: "step-action", size: "large", text, onclick });
    stepAction.disabled = paused;
    return stepAction;
  }

  function renderDone() {
    const total = formatClock(totalClock.elapsedMs(now()) / 1000);
    const lines = [];
    for (const exercise of workout.exercises) {
      const done = exercise.sets.filter((set) => isSetFilled(exercise.type, set)).length;
      if (done > 0) lines.push(detailRow(exercise.name, `${done} ${done === 1 ? "set" : "sets"}`));
    }
    return [
      el("p", { class: "player-label", text: "Workout complete" }),
      el("p", { class: "player-countdown", text: total }),
      el("p", { class: "muted player-center", text: "Total time" }),
      insetList(...lines),
      button("primary", { text: "Review and save", onclick: onExit }),
    ];
  }

  // Before an exercise's first set: the weight the app moved you to, with Keep to undo it.
  function suggestionLine(exercise) {
    const { suggestion } = exercise;
    if (!suggestion) return null;
    const range = exercise.sets.find((set) => set.repsTop) ?? exercise.sets[0];
    return el("p", { class: `suggestion-note is-${suggestion.change}` },
      el("span", { text: suggestionText(suggestion, range, unit) }),
      suggestion.from === null
        ? null
        : el("ion-button", {
          class: "suggestion-keep",
          fill: "clear",
          size: "small",
          onclick: () => {
            keepPreviousWeight(exercise);
            onEdit();
            render();
          },
        }, `Keep ${suggestion.from}`));
  }

  // The line under the exercise name ("Set 2 of 4 · 135 lb × 8 reps"), with a pencil:
  // tapping it opens every set of this exercise to change, add or remove.
  function editTarget(text) {
    return el("button", { class: "edit-target", type: "button", "aria-label": `${text}. Change the sets.`, onclick: editExerciseSets },
      el("span", { text }), icon("edit"));
  }

  // "How to do it" for this exercise, and "Last set" to fix the set you just finished.
  function renderLinks(step) {
    const howTo = howToFor(step.exercise.name)
      ? el("ion-button", {
        class: "how-to-link",
        fill: "clear",
        size: "small",
        text: "How to do it",
        onclick: () => {
          howToSheet = showHowTo(step.exercise.name);
        },
      })
      : null;
    const lastPosition = lastFinishedIndex(completed, index);
    const lastSet = lastPosition === -1
      ? null
      : el("ion-button", { class: "how-to-link", fill: "clear", size: "small", onclick: editLastSet },
        icon("edit", "start"), `Last set: ${targetText(steps[lastPosition], unit, true)}`);
    if (howTo === null && lastSet === null) return null;
    return el("div", { class: "player-links" }, howTo, lastSet);
  }

  // Between exercises: the one just finished, then the next one big, with its sets, a
  // countdown of the rest, and "Start now" to begin early.
  function renderUpNext() {
    const step = steps[index];
    const finishedExercise = steps[index - 1].exercise;
    const entry = progressSummary(steps, completed, index).exercises.find((item) => item.name === finishedExercise.name);
    countdownNode = el("p", { class: "player-countdown", text: "" });
    const start = stepButton("Start now", skipRest);
    const actions = [start];
    if (nextExerciseIndex(steps, index) !== -1) {
      const skip = button("text", { class: "next-link", onclick: skipExercise }, "Skip this exercise", icon("arrow", "end"));
      skip.disabled = paused;
      actions.push(skip);
    }
    return [
      el("p", { class: "up-next-done" }, icon("check", "start"),
        entry ? `${finishedExercise.name} done · ${entry.done} of ${entry.total} ${entry.total === 1 ? "set" : "sets"}` : `${finishedExercise.name} done`),
      el("p", { class: "player-label", text: paused ? "Paused" : "Up next" }),
      el("h2", { class: "player-exercise", text: step.exercise.name }),
      editTarget(`${step.setCount} ${step.setCount === 1 ? "set" : "sets"} · ${targetText(step, unit)}`),
      suggestionLine(step.exercise),
      renderLinks(step),
      el("div", { class: "phase-stage" },
        el("span", { class: "breath", "aria-hidden": "true" }),
        countdownNode,
        el("span", { class: "breath-word", "aria-hidden": "true", text: "Get set" })),
      el("div", { class: "button-stack player-actions" }, ...actions),
    ];
  }

  function renderStep() {
    if (phase === "next") return renderUpNext();
    const step = steps[index];
    const hasCountdown = currentCountdownSeconds() !== null;
    const countdown = hasCountdown ? el("p", { class: "player-countdown", text: "" }) : null;
    countdownNode = countdown;
    // A set counted in reps has no clock, so its rep target fills the middle instead.
    // A band of light glides across the gold number each time the spotlight behind it swells.
    const repTarget = !hasCountdown && step.exercise.type === "strength" && step.set.reps
      ? el("p", { class: "player-countdown player-reps" },
        el("span", { class: "rep-number" }, repTargetText(step.set),
          el("span", { class: "rep-glint", "aria-hidden": "true", text: repTargetText(step.set) })),
        el("small", { text: step.set.weight ? `reps at ${step.set.weight} ${unit}` : "reps" }))
      : null;
    // The middle of the screen: a gold spotlight pulses behind the number during a set; a
    // circle breathes behind the clock during a rest.
    const showCard = phase === "work" && !askingFeel && !askingReps && needsWeight(step);
    const stage = showCard
      ? findWeightCard(step)
      : el("div", { class: "phase-stage" },
        el("span", { class: "breath", "aria-hidden": "true" }),
        countdown ?? repTarget,
        phase === "rest" ? el("span", { class: "breath-word", "aria-hidden": "true", text: "Breathe" }) : null);
    const note = step.exercise.feelNote ? el("p", { class: "suggestion-note", text: step.exercise.feelNote }) : null;

    const common = [
      el("p", { class: "player-label", text: paused ? "Paused" : phase === "rest" ? "Rest" : "Work" }),
      setSegments(step),
      el("h2", { class: "player-exercise", text: step.exercise.name }),
      // Once the reps are in (while asking how it felt), the line shows what was done.
      editTarget(`${setLabel(step)} · ${targetText(step, unit, askingFeel)}`),
      step.setNumber === 1 ? suggestionLine(step.exercise) : note,
      renderLinks(step),
      stage,
    ];
    const actions = [];
    if (phase === "rest") {
      actions.push(stepButton("Skip rest", skipRest));
    } else if (hasCountdown) {
      actions.push(stepButton("Done early", completeSet));
    } else {
      actions.push(stepButton("Done with set", afterDone(step)));
    }
    if (nextExerciseIndex(steps, index) !== -1) {
      // A small link, so Done with set is the one big button on the screen.
      const skip = button("text", { class: "next-link", onclick: skipExercise }, "Next exercise", icon("arrow", "end"));
      skip.disabled = paused;
      actions.push(skip);
    }
    if (askingReps && phase === "work") return [...common, repChips(step)];
    if (askingFeel && phase === "work") return [...common.filter((part) => part !== stage), feelPanel(step)];
    return [...common, el("div", { class: "button-stack player-actions" }, ...actions)];
  }

  function render() {
    if (steps.length === 0) {
      setHeader("workout", { title: "Workout" });
      container.replaceChildren(
        el("p", { class: "empty", text: "Add at least one set with a number in it first." }),
        button("primary", { text: "Back", onclick: onExit }));
      stop();
      return;
    }
    totalNode = el("span", {
      class: "player-total",
      text: formatClock(totalClock.elapsedMs(now()) / 1000),
    });
    countdownNode = null;
    const exerciseNumber = workout.exercises.indexOf(steps[Math.min(index, steps.length - 1)].exercise) + 1;
    // The toolbar holds Pause, the total clock and End; the rest of the screen is the current set.
    setHeader("workout", {
      title: totalNode,
      start: finished ? [] : [pauseButton()],
      end: finished ? [] : [el("ion-button", { color: "danger", text: "End", onclick: endEarly })],
    });
    // The player's look follows the phase: high energy in a set, calm in a rest. Only a real
    // change of phase eases the middle of the screen in; pausing does not.
    // "Up next" shares the calm look of a rest, but still eases in as a change of screen.
    const shownStep = finished ? "done" : phase;
    const nextPhase = shownStep === "next" ? "rest" : shownStep;
    const isPhaseChange = shownPhase !== null && shownPhase !== shownStep;
    shownPhase = shownStep;
    phaseBackground.dataset.phase = nextPhase;
    phaseBackground.classList.toggle("is-paused", paused);
    if (finished) setTimeout(() => phaseBackground.remove(), PHASE_FADE_MS);
    const playerClass = `player phase-${nextPhase}${shownStep === "next" ? " is-up-next" : ""}${paused ? " is-paused" : ""}${isPhaseChange ? " is-phase-change" : ""}`;
    container.replaceChildren(el("div", { class: playerClass },
      finished ? null : el("p", { class: "muted player-position", text: `Exercise ${exerciseNumber} of ${workout.exercises.length}` }),
      finished ? null : progressBar(),
      ...(finished ? renderDone() : renderStep())));
    renderOverview();
    tick();
  }

  if (!paused) {
    totalClock.start(now());
    phaseClock.start(now());
  }
  render();
  // Pauses the run where it is and leaves it saved, for when the person goes to another screen.
  function suspend() {
    totalClock.pause(now());
    phaseClock.pause(now());
    saveProgress();
    stop(true);
  }

  return { stop, suspend, isRunning: () => !finished };
}
