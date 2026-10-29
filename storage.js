const WORKOUTS_KEY = "gymquest.workouts";
const DRAFT_KEY = "gymquest.draft";
const GUIDED_KEY = "gymquest.guided";
const ROUTINES_KEY = "gymquest.routines";
const SCHEDULE_KEY = "gymquest.schedule";
const PROFILE_KEY = "gymquest.profile";
const THEME_KEY = "gymquest.theme";
const UNIT_KEY = "gymquest.unit";

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

// Storage can be full or blocked (private windows), so writes report success
// and callers decide how to tell the user.
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkouts() {
  const saved = readJson(WORKOUTS_KEY);
  return Array.isArray(saved) ? saved : [];
}

export function saveWorkouts(workouts) {
  return writeJson(WORKOUTS_KEY, workouts);
}

export function loadRoutines() {
  const saved = readJson(ROUTINES_KEY);
  return Array.isArray(saved) ? saved : [];
}

export function saveRoutines(routines) {
  return writeJson(ROUTINES_KEY, routines);
}

// Which saved workout is planned for each weekday: { 0: routineId, ... } with 0 as Sunday.
export function loadSchedule() {
  const saved = readJson(SCHEDULE_KEY);
  return saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

export function saveSchedule(schedule) {
  return writeJson(SCHEDULE_KEY, schedule);
}

// { name, age, heightCm, weightKg, goal }, or null before anything has been saved.
export function loadProfile() {
  const saved = readJson(PROFILE_KEY);
  return saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : null;
}

export function saveProfile(profile) {
  return writeJson(PROFILE_KEY, profile);
}

export function loadTheme() {
  const saved = readJson(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function saveTheme(theme) {
  return writeJson(THEME_KEY, theme);
}

export function loadDraft() {
  const draft = readJson(DRAFT_KEY);
  return draft && Array.isArray(draft.exercises) ? draft : null;
}

export function saveDraft(draft) {
  return writeJson(DRAFT_KEY, draft);
}

// Where a guided workout had got to, so it can be picked up after the app is closed.
export function loadGuidedRun() {
  const saved = readJson(GUIDED_KEY);
  return saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : null;
}

export function saveGuidedRun(state) {
  return writeJson(GUIDED_KEY, state);
}

export function clearGuidedRun() {
  try {
    localStorage.removeItem(GUIDED_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

// A discarded or finished workout takes its guided position with it.
export function clearDraft() {
  clearGuidedRun();
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

// Removes workouts, saved workouts, the weekly plan and any draft; profile and settings stay.
export function clearWorkoutData() {
  try {
    for (const key of [WORKOUTS_KEY, ROUTINES_KEY, SCHEDULE_KEY, DRAFT_KEY, GUIDED_KEY]) localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function loadUnit() {
  return readJson(UNIT_KEY) === "kg" ? "kg" : "lb";
}

export function saveUnit(unit) {
  return writeJson(UNIT_KEY, unit);
}
