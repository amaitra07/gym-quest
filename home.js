import { distanceUnitFor } from "./activity.js";
import { addDays, formatDate, todayIso, WEEKDAY_NAMES } from "./dates.js";
import { byId, el } from "./dom.js";
import { renderHistory } from "./history.js";
import { summarize } from "./history-row.js";
import { countUp, fillBar } from "./motion.js";
import { MUSCLES, musclesFor } from "./muscles.js";
import { estimateMinutes, planLineText, upNext, weekOf } from "./plan.js";
import { latestRecord } from "./records.js";
import { currentStreak, levelInfo, titleForLevel, totalXp } from "./stats.js";

// Home, laid out like the front page of a magazine ("Editorial", Anish's pick on
// 2026-11-27): a headline for the time of day, a line about your week, a dot for each day
// trained, then what's up next with every exercise listed, your latest personal best, and
// your streak, workouts and level.

const NOON_HOUR = 12;
const EVENING_HOUR = 18;
const MUSCLES_IN_SUBTITLE = 3;
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function partOfDay(now) {
  const hour = now.getHours();
  if (hour < NOON_HOUR) return "morning";
  if (hour < EVENING_HOUR) return "afternoon";
  return "evening";
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// "Friday evening." as the big title, a greeting and your streak under it, and the profile
// circle (the first letter of your name, or a person icon).
function renderHeader(profile, workouts) {
  const now = new Date();
  const name = profile?.name?.trim() ?? "";
  const time = partOfDay(now);
  byId("greetingName").textContent = `${WEEKDAY_NAMES[now.getDay()]} ${time}.`;
  const greeting = name === "" ? `Good ${time}.` : `Good ${time}, ${name}.`;
  const streak = currentStreak(workouts);
  byId("homeDate").textContent = streak >= 2 ? `${greeting} ${streak} days running.` : greeting;
  byId("profileInitial").textContent = name.slice(0, 1).toUpperCase();
  byId("profileInitial").hidden = name === "";
  byId("profileIcon").style.display = name === "" ? "" : "none";
}

// This week, Sunday to Saturday: a filled dot on each day with a workout, a ring on today.
function renderWeek(workouts) {
  const trained = new Set(workouts.map((workout) => workout.date));
  const days = weekOf(todayIso()).map(({ iso, weekday, isToday }) => {
    const done = trained.has(iso);
    const label = `${WEEKDAY_NAMES[weekday]}${isToday ? ", today" : ""}${done ? ", trained" : ""}`;
    return el("div", { class: `home-day${isToday ? " home-day-today" : ""}${done ? " home-day-done" : ""}`, "aria-label": label },
      el("span", { text: WEEKDAY_LETTERS[weekday], "aria-hidden": "true" }),
      el("i", { "aria-hidden": "true" }));
  });
  byId("homeWeek").replaceChildren(...days);
}

function renderStats(workouts) {
  const { level, into, needed } = levelInfo(totalXp(workouts));
  countUp(byId("streakNumber"), currentStreak(workouts));
  countUp(byId("workoutCount"), workouts.length);
  countUp(byId("levelNumber"), level);
  byId("levelName").textContent = titleForLevel(level);
  byId("levelDetail").textContent = `${into} / ${needed} XP`;
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

// "Lats and upper back, biceps and traps": the main muscles of a plan's first exercises.
function musclesLine(routine) {
  const keys = [];
  for (const exercise of routine.exercises) {
    for (const key of musclesFor(exercise.name)?.main ?? []) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  const labels = keys.slice(0, MUSCLES_IN_SUBTITLE)
    .map((key, index) => {
      const label = MUSCLES.find((muscle) => muscle.key === key).label;
      return index === 0 ? label : label.toLowerCase();
    });
  if (labels.length < 2) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// A button under the plan; "solid" is filled gold, "outline" a thin gold line.
function startButton(text, fill, onclick) {
  return el("ion-button", { class: `start-button is-${fill}`, fill: fill === "solid" ? "solid" : "outline", text, onclick });
}

// Up next, where every workout starts: finish what you started, otherwise the next workout
// in your weekly plan (or your rotation if you have no schedule) with all its exercises,
// run with timers or logged by hand; with no plans at all, a starter plan. Returns the plan
// it shows, if any, so "Start something else" can leave it out.
function renderNext(workouts, routines, schedule, draft, unit, actions) {
  const plan = upNext(routines, schedule, workouts, todayIso());
  const show = ({ tag, title, meta, minutes = null, exercises = [], buttons }) => {
    byId("nextTag").textContent = tag;
    byId("nextTitle").textContent = title;
    byId("nextMeta").textContent = meta;
    byId("nextMinutesBox").hidden = minutes === null;
    byId("nextMinutes").textContent = minutes ?? "";
    byId("nextTile").classList.toggle("has-minutes", minutes !== null);
    byId("nextExercises").hidden = exercises.length === 0;
    byId("nextExercises").replaceChildren(...exercises.map((exercise) =>
      el("li", {},
        el("span", { class: "exercise-name", text: exercise.name }),
        el("span", { class: "exercise-target", text: planLineText(exercise, unit) }))));
    byId("nextActions").replaceChildren(...buttons);
  };
  if (draft !== null) {
    show({ tag: "In progress", title: draft.name.trim() || "Your workout", meta: "Pick up where you left off.",
      buttons: [startButton("Resume", "solid", actions.onResume)] });
    return null;
  }
  if (plan !== null) {
    const { routine, daysAhead } = plan;
    const muscles = musclesLine(routine);
    const count = plural(routine.exercises.length, "exercise");
    show({
      tag: daysAhead === null ? "Up next" : `Up next · ${whenLabel(daysAhead)}`,
      title: routine.name,
      meta: muscles === "" ? count : `${muscles} · ${count}`,
      minutes: estimateMinutes(routine),
      exercises: routine.exercises,
      buttons: [startButton("Start guided", "solid", () => actions.onStartRoutine(routine)),
        startButton("Log it", "outline", () => actions.onLogRoutine(routine))],
    });
    return routine;
  }
  if (routines.length === 0) {
    show({ tag: "New here?", title: "Get a starter plan", meta: "Answer two questions and get ready-made workouts for your week.",
      buttons: [startButton("Make my plan", "solid", actions.onStarterPlan)] });
    return null;
  }
  show({ tag: "Ready when you are", title: "Log a workout", meta: "Start an empty workout and add exercises as you go.",
    buttons: [startButton("Start", "solid", actions.onStartEmpty)] });
  return null;
}

// "Start something else": every other plan, an empty workout, or an activity.
function renderOtherStart(featured, actions) {
  byId("otherStartButton").onclick = () => actions.onStartOther(featured?.id ?? null);
}

// The record's number, in gold, inside a sentence: "Bench Press, 185 lb for 5."
function recordSentence({ name, type, set }, unit) {
  const gold = (text) => el("em", { class: "num", text });
  if (type === "strength") {
    return set.weight > 0
      ? [`${name}, `, gold(`${set.weight} ${unit}`), ` for ${set.reps}.`]
      : [`${name}, `, gold(plural(set.reps, "rep")), "."];
  }
  if (type === "cardio") {
    return set.distance > 0
      ? [`${name}, `, gold(`${set.distance} ${distanceUnitFor(unit)}`), ` in ${set.minutes} min.`]
      : [`${name}, `, gold(`${set.minutes} min`), "."];
  }
  return [`${name}, `, gold(plural(set.seconds, "second")), "."];
}

function renderRecord(workouts, unit) {
  const record = latestRecord(workouts);
  byId("recordBox").hidden = record === null;
  if (record === null) return;
  byId("recordText").replaceChildren(...recordSentence(record, unit));
  byId("recordDate").textContent = formatDate(record.date);
}

function renderLastWorkout(workouts, onOpenWorkout) {
  const row = byId("lastTile");
  const newestFirst = [...workouts].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
  const last = newestFirst[0];
  row.hidden = last === undefined;
  if (last === undefined) return;
  byId("lastName").textContent = last.name;
  byId("lastMeta").textContent = `${formatDate(last.date)} · ${summarize(last)}`;
  row.onclick = () => onOpenWorkout(last);
}

// Draws Home and the History screen. `actions` are { onOpenWorkout, onDeleteWorkout,
// onStartRoutine, onLogRoutine, onResume, onStartEmpty, onStartOther, onStarterPlan, onLogDay }.
export function renderScreens(workouts, routines, schedule, profile, draft, unit, actions) {
  renderHeader(profile, workouts);
  renderWeek(workouts);
  renderOtherStart(renderNext(workouts, routines, schedule, draft, unit, actions), actions);
  renderRecord(workouts, unit);
  renderStats(workouts);
  renderLastWorkout(workouts, actions.onOpenWorkout);
  renderHistory(workouts, actions.onOpenWorkout, actions.onDeleteWorkout, actions.onLogDay);
}
