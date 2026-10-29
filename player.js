import { createStopwatch, formatClock } from "./clock.js";
import { confirmAction, el, icon } from "./dom.js";
import { isSetFilled } from "./exercises.js";

const TICK_MS = 250;

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

// Where to go after finishing the set at `index`: straight to the next
// exercise, or into a rest first when the same exercise has sets left.
// Returns null when the workout is over.
export function afterSet(steps, index) {
  const next = steps[index + 1];
  if (!next) return null;
  const restSeconds = steps[index].exercise.restSeconds;
  const sameExercise = next.exercise === steps[index].exercise;
  if (sameExercise && restSeconds > 0) return { index: index + 1, phase: "rest" };
  return { index: index + 1, phase: "work" };
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
    && (saved.phase === "work" || saved.phase === "rest")
    && Array.isArray(saved.completed) && saved.completed.every(isStepNumber)
    && isDuration(saved.totalMs) && isDuration(saved.phaseMs);
  return isValid ? saved : null;
}

// `options.resumeFrom` is a position checked by restoreGuidedState: the run then opens
// paused where it left off. `options.onProgress(state)` is called every second with where
// the run has got to, and with null once it is over.
export function runGuidedWorkout(container, workout, unit, onExit, { resumeFrom = null, onProgress = () => {} } = {}) {
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
  let totalNode = null;
  let countdownNode = null;
  let wakeLock = null;

  const now = () => Date.now();

  function currentCountdownSeconds() {
    if (phase === "rest") return steps[index].exercise.restSeconds;
    return workDurationSeconds(steps[index]);
  }

  function enterPhase(nextIndex, nextPhase) {
    index = nextIndex;
    phase = nextPhase;
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
      if (remainingMs <= 0 && !paused) completeCountdown();
    }
  }

  function completeCountdown() {
    if (phase === "rest") skipRest();
    else completeSet();
  }

  const timer = setInterval(tick, TICK_MS);
  function stop() {
    stopped = true;
    onProgress(null);
    closeOverview();
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
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
    if (overview === null) return;
    overview.overlay.remove();
    overview.previousFocus?.focus?.();
    overview = null;
  }

  function openOverview() {
    const previousFocus = document.activeElement;
    const content = el("div", {});
    const closeButton = el("button", { class: "secondary-button", type: "button", text: "Close", onclick: closeOverview });
    const overlay = el("div", {
      class: "dialog-overlay",
      onclick: (event) => {
        if (event.target === overlay) closeOverview();
      },
      onkeydown: (event) => {
        if (event.key === "Escape") closeOverview();
      },
    },
      el("div", { class: "dialog overview-dialog", role: "dialog", "aria-modal": "true", "aria-label": "All exercises" },
        el("h2", { text: "All exercises" }),
        content,
        closeButton));
    overview = { overlay, content, previousFocus };
    document.body.append(overlay);
    renderOverview();
    closeButton.focus();
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
    el("span", {
      class: "progress-track",
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(percent),
    }, el("span", { class: "progress-fill", style: `width: ${percent}%` })));
  }

  function pauseButton() {
    return el("button", {
      class: "secondary-button",
      type: "button",
      onclick: togglePause,
    }, icon(paused ? "play" : "pause"), paused ? "Continue" : "Pause");
  }

  function actionButton(text, onclick, className = "primary-button") {
    const button = el("button", { class: className, type: "button", text, onclick });
    button.disabled = paused;
    return button;
  }

  function renderDone() {
    const total = formatClock(totalClock.elapsedMs(now()) / 1000);
    const lines = [];
    for (const exercise of workout.exercises) {
      const done = exercise.sets.filter((set) => isSetFilled(exercise.type, set)).length;
      if (done > 0) lines.push(el("li", {}, el("span", { text: exercise.name }), el("span", { class: "summary-target", text: `${done} ${done === 1 ? "set" : "sets"}` })));
    }
    return [
      el("p", { class: "player-label", text: "Workout complete" }),
      el("p", { class: "player-countdown", text: total }),
      el("p", { class: "muted player-center", text: "Total time" }),
      el("ul", { class: "summary-list" }, ...lines),
      el("button", { class: "primary-button", type: "button", text: "Review and save", onclick: onExit }),
    ];
  }

  function renderStep() {
    const step = steps[index];
    const hasCountdown = currentCountdownSeconds() !== null;
    const countdown = hasCountdown ? el("p", { class: "player-countdown", text: "" }) : null;
    countdownNode = countdown;

    const common = [
      el("p", { class: "player-label", text: paused ? "Paused" : phase === "rest" ? "Rest" : "Work" }),
      el("h2", { class: "player-exercise", text: step.exercise.name }),
      el("p", { class: "muted player-center", text: `${setLabel(step)} · ${targetText(step, unit)}` }),
      countdown,
    ];
    const actions = [];
    if (phase === "rest") {
      actions.push(actionButton("Skip rest", skipRest));
    } else if (hasCountdown) {
      actions.push(actionButton("Done early", completeSet));
    } else {
      actions.push(actionButton("Done with set", completeSet));
    }
    actions.push(pauseButton());
    if (nextExerciseIndex(steps, index) !== -1) {
      const skip = el("button", { class: "secondary-button", type: "button", onclick: skipExercise }, "Next exercise", icon("arrow"));
      skip.disabled = paused;
      actions.push(skip);
    }
    return [...common, el("div", { class: "player-actions" }, ...actions)];
  }

  function render() {
    if (steps.length === 0) {
      container.replaceChildren(
        el("p", { class: "empty", text: "Add at least one set with a number in it first." }),
        el("button", { class: "primary-button", type: "button", text: "Back", onclick: onExit }));
      stop();
      return;
    }
    totalNode = el("span", {
      class: "player-total",
      text: formatClock(totalClock.elapsedMs(now()) / 1000),
    });
    countdownNode = null;
    const exerciseNumber = workout.exercises.indexOf(steps[Math.min(index, steps.length - 1)].exercise) + 1;
    const header = el("div", { class: "top-bar" },
      el("span", { class: "muted", text: finished ? "Done" : `Exercise ${exerciseNumber} of ${workout.exercises.length}` }),
      totalNode,
      finished ? el("span", {}) : el("button", { class: "text-button", type: "button", text: "End", onclick: endEarly }));
    container.replaceChildren(el("div", { class: "player" },
      header,
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
  return { stop, isRunning: () => !finished };
}
