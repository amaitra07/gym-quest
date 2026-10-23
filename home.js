import { byId } from "./dom.js";
import { renderHistory } from "./history.js";
import { currentStreak, levelInfo, titleForLevel, totalXp } from "./stats.js";

const RING_RADIUS = 33;

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

export function renderScreens(workouts, hasDraft, onOpenWorkout) {
  renderStats(workouts);
  renderHistory(workouts, onOpenWorkout);
  byId("startButton").textContent = hasDraft ? "Resume logging" : "Log workout";
}
