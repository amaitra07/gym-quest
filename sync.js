// Decisions for syncing this device's data with the signed-in person's cloud record. Nothing
// here touches the network or storage, so it can be tested on its own.
//
// What syncs: workouts, saved workouts, the weekly plan and the profile. Theme, units and an
// unfinished workout stay on each device.
//
// The cloud record is { version, updatedAt, data }, where `data` is the JSON text of those four
// things. `updatedAt` changes on every upload, so a device can tell whether another device has
// written since it last synced by comparing it with the value it remembers (`syncedAt`).

export const CLOUD_VERSION = 1;
// Firestore allows about 1 MB per record; stop a little short of it.
export const MAX_CLOUD_CHARACTERS = 900_000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Fills in anything missing, so two copies compare equal when they hold the same things.
export function normalizeData(data) {
  return {
    workouts: Array.isArray(data?.workouts) ? data.workouts : [],
    routines: Array.isArray(data?.routines) ? data.routines : [],
    schedule: isPlainObject(data?.schedule) ? data.schedule : {},
    profile: isPlainObject(data?.profile) ? data.profile : null,
  };
}

export function hasData(data) {
  const { workouts, routines, schedule, profile } = normalizeData(data);
  return workouts.length > 0 || routines.length > 0 || Object.keys(schedule).length > 0 || profile !== null;
}

export function sameData(first, second) {
  return JSON.stringify(normalizeData(first)) === JSON.stringify(normalizeData(second));
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "12 workouts, 3 saved workouts", used when asking which copy to keep.
export function describeData(data) {
  const { workouts, routines } = normalizeData(data);
  return `${plural(workouts.length, "workout")}, ${plural(routines.length, "plan")}`;
}

// The record to upload. `previousUpdatedAt` is the cloud's current stamp, so the new one always
// differs from it even if two uploads land in the same millisecond.
export function packForCloud(data, now, previousUpdatedAt = null) {
  const updatedAt = now === previousUpdatedAt ? now + 1 : now;
  return { version: CLOUD_VERSION, updatedAt, data: JSON.stringify(normalizeData(data)) };
}

// The cloud record turned back into { updatedAt, data }, or null if it is missing or unreadable.
export function unpackFromCloud(record) {
  if (!isPlainObject(record) || record.version !== CLOUD_VERSION) return null;
  if (typeof record.data !== "string" || typeof record.updatedAt !== "number") return null;
  try {
    return { updatedAt: record.updatedAt, data: normalizeData(JSON.parse(record.data)) };
  } catch {
    return null;
  }
}

// What to do now: "upload" this device's data, "download" the cloud's, "ask" which to keep, or
// "none" when they already match. `cloud` is an unpacked record or null; `syncState` is
// { syncedAt, dirty }, where syncedAt is the cloud stamp this device last matched (null if it
// has never synced with this account) and dirty means it changed since.
export function planSync(local, cloud, syncState) {
  if (cloud === null) return hasData(local) ? "upload" : "none";
  if (sameData(local, cloud.data)) return "none";

  if (syncState.syncedAt === null) {
    if (!hasData(local)) return "download";
    if (!hasData(cloud.data)) return "upload";
    return "ask";
  }

  const cloudChanged = cloud.updatedAt !== syncState.syncedAt;
  if (!cloudChanged) return "upload";
  return syncState.dirty ? "ask" : "download";
}

export const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the sign-in form before anything is sent. `mode` is "signIn", "create" or "reset"
// (which needs only the email). Returns { error, field } or null when it is fine to send.
export function checkSignInForm({ email, password }, mode) {
  if (email.trim() === "") return { error: "Enter your email address.", field: "email" };
  if (!EMAIL_PATTERN.test(email.trim())) return { error: "That email address doesn't look right.", field: "email" };
  if (mode === "reset") return null;
  if (password === "") return { error: "Enter your password.", field: "password" };
  if (mode === "create" && password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`, field: "password" };
  }
  return null;
}

// "just now", "5 min ago", "3 hr ago", or a date.
export function syncedAgoText(syncedMs, nowMs) {
  const elapsed = nowMs - syncedMs;
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < 24 * HOUR_MS) return `${Math.floor(elapsed / HOUR_MS)} hr ago`;
  return new Date(syncedMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ERROR_MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/invalid-credential": "That email and password don't match an account. Check them, or create an account.",
  "auth/wrong-password": "That password isn't right. Try again, or tap Forgot password.",
  "auth/user-not-found": "There's no account with that email. Tap Create account to make one.",
  "auth/email-already-in-use": "There's already an account with that email. Tap Sign in instead.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Couldn't reach the internet. Check your connection and try again.",
  "permission-denied": "Your account wasn't allowed to save. Sign out and back in, then try again.",
  "too-big": "Your data is too large to back up in one piece. Your workouts are still safe on this phone.",
  "storage-full": "Couldn't save your account's data on this phone. Your browser may be blocking or out of storage.",
  unavailable: "Couldn't reach the internet. Your changes are safe on this phone and will upload later.",
};

// A sentence for the person from a Firebase error.
export function messageForError(error) {
  return ERROR_MESSAGES[error?.code] ?? "Something went wrong. Check your connection and try again.";
}
