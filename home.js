import { formatDate } from "./dates.js";
import { byId } from "./dom.js";
import { renderHistory } from "./history.js";
import { estimateMinutes, nextRoutine } from "./plan.js";
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

function renderHeader() {
  const now = new Date();
  byId("greeting").textContent = greeting(now);
  byId("homeDate").textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function renderStats(workouts) {
  const { level, into, needed } = levelInfo(totalXp(workouts));
  const percent = Math.round((into / needed) * 100);

  byId("streakNumber").textContent = currentStreak(workouts);
  byId("workoutCount").textContent = workouts.length;
  byId("levelName").textContent = `Level ${level}`;
  byId("levelDetail").textContent = `${titleForLevel(level)} · ${into} / ${needed} XP`;
  byId("levelPercent").textContent = `${percent}%`;
  byId("levelBarFill").style.width = `${percent}%`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// The big lime tile: finish what you started, otherwise the next saved workout in your
// rotation, otherwise a nudge to start logging.
function renderNextTile(workouts, routines, draft, actions) {
  const tile = byId("nextTile");
  const next = nextRoutine(routines, workouts);
  if (draft !== null) {
    byId("nextTag").textContent = "In progress";
    byId("nextTitle").textContent = draft.name.trim() || "Your workout";
    byId("nextMeta").textContent = "Tap to pick it back up";
    tile.onclick = actions.onResume;
  } else if (next !== null) {
    byId("nextTag").textContent = "Up next";
    byId("nextTitle").textContent = next.name;
    byId("nextMeta").textContent = `${plural(next.exercises.length, "exercise")} · about ${estimateMinutes(next)} min`;
    tile.onclick = () => actions.onStartRoutine(next);
  } else {
    byId("nextTag").textContent = workouts.length === 0 ? "Get started" : "Ready when you are";
    byId("nextTitle").textContent = "Log a workout";
    byId("nextMeta").textContent = "Save workouts in the Workouts tab to start them in one tap";
    tile.onclick = actions.onOpenLog;
  }
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

// Draws Home and the History screen. `actions` are { onOpenWorkout, onStartRoutine,
// onResume, onOpenLog }.
export function renderScreens(workouts, routines, draft, actions) {
  renderHeader();
  renderStats(workouts);
  renderNextTile(workouts, routines, draft, actions);
  renderLastWorkout(workouts, actions.onOpenWorkout);
  renderHistory(workouts, actions.onOpenWorkout);
}
