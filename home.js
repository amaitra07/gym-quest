import { renderCalendar } from "./calendar.js";
import { byId } from "./dom.js";
import { workoutRow } from "./history-row.js";
import { currentStreak, levelInfo, titleForLevel, totalXp } from "./stats.js";

const RING_RADIUS = 33;
const MAX_VISIBLE_WORKOUTS = 8;

function renderStats(workouts) {
  const { level, into, needed } = levelInfo(totalXp(workouts));

  byId("levelNumber").textContent = level;
  byId("levelTitle").textContent = titleForLevel(level);
  byId("xpIntoLevel").textContent = into;
  byId("xpForLevel").textContent = needed;
  byId("streakNumber").textContent = currentStreak(workouts);
  byId("workoutCount").textContent = workouts.length;

  const circumference = 2 * Math.PI * RING_RADIUS;
  const ring = byId("ringFill");
  ring.style.strokeDasharray = circumference.toFixed(1);
  ring.style.strokeDashoffset = (circumference * (1 - into / needed)).toFixed(1);
}

function renderHistory(workouts, onOpenWorkout) {
  const list = byId("historyList");
  list.replaceChildren();
  byId("historyEmpty").hidden = workouts.length > 0;

  const recent = [...workouts]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, MAX_VISIBLE_WORKOUTS);

  list.append(...recent.map((workout) => workoutRow(workout, onOpenWorkout)));
}

export function renderHome(workouts, hasDraft, onOpenWorkout) {
  renderStats(workouts);
  renderCalendar(workouts, onOpenWorkout);
  renderHistory(workouts, onOpenWorkout);
  byId("startButton").textContent = hasDraft ? "Resume logging" : "Log workout";
}
