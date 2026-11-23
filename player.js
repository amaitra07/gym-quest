import { createStopwatch, formatClock } from "./clock.js";
import { beep, finalSecondsLeft } from "./countdown.js";
import { button, confirmAction, detailRow, el, icon, insetList, openSheet, setHeader } from "./dom.js";
import { EXERCISE_TYPES, isSetFilled } from "./exercises.js";
import { howToFor, showHowTo } from "./how-to.js";

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

function targetText(step, unit) {
  const { type } = step.exercise;
  const { set } = step;
  if (type === "strength") {
    return set.weight ? `${set.weight} ${unit} × ${set.reps} reps` : `${set.reps} reps`;
  }
  if (type === "cardio") {
    return set.distance ? `${set.minutes} min · ${set.distance} distance` : `${set.minutes} min`;
  }
  return `${set.seconds} second hold`;
}

function setLabel(step) {
  return `Set ${step.setNumber} of ${step.setCount}`;
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
  const steps = buildSteps(workout);
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
  container.parentElement?.append(phaseBackground);
  let shownPhase = null;

  const now = () => Date.now();

  function currentCountdownSeconds() {
    if (phase === "rest") return steps[index].exercise.restSeconds;
    // "Up next" waits for as long as the exercise just finished rests between its sets.
    if (phase === "next") return steps[index - 1]?.exercise.restSeconds ?? 0;
    return workDurationSeconds(steps[index]);
  }

  function enterPhase(nextIndex, nextPhase) {
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

  function completeSet() {
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

  // How many sets are done, as a bar. Tapping it opens the list of all exercises.
  function progressBar() {
    const { done, total } = progressSummary(steps, completed, index, finished);
    const percent = Math.round((done / total) * 100);
    return el("button", {
      class: "progress-summary",
      type: "button",
      "aria-label": `${done} of ${total} sets done. Show all exercises.`,
      onclick: openOverview,
    },
    el("span", { class: "progress-row" },
      el("span", { class: "progress-count", text: `${done} of ${total} sets` }),
      el("span", { class: "progress-link" }, "All exercises", icon("forward"))),
    el("ion-progress-bar", { value: done / total, "aria-label": `${percent}% of sets done` }));
  }

  // Pause sits in the top-left corner, opposite End, out of the way of the big buttons.
  function pauseButton() {
    return el("ion-button", { onclick: togglePause }, icon(paused ? "play" : "pause", "start"), paused ? "Continue" : "Pause");
  }

  // A sheet for fixing the numbers of the set finished last, for when you did less (or
  // more) than planned. Changes are saved as you tap.
  function editLastSet() {
    const position = lastFinishedIndex(completed, index);
    if (position === -1) return;
    const step = steps[position];
    const { exercise, set } = step;
    editSheet = openSheet(`${exercise.name} · ${setLabel(step)}`, () => {
      editSheet = null;
      if (!stopped) render();
    });
    const rows = EXERCISE_TYPES[exercise.type].fields.map((field) => {
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
          onEdit();
        },
      });
      const nudge = (direction) => () => {
        input.value = nudgeSetValue(set, exercise.type, field.key, direction, unit) ?? "";
        onEdit();
      };
      return el("div", { class: "stepper-row" },
        el("span", { class: "stepper-label", text: setFieldName(field) }),
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": `Less ${field.label.toLowerCase()}`, onclick: nudge(-1) }, icon("minus")),
        input,
        el("ion-button", { class: "stepper-button", fill: "solid", "aria-label": `More ${field.label.toLowerCase()}`, onclick: nudge(1) }, icon("plus")));
    });
    editSheet.content.append(
      el("p", { class: "guide", text: "Change it to what you actually did. It's saved straight away." }),
      ...rows);
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
        icon("edit", "start"), `Last set: ${targetText(steps[lastPosition], unit)}`);
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
      const skip = button("secondary", { onclick: skipExercise }, "Skip this exercise", icon("arrow", "end"));
      skip.disabled = paused;
      actions.push(skip);
    }
    return [
      el("p", { class: "up-next-done" }, icon("check", "start"),
        entry ? `${finishedExercise.name} done · ${entry.done} of ${entry.total} ${entry.total === 1 ? "set" : "sets"}` : `${finishedExercise.name} done`),
      el("p", { class: "player-label", text: paused ? "Paused" : "Up next" }),
      el("h2", { class: "player-exercise", text: step.exercise.name }),
      el("p", { class: "muted player-center", text: `${step.setCount} ${step.setCount === 1 ? "set" : "sets"} · ${targetText(step, unit)}` }),
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
    const repTarget = !hasCountdown && step.exercise.type === "strength" && step.set.reps
      ? el("p", { class: "player-countdown player-reps" }, String(step.set.reps),
        el("small", { text: step.set.weight ? `reps at ${step.set.weight} ${unit}` : "reps" }))
      : null;
    // The middle of the screen: the number pulses during a set; a circle breathes behind it during a rest.
    const stage = el("div", { class: "phase-stage" },
      el("span", { class: "breath", "aria-hidden": "true" }),
      countdown ?? repTarget,
      phase === "rest" ? el("span", { class: "breath-word", "aria-hidden": "true", text: "Breathe" }) : null);

    const common = [
      el("p", { class: "player-label", text: paused ? "Paused" : phase === "rest" ? "Rest" : "Work" }),
      el("h2", { class: "player-exercise", text: step.exercise.name }),
      el("p", { class: "muted player-center", text: `${setLabel(step)} · ${targetText(step, unit)}` }),
      renderLinks(step),
      stage,
    ];
    const actions = [];
    if (phase === "rest") {
      actions.push(stepButton("Skip rest", skipRest));
    } else if (hasCountdown) {
      actions.push(stepButton("Done early", completeSet));
    } else {
      actions.push(stepButton("Done with set", completeSet));
    }
    if (nextExerciseIndex(steps, index) !== -1) {
      const skip = button("secondary", { onclick: skipExercise }, "Next exercise", icon("arrow", "end"));
      skip.disabled = paused;
      actions.push(skip);
    }
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
