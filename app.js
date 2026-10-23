import { byId, showToast } from "./dom.js";
import { renderScreens } from "./home.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import { clearDraft, loadDraft, loadWorkouts, saveWorkouts } from "./storage.js";
import { confirmLeaveWorkout, createWorkout, openWorkout } from "./workout.js";

let workouts = loadWorkouts();

const TABS = ["home", "history"];
let currentTab = "home";
let onWorkoutScreen = false;
let workoutIsNew = false;

// `highlightedTab` is the bar button that shows as selected: the screen's own tab, or
// "log" while logging a new workout.
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
  showScreen(name);
}

// Closing a workout returns to the tab it was opened from.
function showHome() {
  showTab(currentTab);
}

function openScreen(workout, isNew) {
  openWorkout(workout, isNew, {
    getWorkouts: () => workouts,
    onSave: saveWorkout,
    onDelete: deleteWorkout,
    onClose: showHome,
  });
  workoutIsNew = isNew;
  // Editing an old workout keeps its origin tab selected; a new one is the "Log" tab.
  showScreen("workout", isNew ? "log" : currentTab);
}

function startWorkout() {
  openScreen(loadDraft() ?? createWorkout(), true);
}

function editWorkout(workout) {
  openScreen(structuredClone(workout), false);
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

function saveWorkout(workout, isNew) {
  const levelBefore = levelInfo(totalXp(workouts)).level;
  const nextWorkouts = isNew
    ? [...workouts, workout]
    : workouts.map((existing) => (existing.id === workout.id ? workout : existing));
  if (!persist(nextWorkouts)) return;

  if (isNew) clearDraft();
  showHome();
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

function toggleTheme() {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme || (systemPrefersDark ? "dark" : "light");
  root.dataset.theme = current === "dark" ? "light" : "dark";
}

byId("themeButton").addEventListener("click", toggleTheme);
byId("startButton").addEventListener("click", startWorkout);
async function onTabClick(target) {
  if (onWorkoutScreen) {
    if (target === "log" && workoutIsNew) return;
    if (!(await confirmLeaveWorkout())) return;
  }
  if (target === "log") startWorkout();
  else showTab(target);
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => onTabClick(tab.dataset.tab));
}
showTab("home");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
