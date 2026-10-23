import { byId, showToast } from "./dom.js";
import { renderScreens } from "./home.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import { clearDraft, loadDraft, loadWorkouts, saveWorkouts } from "./storage.js";
import { createWorkout, openWorkout } from "./workout.js";

let workouts = loadWorkouts();

const TABS = ["home", "calendar", "history"];
let currentTab = "home";

function showScreen(name) {
  for (const screen of [...TABS, "workout"]) {
    byId(`${screen}Screen`).hidden = name !== screen;
  }
  // The log screen has its own Save and Discard bar, so the tab bar steps aside.
  byId("tabBar").hidden = name === "workout";
  document.body.classList.toggle("has-tab-bar", name !== "workout");
  for (const tab of document.querySelectorAll(".tab")) {
    const isCurrent = tab.dataset.tab === name;
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
  showScreen("workout");
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
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab === "log") startWorkout();
    else showTab(tab.dataset.tab);
  });
}
showTab("home");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
