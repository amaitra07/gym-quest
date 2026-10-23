import { byId, showToast } from "./dom.js";
import { renderHome } from "./home.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import { clearDraft, loadDraft, loadWorkouts, saveWorkouts } from "./storage.js";
import { createWorkout, openWorkout } from "./workout.js";

let workouts = loadWorkouts();

function showScreen(name) {
  byId("homeScreen").hidden = name !== "home";
  byId("workoutScreen").hidden = name !== "workout";
  window.scrollTo(0, 0);
}

function showHome() {
  renderHome(workouts, loadDraft() !== null, editWorkout);
  showScreen("home");
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
showHome();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
