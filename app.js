import { todayIso } from "./dates.js";
import { byId, confirmAction, showToast } from "./dom.js";
import { newId, workoutFromRoutine } from "./exercises.js";
import { renderScreens } from "./home.js";
import { renderLogPicker, renderRoutines } from "./routines.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import {
  clearDraft,
  loadDraft,
  loadRoutines,
  loadWorkouts,
  saveRoutines,
  saveWorkouts,
} from "./storage.js";
import { confirmLeaveWorkout, createWorkout, openWorkout } from "./workout.js";

let workouts = loadWorkouts();
let routines = loadRoutines();

const TABS = ["home", "log", "routines", "history"];
let currentTab = "home";
let onWorkoutScreen = false;

// `highlightedTab` is the bar button that shows as selected: the screen's own tab, or
// the tab that the workout being edited belongs to.
function showScreen(name, highlightedTab = name) {
  for (const screen of [...TABS, "workout"]) {
    byId(`${screen}Screen`).hidden = name !== screen;
  }
  onWorkoutScreen = name === "workout";
  for (const tab of document.querySelectorAll(".tab")) {
    const isCurrent = tab.dataset.tab === highlightedTab;
    tab.classList.toggle("active", isCurrent);
    if (isCurrent) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
}

function showTab(name) {
  currentTab = name;
  renderScreens(workouts, loadDraft() !== null, editWorkout);
  renderRoutines(routines, { onEdit: editRoutine, onCreate: createRoutine });
  renderLogPicker(routines, loadDraft(), {
    onStart: startRoutine,
    onResume: resumeWorkout,
    onEmpty: startEmptyWorkout,
    onCreate: createRoutine,
  });
  showScreen(name);
}

// Closing a workout returns to the tab it was opened from.
function showHome() {
  showTab(currentTab);
}

function openScreen(workout, isNew, { kind = "log", autoStart = false } = {}) {
  openWorkout(workout, isNew, {
    getWorkouts: () => workouts,
    onSave: kind === "routine" ? saveRoutine : saveWorkout,
    onDelete: kind === "routine" ? deleteRoutine : deleteWorkout,
    onClose: showHome,
  }, { kind, autoStart });
  // A workout being logged is the "Log" tab; a saved workout belongs to "Workouts".
  const highlightedTab = kind === "routine" ? "routines" : isNew ? "log" : currentTab;
  showScreen("workout", highlightedTab);
}

function resumeWorkout() {
  openScreen(loadDraft() ?? createWorkout(), true);
}

async function startEmptyWorkout() {
  if (!(await confirmReplacingDraft())) return;
  clearDraft();
  openScreen(createWorkout(), true);
}

async function startRoutine(routine) {
  if (!(await confirmReplacingDraft())) return;
  const workout = workoutFromRoutine(routine, workouts, todayIso());
  openScreen(workout, true, { autoStart: true });
}

// Starting something new would overwrite the unfinished workout, so ask first.
async function confirmReplacingDraft() {
  if (loadDraft() === null) return true;
  const message = "Start a new workout? Your unfinished workout will be discarded.";
  return confirmAction(message, "Start new");
}

function editWorkout(workout) {
  openScreen(structuredClone(workout), false);
}

function createRoutine() {
  currentTab = "routines";
  openScreen({ id: newId(), name: "", exercises: [] }, true, { kind: "routine" });
}

function editRoutine(routine) {
  openScreen(structuredClone(routine), false, { kind: "routine" });
}

// Replaces the saved list only if it could be written, so the screen never
// shows data that would vanish on reload.
function persist(nextWorkouts) {
  if (!saveWorkouts(nextWorkouts)) {
    showToast("Couldn't save. Your browser may be blocking or out of storage.");
    return false;
  }
  workouts = nextWorkouts;
  return true;
}

function persistRoutines(nextRoutines) {
  if (!saveRoutines(nextRoutines)) {
    showToast("Couldn't save. Your browser may be blocking or out of storage.");
    return false;
  }
  routines = nextRoutines;
  return true;
}

function saveWorkout(workout, isNew) {
  const levelBefore = levelInfo(totalXp(workouts)).level;
  const nextWorkouts = isNew
    ? [...workouts, workout]
    : workouts.map((existing) => (existing.id === workout.id ? workout : existing));
  if (!persist(nextWorkouts)) return;

  if (isNew) {
    clearDraft();
    showTab("home");
  } else {
    showHome();
  }
  const levelAfter = levelInfo(totalXp(workouts)).level;
  showToast(
    levelAfter > levelBefore
      ? `Level up! Level ${levelAfter}: ${titleForLevel(levelAfter)}`
      : `Saved. +${workout.xp} XP`,
  );
}

function deleteWorkout(id) {
  if (!persist(workouts.filter((workout) => workout.id !== id))) return;
  showHome();
  showToast("Workout deleted.");
}

function saveRoutine(routine, isNew) {
  const nextRoutines = isNew
    ? [...routines, routine]
    : routines.map((existing) => (existing.id === routine.id ? routine : existing));
  if (!persistRoutines(nextRoutines)) return;
  showTab("routines");
  showToast(`Saved “${routine.name}”. Start it any time from the Log tab.`);
}

function deleteRoutine(id) {
  if (!persistRoutines(routines.filter((routine) => routine.id !== id))) return;
  showTab("routines");
  showToast("Saved workout deleted.");
}

function toggleTheme() {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme || (systemPrefersDark ? "dark" : "light");
  root.dataset.theme = current === "dark" ? "light" : "dark";
}

async function onTabClick(target) {
  if (onWorkoutScreen && !(await confirmLeaveWorkout())) return;
  showTab(target);
}

byId("themeButton").addEventListener("click", toggleTheme);
byId("startButton").addEventListener("click", () => {
  if (loadDraft() !== null) resumeWorkout();
  else showTab("log");
});
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => onTabClick(tab.dataset.tab));
}
showTab("home");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
