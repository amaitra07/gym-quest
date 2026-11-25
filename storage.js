const WORKOUTS_KEY = "gymquest.workouts";
const DRAFT_KEY = "gymquest.draft";
const GUIDED_KEY = "gymquest.guided";
const ROUTINES_KEY = "gymquest.routines";
const SCHEDULE_KEY = "gymquest.schedule";
const PROFILE_KEY = "gymquest.profile";
const THEME_KEY = "gymquest.theme";
const FIGURE_KEY = "gymquest.figure";
const UNIT_KEY = "gymquest.unit";
const SYNC_KEY = "gymquest.sync";

// Workouts, saved workouts, the weekly plan and the profile are backed up to the signed-in
// person's account, so saving any of them tells the sync code (see account.js).
const dataChangeListeners = [];

export function onDataChange(listener) {
  dataChangeListeners.push(listener);
}

function notifyDataChange() {
  for (const listener of dataChangeListeners) listener();
}

function removeKeys(keys) {
  try {
    for (const key of keys) localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

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

function writeSynced(key, value) {
  const saved = writeJson(key, value);
  if (saved) notifyDataChange();
  return saved;
}

export function loadWorkouts() {
  const saved = readJson(WORKOUTS_KEY);
  return Array.isArray(saved) ? saved : [];
}

export function saveWorkouts(workouts) {
  return writeSynced(WORKOUTS_KEY, workouts);
}

export function loadRoutines() {
  const saved = readJson(ROUTINES_KEY);
  return Array.isArray(saved) ? saved : [];
}

export function saveRoutines(routines) {
  return writeSynced(ROUTINES_KEY, routines);
}

// Which saved workout is planned for each weekday: { 0: routineId, ... } with 0 as Sunday.
export function loadSchedule() {
  const saved = readJson(SCHEDULE_KEY);
  return saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

export function saveSchedule(schedule) {
  return writeSynced(SCHEDULE_KEY, schedule);
}

// { name, age, heightCm, weightKg, goal }, or null before anything has been saved.
export function loadProfile() {
  const saved = readJson(PROFILE_KEY);
  return saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : null;
}

export function saveProfile(profile) {
  return writeSynced(PROFILE_KEY, profile);
}

export function loadTheme() {
  const saved = readJson(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function saveTheme(theme) {
  return writeJson(THEME_KEY, theme);
}

// Which body the muscle map draws: "male" (the default) or "female". Kept on this device.
export function loadFigure() {
  return readJson(FIGURE_KEY) === "female" ? "female" : "male";
}

export function saveFigure(figure) {
  return writeJson(FIGURE_KEY, figure);
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
  removeKeys([GUIDED_KEY]);
}

// A discarded or finished workout takes its guided position with it.
export function clearDraft() {
  removeKeys([GUIDED_KEY, DRAFT_KEY]);
}

// Removes workouts, saved workouts, the weekly plan and any draft; profile and settings stay.
export function clearWorkoutData() {
  const cleared = removeKeys([WORKOUTS_KEY, ROUTINES_KEY, SCHEDULE_KEY, DRAFT_KEY, GUIDED_KEY]);
  if (cleared) notifyDataChange();
  return cleared;
}

// Everything that is backed up to the account, as { workouts, routines, schedule, profile }.
export function loadSyncedData() {
  return { workouts: loadWorkouts(), routines: loadRoutines(), schedule: loadSchedule(), profile: loadProfile() };
}

// Makes this device hold exactly `data` from the account. Does not count as a change to upload.
export function replaceSyncedData({ workouts, routines, schedule, profile }) {
  return writeJson(WORKOUTS_KEY, workouts) && writeJson(ROUTINES_KEY, routines)
    && writeJson(SCHEDULE_KEY, schedule)
    && (profile === null ? removeKeys([PROFILE_KEY]) : writeJson(PROFILE_KEY, profile));
}

// On signing out: removes everything that belongs to the account, plus any unfinished
// workout. Theme and units stay.
export function removeAccountData() {
  return removeKeys([WORKOUTS_KEY, ROUTINES_KEY, SCHEDULE_KEY, PROFILE_KEY, DRAFT_KEY, GUIDED_KEY, SYNC_KEY]);
}

// { syncedAt, dirty, lastSyncMs }: the cloud stamp this device last matched, whether it has
// changed since, and when it last synced (for "Synced 5 min ago").
export function loadSyncState() {
  const saved = readJson(SYNC_KEY);
  return {
    syncedAt: typeof saved?.syncedAt === "number" ? saved.syncedAt : null,
    dirty: saved?.dirty === true,
    lastSyncMs: typeof saved?.lastSyncMs === "number" ? saved.lastSyncMs : null,
  };
}

export function saveSyncState(state) {
  return writeJson(SYNC_KEY, state);
}

export function loadUnit() {
  return readJson(UNIT_KEY) === "kg" ? "kg" : "lb";
}

export function saveUnit(unit) {
  return writeJson(UNIT_KEY, unit);
}
