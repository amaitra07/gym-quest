import { addDays, formatDate, todayIso } from "./dates.js";
import { byId, el } from "./dom.js";
import { renderHistory } from "./history.js";
import { countUp, fillBar } from "./motion.js";
import { estimateMinutes, upNext } from "./plan.js";
import { summarize } from "./history-row.js";
import { currentStreak, levelInfo, titleForLevel, totalXp } from "./stats.js";

const NOON_HOUR = 12;
const EVENING_HOUR = 18;

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < NOON_HOUR) return "Good morning";
  if (hour < EVENING_HOUR) return "Good afternoon";
  return "Good evening";
}

// Your name as the big title, the greeting and date under it, and the profile circle (the
// first letter of your name, or a person icon).
function renderHeader(profile) {
  const now = new Date();
  const name = profile?.name?.trim() ?? "";
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  byId("greetingName").textContent = name || "Let's go";
  byId("homeDate").textContent = `${greeting(now)} · ${date}`;
  byId("profileInitial").textContent = name.slice(0, 1).toUpperCase();
  byId("profileInitial").hidden = name === "";
  byId("profileIcon").style.display = name === "" ? "" : "none";
}

function renderStats(workouts) {
  const { level, into, needed } = levelInfo(totalXp(workouts));
  const percent = Math.round((into / needed) * 100);

  countUp(byId("streakNumber"), currentStreak(workouts));
  countUp(byId("workoutCount"), workouts.length);
  byId("levelName").textContent = `Level ${level}`;
  byId("levelDetail").textContent = `${titleForLevel(level)} · ${into} / ${needed} XP`;
  countUp(byId("levelPercent"), percent, (value) => `${value}%`);
  fillBar(byId("levelBar"), into / needed);
}

// "Today", "Tomorrow", a weekday name, or "Next Friday" when it is a week away.
function whenLabel(daysAhead) {
  if (daysAhead === 0) return "Today";
  if (daysAhead === 1) return "Tomorrow";
  const [year, month, day] = addDays(todayIso(), daysAhead).split("-").map(Number);
  const weekday = new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long" });
  return daysAhead === 7 ? `Next ${weekday}` : weekday;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// A button inside the lime tile; "solid" is dark, "outline" is a dark ring.
function tileButton(text, fill, onclick) {
  return el("ion-button", { class: `tile-button is-${fill}`, fill: fill === "solid" ? "solid" : "outline", text, onclick });
}

// The big lime tile, where every workout starts: finish what you started, otherwise the
// next workout in your weekly plan (or your rotation if you have no schedule), run with
// timers or logged by hand; with no plans at all, a starter plan. Returns the plan it
// shows, if any, so "Start something else" can leave it out.
function renderNextTile(workouts, routines, schedule, draft, actions) {
  const plan = upNext(routines, schedule, workouts, todayIso());
  const show = (tag, title, meta, ...buttons) => {
    byId("nextTag").textContent = tag;
    byId("nextTitle").textContent = title;
    byId("nextMeta").textContent = meta;
    byId("nextActions").replaceChildren(...buttons);
  };
  if (draft !== null) {
    show("In progress", draft.name.trim() || "Your workout", "Pick up where you left off.",
      tileButton("Resume", "solid", actions.onResume));
    return null;
  }
  if (plan !== null) {
    const { routine, daysAhead } = plan;
    show(daysAhead === null ? "Up next" : `Up next · ${whenLabel(daysAhead)}`, routine.name,
      `${plural(routine.exercises.length, "exercise")} · about ${estimateMinutes(routine)} min`,
      tileButton("Start guided", "solid", () => actions.onStartRoutine(routine)),
      tileButton("Log it", "outline", () => actions.onLogRoutine(routine)));
    return routine;
  }
  if (routines.length === 0) {
    show("New here?", "Get a starter plan", "Answer two questions and get ready-made workouts for your week.",
      tileButton("Make my plan", "solid", actions.onStarterPlan));
    return null;
  }
  show("Ready when you are", "Log a workout", "Start an empty workout and add exercises as you go.",
    tileButton("Start", "solid", actions.onStartEmpty));
  return null;
}

// "Start something else": every other plan, an empty workout, or an activity.
function renderOtherStart(featured, actions) {
  byId("otherStartButton").onclick = () => actions.onStartOther(featured?.id ?? null);
}

function renderLastWorkout(workouts, onOpenWorkout) {
  const tile = byId("lastTile");
  const newestFirst = [...workouts].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
  const last = newestFirst[0];
  tile.hidden = last === undefined;
  if (last === undefined) return;
  byId("lastName").textContent = last.name;
  byId("lastMeta").textContent = `${formatDate(last.date)} · ${summarize(last)}`;
  byId("lastXp").textContent = `+${last.xp || 0} XP`;
  tile.onclick = () => onOpenWorkout(last);
}

// Draws Home and the History screen. `actions` are { onOpenWorkout, onDeleteWorkout,
// onStartRoutine, onLogRoutine, onResume, onStartEmpty, onStartOther, onStarterPlan, onLogDay }.
export function renderScreens(workouts, routines, schedule, profile, draft, actions) {
  renderHeader(profile);
  renderStats(workouts);
  renderOtherStart(renderNextTile(workouts, routines, schedule, draft, actions), actions);
  renderLastWorkout(workouts, actions.onOpenWorkout);
  renderHistory(workouts, actions.onOpenWorkout, actions.onDeleteWorkout, actions.onLogDay);
}
