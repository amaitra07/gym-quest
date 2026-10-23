const WORKOUTS_KEY = "gymquest.workouts";
const DRAFT_KEY = "gymquest.draft";
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

export function loadDraft() {
  const draft = readJson(DRAFT_KEY);
  return draft && Array.isArray(draft.exercises) ? draft : null;
}

export function saveDraft(draft) {
  return writeJson(DRAFT_KEY, draft);
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function loadUnit() {
  return readJson(UNIT_KEY) === "kg" ? "kg" : "lb";
}

export function saveUnit(unit) {
  return writeJson(UNIT_KEY, unit);
}
