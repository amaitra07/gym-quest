import {
  createAccount,
  readCloudRecord,
  sendPasswordReset,
  signIn,
  signOutUser,
  watchUser,
  writeCloudRecord,
} from "./cloud.js";
import { button, byId, chooseOption, confirmAction, detailRow, el, fieldRow, fieldText, focusField, insetList, openSheet, showToast } from "./dom.js";
import { loadSyncedData, loadSyncState, onDataChange, removeAccountData, replaceSyncedData, saveSyncState } from "./storage.js";
import {
  checkSignInForm,
  describeData,
  MAX_CLOUD_CHARACTERS,
  messageForError,
  packForCloud,
  planSync,
  syncedAgoText,
  unpackFromCloud,
} from "./sync.js";

// Signing in and keeping this device in step with the person's account. Every save marks the
// data as changed and uploads it shortly after; opening the app, coming back to it, and
// getting a connection back all check the account for changes made on another device.
// The decisions themselves are in sync.js.

// Waits for a burst of saves (loading sample data writes three things) to finish first.
const UPLOAD_DELAY_MS = 1500;

const account = {
  status: "loading", // "loading", "signedOut", "signedIn" or "unavailable" (Firebase didn't load)
  user: null, // { uid, email }
  syncing: false,
  problem: null, // a sentence for the person when the last sync didn't finish
};

// An Error with a `code` that messageForError knows, like Firebase's own errors.
function syncError(code) {
  return Object.assign(new Error(code), { code });
}

let onDataReplaced = () => {};
// Counts saves, so a save made while an upload is on its way still counts as unsynced.
let changeCount = 0;
let uploadTimer = null;
let runningSync = null;
let syncAgain = false;
// Set when the person cancels "which copy to keep?", so saves don't keep asking; Sync now asks again.
let choiceDeclined = false;

// `onDataReplaced` runs after the account's data replaces this device's, so screens redraw.
export function initAccount({ onDataReplaced: onReplaced }) {
  onDataReplaced = onReplaced;
  onDataChange(() => {
    changeCount += 1;
    saveSyncState({ ...loadSyncState(), dirty: true });
    if (account.status === "signedIn") {
      clearTimeout(uploadTimer);
      uploadTimer = setTimeout(() => syncNow(), UPLOAD_DELAY_MS);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
  window.addEventListener("online", () => {
    if (account.status === "unavailable") startWatching();
    else syncNow();
  });
  startWatching();
}

function startWatching() {
  account.status = "loading";
  renderAccountSection();
  watchUser(handleUser).catch(() => {
    account.status = "unavailable";
    renderAccountSection();
  });
}

// Runs on opening the app and whenever someone signs in or out.
function handleUser(user) {
  account.user = user;
  account.status = user ? "signedIn" : "signedOut";
  account.problem = null;
  choiceDeclined = false;
  renderAccountSection();
  if (user) syncNow();
}

// Checks the account and uploads or downloads as needed. Calls made while a sync is running
// wait for it and then run once more, so the latest save is never left behind. `askAgain`
// is true when the person tapped Sync now.
export function syncNow(askAgain = false) {
  if (askAgain) choiceDeclined = false;
  if (account.status !== "signedIn") return Promise.resolve();
  if (runningSync) {
    syncAgain = true;
    return runningSync;
  }
  runningSync = runSync().finally(() => {
    runningSync = null;
    if (syncAgain) {
      syncAgain = false;
      syncNow();
    }
  });
  return runningSync;
}

async function runSync() {
  clearTimeout(uploadTimer);
  const { uid } = account.user;
  account.syncing = true;
  renderAccountSection();
  try {
    if (!navigator.onLine) throw syncError("unavailable");
    const record = await readCloudRecord(uid);
    const cloud = unpackFromCloud(record);
    if (record !== null && cloud === null) {
      // Never overwrite a record this version can't read; a newer version of the app wrote it.
      account.problem = "Your account was saved by a newer version of Gym Quest. Reload the page to update.";
      return;
    }
    const startCount = changeCount;
    const local = loadSyncedData();
    let action = planSync(local, cloud, loadSyncState());
    if (action === "ask") action = choiceDeclined ? null : await askWhichToKeep(local, cloud);
    if (account.user?.uid !== uid) return; // signed out while deciding
    if (action === null) {
      choiceDeclined = true;
      account.problem = "Not synced yet. Tap Sync now to choose which copy to keep.";
      return;
    }
    if (action === "upload") {
      const packed = packForCloud(local, Date.now(), cloud?.updatedAt ?? null);
      if (packed.data.length > MAX_CLOUD_CHARACTERS) throw syncError("too-big");
      await writeCloudRecord(uid, packed);
      markSynced(packed.updatedAt, startCount);
    } else if (action === "download") {
      if (!replaceSyncedData(cloud.data)) throw syncError("storage-full");
      markSynced(cloud.updatedAt, changeCount);
      onDataReplaced();
    } else {
      markSynced(cloud?.updatedAt ?? null, startCount);
    }
    account.problem = null;
  } catch (error) {
    account.problem = messageForError(error);
  } finally {
    account.syncing = false;
    renderAccountSection();
  }
}

function markSynced(syncedAt, countWhenRead) {
  saveSyncState({ syncedAt, dirty: changeCount !== countWhenRead, lastSyncMs: Date.now() });
}

// Both copies have changed (or this is the first sign-in on a device that already has data),
// so the person decides which one wins. Resolves to "download", "upload", or null if cancelled.
function askWhichToKeep(local, cloud) {
  return chooseOption("This phone and your account have different workouts. Which should Gym Quest keep? The other copy will be replaced.", [
    { label: `Use my account's (${describeData(cloud.data)})`, value: "download" },
    { label: `Keep this phone's (${describeData(local)})`, value: "upload" },
  ]);
}

/* ---------- Screens ---------- */

function actionRow(text, color, onclick, disabled = false) {
  return el("ion-item", { button: "true", detail: "false", onclick, ...(disabled ? { disabled: "true" } : {}) },
    el("ion-label", { color, text }));
}

function note(text) {
  return el("p", { class: "muted list-note", text });
}

function lastSyncedText() {
  if (account.syncing) return "Syncing…";
  if (account.problem) return "Not synced";
  const { lastSyncMs } = loadSyncState();
  return lastSyncMs === null ? "Not yet" : syncedAgoText(lastSyncMs, Date.now());
}

function accountRows() {
  if (account.status === "loading") {
    return [insetList(detailRow("Account", "Checking…"))];
  }
  if (account.status === "unavailable") {
    return [
      insetList(detailRow("Account", "Offline")),
      note("Connect to the internet to sign in. Your workouts are saved on this phone."),
    ];
  }
  if (account.status === "signedOut") {
    return [
      insetList(actionRow("Sign in or create account", "primary", openSignInSheet)),
      note("Back up your workouts and use them on any device. Without an account they're saved only on this phone."),
    ];
  }
  return [
    insetList(
      detailRow("Signed in as", account.user.email),
      detailRow("Last synced", lastSyncedText()),
      actionRow("Sync now", "primary", syncFromButton, account.syncing),
      actionRow("Sign out", "danger", confirmSignOut)),
    note(account.problem ?? "Every change you save backs up to your account automatically."),
  ];
}

// Fills the Account section of the Profile screen, if it is on the page.
export function renderAccountSection() {
  byId("accountSection")?.replaceChildren(...accountRows());
}

async function syncFromButton() {
  await syncNow(true);
  showToast(account.problem ?? "Synced. Your account is up to date.");
}

async function confirmSignOut() {
  await syncNow();
  const unsynced = loadSyncState().dirty;
  const confirmed = await confirmAction(
    unsynced ? "Some changes haven't reached your account. Sign out anyway?" : "Sign out?",
    "Sign out",
    {
      detail: unsynced
        ? "Signing out now loses them. Connect to the internet and tap Sync now first to keep them."
        : "Your workouts will be removed from this phone. They stay in your account; sign in again to get them back.",
    });
  if (!confirmed) return;
  try {
    await signOutUser();
  } catch (error) {
    showToast(messageForError(error));
    return;
  }
  removeAccountData();
  onDataReplaced();
  showToast("Signed out. Your workouts are safe in your account.");
}

// The sheet with email, password, and Sign in / Create account / Forgot password.
function openSignInSheet() {
  const sheet = openSheet("Account");
  const email = el("ion-input", {
    label: "Email", class: "value-end", type: "email", inputmode: "email",
    autocomplete: "email", autocapitalize: "off", placeholder: "you@example.com",
  });
  const password = el("ion-input", {
    label: "Password", class: "value-end", type: "password",
    autocomplete: "current-password", placeholder: "At least 6 characters",
  }, el("ion-input-password-toggle", { slot: "end" }));
  const message = el("p", { class: "form-error", role: "alert", hidden: true });
  const fields = { email, password };

  const buttons = {
    signIn: button("primary", { text: "Sign in", onclick: () => submit("signIn") }),
    create: button("secondary", { text: "Create account", onclick: () => submit("create") }),
    reset: button("text", { text: "Forgot password?", onclick: () => submit("reset") }),
  };

  function show(text, isError = true) {
    message.textContent = text;
    message.className = isError ? "form-error" : "muted";
    message.hidden = false;
  }

  async function submit(mode) {
    const form = { email: fieldText(email).trim(), password: fieldText(password) };
    const problem = checkSignInForm(form, mode);
    if (problem) {
      show(problem.error);
      focusField(fields[problem.field]);
      return;
    }
    for (const control of Object.values(buttons)) control.disabled = true;
    show(mode === "reset" ? "Sending…" : "Connecting…", false);
    try {
      if (mode === "reset") {
        await sendPasswordReset(form.email);
        show(`If there's an account for ${form.email}, a link to choose a new password is on its way. Check your email.`, false);
        return;
      }
      await (mode === "create" ? createAccount(form.email, form.password) : signIn(form.email, form.password));
      sheet.close();
      showToast(mode === "create" ? "Account created. Backing up your workouts…" : "Signed in. Syncing your workouts…");
    } catch (error) {
      show(messageForError(error));
    } finally {
      for (const control of Object.values(buttons)) control.disabled = false;
    }
  }

  sheet.content.append(
    el("p", { class: "muted", text: "Sign in to back up your workouts and use them on any device. New here? Enter your email and a password, then tap Create account." }),
    insetList(fieldRow(email), fieldRow(password)),
    message,
    buttons.signIn,
    buttons.create,
    buttons.reset);
}
