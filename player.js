import { createStopwatch, formatClock } from "./clock.js";
import { confirmAction, el } from "./dom.js";
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
export function runGuidedWorkout(container, workout, unit, onExit) {
  const steps = buildSteps(workout);
  const totalClock = createStopwatch();
  const phaseClock = createStopwatch();
  let index = 0;
  let phase = "work";
  let paused = false;
  let finished = false;
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

  function tick() {
    if (finished) return;
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
    clearInterval(timer);
    wakeLock?.release?.().catch(() => {});
  }
  navigator.wakeLock?.request("screen").then((lock) => {
    wakeLock = lock;
    if (finished) lock.release().catch(() => {});
  }).catch(() => {});

  /* ---------- Rendering ---------- */

  function pauseButton() {
    return el("button", {
      class: "secondary-button",
      type: "button",
      text: paused ? "▶ Continue" : "❚❚ Pause",
      onclick: togglePause,
    });
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
      if (done > 0) lines.push(el("li", {}, el("span", { text: exercise.name }), el("span", { class: "generated-target", text: `${done} ${done === 1 ? "set" : "sets"}` })));
    }
    return [
      el("p", { class: "player-label", text: "Workout complete" }),
      el("p", { class: "player-countdown", text: total }),
      el("p", { class: "muted player-center", text: "Total time" }),
      el("ul", { class: "generated-list" }, ...lines),
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
      const skip = el("button", { class: "secondary-button", type: "button", text: "Next exercise →", onclick: skipExercise });
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
    container.replaceChildren(el("div", { class: "player" }, header, ...(finished ? renderDone() : renderStep())));
    tick();
  }

  totalClock.start(now());
  phaseClock.start(now());
  render();
  return { stop, isRunning: () => !finished };
}
