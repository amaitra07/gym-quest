import { renderComplete } from "./complete.js";
import { todayIso, WEEKDAY_NAMES } from "./dates.js";
import { byId, chooseOption, confirmAction, showToast } from "./dom.js";
import { newId, workoutFromRoutine } from "./exercises.js";
import { renderScreens } from "./home.js";
import { renderProfile } from "./profile.js";
import { renderProgress, resetProgress } from "./progress.js";
import { findNewRecords } from "./records.js";
import { renderLogPicker, renderRoutines } from "./routines.js";
import { buildSampleData } from "./sample-data.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import {
  clearDraft,
  clearWorkoutData,
  loadDraft,
  loadProfile,
  loadRoutines,
  loadSchedule,
  loadTheme,
  loadUnit,
  loadWorkouts,
  saveProfile,
  saveRoutines,
  saveSchedule,
  saveTheme,
  saveUnit,
  saveWorkouts,
} from "./storage.js";
import { applyTheme } from "./theme.js";
import { confirmLeaveWorkout, createWorkout, openWorkout } from "./workout.js";

let workouts = loadWorkouts();
let routines = loadRoutines();
let schedule = loadSchedule();
let profile = loadProfile();

const REST_DAY = "rest";

const TABS = ["home", "log", "routines", "progress", "history"];
let currentTab = "home";
let onWorkoutScreen = false;

// `highlightedTab` is the bar button that shows as selected: the screen's own tab, or
// the tab that the workout being edited belongs to.
function showScreen(name, highlightedTab = name) {
  for (const screen of [...TABS, "profile", "complete", "workout"]) {
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
  // Coming back to Progress from elsewhere starts at the list, not the last lift opened.
  if (name === "progress" && currentTab !== "progress") resetProgress();
  currentTab = name;
  renderScreens(workouts, routines, schedule, profile, loadDraft(), {
    onOpenWorkout: editWorkout,
    onStartRoutine: startRoutine,
    onResume: resumeWorkout,
    onOpenLog: () => showTab("log"),
  });
  renderRoutines(routines, {
    schedule,
    workouts,
    today: todayIso(),
    onPickDay: pickDayWorkout,
    onEdit: editRoutine,
    onCreate: createRoutine,
  });
  renderProgress(workouts, loadUnit());
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

// The screen after finishing a new workout: XP, any new records, and the share card.
function showComplete(workout, records, levelMessage) {
  currentTab = "home";
  renderComplete(workout, records, levelMessage, loadUnit(), () => showTab("home"));
  showScreen("complete", "home");
}

function persistSchedule(nextSchedule) {
  if (!saveSchedule(nextSchedule)) {
    showToast("Couldn't save. Your browser may be blocking or out of storage.");
    return false;
  }
  schedule = nextSchedule;
  return true;
}

function saveWorkout(workout, isNew) {
  const levelBefore = levelInfo(totalXp(workouts)).level;
  const newRecords = isNew ? findNewRecords(workouts, workout) : [];
  const nextWorkouts = isNew
    ? [...workouts, workout]
    : workouts.map((existing) => (existing.id === workout.id ? workout : existing));
  if (!persist(nextWorkouts)) return;

  const levelAfter = levelInfo(totalXp(workouts)).level;
  const levelUpText = `Level up! Level ${levelAfter}: ${titleForLevel(levelAfter)}`;
  if (isNew) {
    clearDraft();
    showComplete(
      workout,
      newRecords,
      levelAfter > levelBefore ? `+${workout.xp} XP · ${levelUpText}` : null,
    );
    return;
  }
  showHome();
  showToast(levelAfter > levelBefore ? levelUpText : `Saved. +${workout.xp} XP`);
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

// Asks which saved workout (or a rest day) belongs to a weekday of the weekly plan.
async function pickDayWorkout(weekday) {
  if (routines.length === 0) {
    showToast("Save a workout first, then plan its day here.");
    return;
  }
  const dayName = WEEKDAY_NAMES[weekday];
  const choice = await chooseOption(`What are you doing on ${dayName}?`, [
    ...routines.map((routine) => ({ label: routine.name, value: routine.id, isPrimary: schedule[weekday] === routine.id })),
    { label: "Rest day", value: REST_DAY },
  ]);
  if (choice === null) return;
  const others = Object.fromEntries(Object.entries(schedule).filter(([day]) => Number(day) !== weekday));
  const nextSchedule = choice === REST_DAY ? others : { ...others, [weekday]: choice };
  if (!persistSchedule(nextSchedule)) return;
  showTab("routines");
  showToast(choice === REST_DAY ? `${dayName} is a rest day.` : `${dayName}: ${routines.find((routine) => routine.id === choice).name}`);
}

function deleteRoutine(id) {
  if (!persistRoutines(routines.filter((routine) => routine.id !== id))) return;
  // A deleted workout leaves the weekly plan too.
  const keptDays = Object.entries(schedule).filter(([, routineId]) => routineId !== id);
  persistSchedule(Object.fromEntries(keptDays));
  showTab("routines");
  showToast("Saved workout deleted.");
}

// The profile and settings screen, opened from the circle on Home.
function openProfile() {
  currentTab = "home";
  renderProfile(profile, loadUnit(), loadTheme(), {
    onBack: () => showTab("home"),
    onSave: saveProfileDetails,
    onTheme: chooseTheme,
    onUnit: chooseUnit,
    onLoadSample: loadSampleData,
    onClearData: clearAllWorkoutData,
  });
  showScreen("profile", "home");
}

function saveProfileDetails(nextProfile) {
  if (!saveProfile(nextProfile)) {
    showToast("Couldn't save. Your browser may be blocking or out of storage.");
    return;
  }
  profile = nextProfile;
  showTab("home");
  showToast(profile.name ? `Saved. Nice to meet you, ${profile.name}!` : "Profile saved.");
}

function chooseTheme(theme) {
  applyTheme(theme);
  if (!saveTheme(theme)) showToast("Couldn't remember your choice on this device.");
}

// Switching units redraws the screen so height and weight show in the new unit.
function chooseUnit(unit) {
  if (!saveUnit(unit)) showToast("Couldn't remember your choice on this device.");
  openProfile();
}

// Replaces saved workouts, the weekly plan and history with the sample Push / Pull / Legs data.
async function loadSampleData() {
  const hasData = workouts.length > 0 || routines.length > 0;
  if (hasData && !(await confirmAction("Replace your saved workouts, weekly plan and history with sample data?", "Replace"))) return;
  const sample = buildSampleData(todayIso());
  if (!saveWorkouts(sample.workouts) || !saveRoutines(sample.routines) || !saveSchedule(sample.schedule)) {
    showToast("Couldn't save. Your browser may be blocking or out of storage.");
    return;
  }
  workouts = sample.workouts;
  routines = sample.routines;
  schedule = sample.schedule;
  showTab("home");
  showToast("Sample Push / Pull / Legs data loaded.");
}

async function clearAllWorkoutData() {
  if (!(await confirmAction("Delete every workout, saved workout and your weekly plan? This can't be undone.", "Delete everything"))) return;
  if (!clearWorkoutData()) {
    showToast("Couldn't clear. Your browser may be blocking storage.");
    return;
  }
  workouts = [];
  routines = [];
  schedule = {};
  showTab("home");
  showToast("All workout data cleared.");
}

async function onTabClick(target) {
  if (onWorkoutScreen && !(await confirmLeaveWorkout())) return;
  showTab(target);
}

byId("profileButton").addEventListener("click", openProfile);
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => onTabClick(tab.dataset.tab));
}
applyTheme(loadTheme());
showTab("home");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
