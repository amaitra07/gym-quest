import { initAccount, renderAccountSection } from "./account.js";
import { createActivity, isActivity, openActivity } from "./activity.js";
import { renderComplete } from "./complete.js";
import { longDate } from "./calendar.js";
import { todayIso, WEEKDAY_NAMES } from "./dates.js";
import { byId, chooseOption, confirmAction, el, scrollToTop, showToast } from "./dom.js";
import { newId, workoutFromRoutine } from "./exercises.js";
import { renderScreens } from "./home.js";
import { savePhotosForOffline } from "./how-to.js";
import { slideIn, staggerIn } from "./motion.js";
import { renderProfile } from "./profile.js";
import { renderProgress, resetProgress } from "./progress.js";
import { findNewRecords } from "./records.js";
import { renderRoutines, startMenuOptions } from "./routines.js";
import { buildSampleData } from "./sample-data.js";
import { buildStarterPlan, STARTER_DAY_OPTIONS, STARTER_EQUIPMENT } from "./starter-plan.js";
import { levelInfo, titleForLevel, totalXp } from "./stats.js";
import {
  clearDraft,
  clearWorkoutData,
  loadDraft,
  loadProfile,
  loadRoutines,
  loadSchedule,
  loadSyncedData,
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

const TABS = ["home", "routines", "progress", "history"];
const IONIC_WAIT_MS = 8000;
let currentTab = "home";
let visibleScreen = "home";
let onWorkoutScreen = false;

// `highlightedTab` is the bar button that shows as selected: the screen's own tab, or
// the tab that the workout being edited belongs to.
function showScreen(name, highlightedTab = name) {
  for (const screen of [...TABS, "profile", "complete", "workout", "activity"]) {
    byId(`${screen}Screen`).hidden = name !== screen;
  }
  visibleScreen = name;
  onWorkoutScreen = name === "workout";
  byId("tabBar").selectedTab = highlightedTab;
  scrollToTop(name);
}

function showTab(name) {
  const cameFrom = visibleScreen;
  // Coming back to Progress from elsewhere starts at the list, not the last lift opened.
  if (name === "progress" && currentTab !== "progress") resetProgress();
  currentTab = name;
  renderScreens(workouts, routines, schedule, profile, loadDraft(), {
    onOpenWorkout: editWorkout,
    onDeleteWorkout: deleteFromHistory,
    onStartRoutine: startRoutine,
    onLogRoutine: logRoutine,
    onResume: resumeWorkout,
    onStartEmpty: () => startEmptyWorkout(),
    onLogDay: logForDay,
    onStartOther: startOther,
    onStarterPlan: addStarterPlan,
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
  showScreen(name);
  if (cameFrom !== name) animateTabIn(name, cameFrom);
}

// Arriving on a tab: the screen slides in from the side of the tab you came from, and its
// cards and rows slide up one after another. Redrawing the same tab does neither.
function animateTabIn(name, cameFrom) {
  const screen = byId(`${name}Screen`);
  const from = TABS.indexOf(cameFrom);
  slideIn(screen.querySelector("ion-content"), from === -1 ? 0 : Math.sign(TABS.indexOf(name) - from));
  const pieces = [];
  for (const child of screen.querySelectorAll(".wrap > :not([hidden])")) {
    if (child.matches(".bento, .card-list")) pieces.push(...child.children);
    else pieces.push(child);
  }
  staggerIn(pieces);
}

// Closing a workout returns to the tab it was opened from.
function showHome() {
  showTab(currentTab);
}

function openScreen(workout, isNew, { kind = "log", autoStart = false, resumeGuided = false } = {}) {
  openWorkout(workout, isNew, {
    getWorkouts: () => workouts,
    onSave: kind === "routine" ? saveRoutine : saveWorkout,
    onDelete: kind === "routine" ? deleteRoutine : deleteWorkout,
    onClose: showHome,
  }, { kind, autoStart, resumeGuided });
  // A plan belongs to "Plans"; a workout stays with the tab it was started from (Home, or
  // History for a past day).
  const highlightedTab = kind === "routine" ? "routines" : currentTab;
  showScreen("workout", highlightedTab);
}

function resumeWorkout() {
  openScreen(loadDraft() ?? createWorkout(), true, { resumeGuided: true });
}

// `date` (YYYY-MM-DD) is the day the workout is for: today, or a past day picked in History.
async function startEmptyWorkout(date = todayIso()) {
  if (!(await confirmReplacingDraft())) return;
  clearDraft();
  openScreen({ ...createWorkout(), date }, true);
}

async function startRoutine(routine) {
  if (!(await confirmReplacingDraft())) return;
  const workout = workoutFromRoutine(routine, workouts, todayIso());
  openScreen(workout, true, { autoStart: true });
}

// Opens a saved workout straight on the set grid, filled in from the plan, so you can type
// in what you did and tap Finish workout without running the guided timers.
async function logRoutine(routine, date = todayIso()) {
  if (!(await confirmReplacingDraft())) return;
  openScreen(workoutFromRoutine(routine, workouts, date), true);
}

// "Log a workout for <day>" in History: a plan (opened on the tick grid, since a guided
// run only makes sense live), an empty workout, or an activity, all dated that day.
async function logForDay(date) {
  const choice = await chooseOption(`Log a workout for ${longDate(date)}`, startMenuOptions(routines));
  if (choice === null) return;
  if (choice.kind === "routine") logRoutine(choice.routine, date);
  else if (choice.kind === "empty") startEmptyWorkout(date);
  else startActivity(date);
}

// "Start something else" on Home: pick another plan (then guided or logged), an empty
// workout, or an activity. `featuredId` is the plan Home already shows, left out here.
async function startOther(featuredId) {
  const choice = await chooseOption("Start something else", startMenuOptions(routines, featuredId));
  if (choice === null) return;
  if (choice.kind === "empty") startEmptyWorkout();
  else if (choice.kind === "activity") startActivity();
  else {
    const mode = await chooseOption(choice.routine.name, [
      { label: "Start guided (timers, one set at a time)", value: "guided" },
      { label: "Log it (fill in what you did)", value: "log" },
    ]);
    if (mode === "guided") startRoutine(choice.routine);
    else if (mode === "log") logRoutine(choice.routine);
  }
}

// Starting something new would overwrite the unfinished workout, so ask first.
async function confirmReplacingDraft() {
  if (loadDraft() === null) return true;
  const message = "Start a new workout? Your unfinished workout will be discarded.";
  return confirmAction(message, "Start new");
}

function editWorkout(workout) {
  if (isActivity(workout)) openActivityScreen(structuredClone(workout), false);
  else openScreen(structuredClone(workout), false);
}

// Logging an activity does not touch an unfinished workout, so nothing needs confirming.
function startActivity(date = todayIso()) {
  openActivityScreen({ ...createActivity(), date }, true);
}

function openActivityScreen(activity, isNew) {
  openActivity(activity, isNew, {
    onSave: saveActivity,
    onDelete: deleteActivity,
    onClose: showHome,
  });
  showScreen("activity", currentTab);
}

function saveActivity(activity, isNew) {
  const nextWorkouts = isNew
    ? [...workouts, activity]
    : workouts.map((existing) => (existing.id === activity.id ? activity : existing));
  if (!persist(nextWorkouts)) return;
  showHome();
  showToast(`Saved ${activity.name}. +${activity.xp} XP`);
}

function deleteActivity(id) {
  if (!persist(workouts.filter((workout) => workout.id !== id))) return;
  showHome();
  showToast("Activity deleted.");
}

// Swiping a row in History deletes it, after the same question its edit screen asks.
async function deleteFromHistory(workout) {
  if (!(await confirmAction(`Delete "${workout.name}"? Its XP will be removed too.`, "Delete"))) return;
  if (isActivity(workout)) deleteActivity(workout.id);
  else deleteWorkout(workout.id);
}

function createRoutine() {
  currentTab = "routines";
  openScreen({ id: newId(), name: "", exercises: [] }, true, { kind: "routine" });
}

// Asks a beginner two questions, then adds ready-made plans and picks their days.
// Offered (on Home) only while there are no plans, so there is nothing to overwrite.
async function addStarterPlan() {
  const days = await chooseOption("How many days a week can you train?",
    STARTER_DAY_OPTIONS.map((count) => ({ label: count === 1 ? "1 day" : `${count} days`, value: count })));
  if (days === null) return;
  const equipment = await chooseOption("What can you train with?", STARTER_EQUIPMENT);
  if (equipment === null) return;
  const plan = buildStarterPlan(days, equipment, newId);
  const week = Object.entries(plan.schedule)
    .sort(([a], [b]) => ((Number(a) + 6) % 7) - ((Number(b) + 6) % 7))
    .map(([weekday, id]) => `${WEEKDAY_NAMES[weekday].slice(0, 3)}: ${plan.routines.find((routine) => routine.id === id).name}`)
    .join(" · ");
  if (!(await confirmAction("Add this plan?", "Add plan", { detail: `${week}. ${plan.why}`, isDestructive: false }))) return;
  if (!persistRoutines([...routines, ...plan.routines]) || !persistSchedule(plan.schedule)) return;
  showTab("home");
  const workoutCount = plan.routines.length === 1 ? "1 workout" : `${plan.routines.length} workouts`;
  const dayCount = days === 1 ? "1 day" : `${days} days`;
  showToast(`Starter plan added: ${workoutCount}, ${dayCount} a week. Change anything in the Plans tab.`);
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
// Done returns to the tab the workout was started from: Home, or History for a past day.
function showComplete(workout, records, levelMessage) {
  renderComplete(workout, records, levelMessage, loadUnit(), showHome);
  showScreen("complete", currentTab);
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
  showToast(`Saved “${routine.name}”. Start it any time from Home.`);
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
  showToast("Plan deleted.");
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
  renderAccountSection();
  showScreen("profile", "home");
}

// After signing out, or when the account's data replaces this device's. A workout being
// logged stays on screen; the other screens redraw now.
function reloadSyncedData() {
  ({ workouts, routines, schedule, profile } = loadSyncedData());
  if (visibleScreen === "profile") openProfile();
  else if (TABS.includes(visibleScreen)) showTab(visibleScreen);
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
  if (hasData && !(await confirmAction("Replace your plans, weekly plan and history with sample data?", "Replace"))) return;
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
  if (!(await confirmAction("Delete every workout, every plan and your weekly plan? This can't be undone.", "Delete everything"))) return;
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

// Ionic's components load from the web the first time and from the saved copy after that.
// The screens call their methods, so wait for them, and say so if they never arrive.
const ionicLoaded = await Promise.race([
  customElements.whenDefined("ion-app").then(() => true),
  new Promise((resolve) => setTimeout(() => resolve(false), IONIC_WAIT_MS)),
]);
if (!ionicLoaded) {
  document.body.prepend(el("p", {
    class: "load-error",
    role: "alert",
    text: "Gym Quest couldn't load its screens. Check your connection, then reload the page. Your workouts are safe.",
  }));
}

byId("profileButton").addEventListener("click", openProfile);
for (const tab of document.querySelectorAll("ion-tab-button")) {
  tab.addEventListener("click", () => onTabClick(tab.getAttribute("tab")));
}
applyTheme(loadTheme());
showTab("home");
initAccount({ onDataReplaced: reloadSyncedData });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Offline mode unavailable:", error.message);
  });
}
savePhotosForOffline();
