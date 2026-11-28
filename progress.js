import { lineChart } from "./chart.js";
import { formatDate, todayIso } from "./dates.js";
import { byId, el, scrollToTop, setHeader } from "./dom.js";
import { describeSet } from "./exercises.js";
import { muscleMapCard } from "./muscle-map.js";
import { loadFigure } from "./storage.js";
import { exerciseSummary, listExercises, progressPoints } from "./records.js";

// The exercise whose detail page is open, or null for the list of all exercises.
let selectedName = null;
// The muscle tapped on the muscle map, or null.
let selectedMuscle = null;

export function resetProgress() {
  selectedName = null;
  selectedMuscle = null;
}

const CHART_CAPTIONS = {
  strength: "Estimated 1-rep max per session",
  cardio: "Best distance or minutes per session",
  timed: "Longest hold per session (seconds)",
};

function sessionWord(count) {
  return count === 1 ? "session" : "sessions";
}

function openLift(name, rerender) {
  selectedName = name;
  rerender();
  scrollToTop("progress");
}

// One lift as a serif row on a thin gold line: its name, how often and when you last did
// it, and your best set in gold. Tapping opens the lift's own page.
function liftRow(exercise, unit, rerender) {
  const lastDone = formatDate(exercise.lastDate).replace(/^(Today|Yesterday)$/, (word) => word.toLowerCase());
  const best = describeSet(exercise.type, exercise.record.set, unit);
  return el("button", {
    class: "text-row lift-row",
    type: "button",
    role: "listitem",
    "aria-label": `Open ${exercise.name}, best ${best}`,
    onclick: () => openLift(exercise.name, rerender),
  },
  el("span", { class: "lift-row-text" },
    el("span", { class: "lift-row-name", text: exercise.name }),
    el("span", { class: "lift-row-meta", text: `${exercise.sessions} ${sessionWord(exercise.sessions)} · last ${lastDone}` })),
  el("span", { class: "lift-row-best" },
    el("span", { class: "kicker", text: "Best" }),
    el("span", { class: "lift-row-value num", text: best })));
}

function renderList(workouts, unit, rerender) {
  const exercises = listExercises(workouts);
  setHeader("progress", { title: "Progress" });
  const headline = el("h1", { class: "headline", text: "Your progress." });
  if (exercises.length === 0) {
    return [headline,
      el("p", { class: "lede", text: "Your records and charts show up here after you log a workout. Every lift you do gets its own page." })];
  }
  return [
    headline,
    el("h2", { class: "kicker", text: "Muscles · last 7 days" }),
    muscleMapCard(workouts, todayIso(), selectedMuscle, (key) => {
      selectedMuscle = selectedMuscle === key ? null : key;
      rerender();
    }, loadFigure()),
    el("h2", { class: "kicker", text: "Your lifts" }),
    el("div", { class: "lift-list", role: "list" }, ...exercises.map((exercise) => liftRow(exercise, unit, rerender))),
  ];
}

// A record as a column: a small gold label over a serif value.
function recordColumn(label, value) {
  return el("div", { class: "record-column" },
    el("span", { class: "kicker", text: label }),
    el("b", { class: "num", text: value }));
}

// One past session: its date, every set, and a gold "PR" when it set a record.
function sessionRow(session, type, unit, isRecord) {
  return el("div", { class: "session-row", role: "listitem" },
    el("span", { class: "session-date", text: formatDate(session.date) }),
    el("span", { class: "session-sets num", text: session.sets.map((set) => describeSet(type, set, unit)).join(", ") }),
    isRecord ? el("span", { class: "session-pr", text: "PR" }) : null);
}

function renderDetail(workouts, unit, rerender) {
  const summary = exerciseSummary(workouts, selectedName);
  if (summary === null) {
    // The workout that held this lift was deleted or renamed, so go back to the list.
    selectedName = null;
    return renderList(workouts, unit, rerender);
  }

  const { type, sessions, record, heaviest, oneRepMax } = summary;
  const points = progressPoints(sessions);
  const columns = type === "strength"
    ? [
      recordColumn("Best set", describeSet(type, record.set, unit)),
      recordColumn("Heaviest", heaviest ? `${heaviest.set.weight} ${unit}` : "Bodyweight"),
      recordColumn("Est. 1RM", oneRepMax ? `${oneRepMax} ${unit}` : "–"),
    ]
    : [
      recordColumn("Best", describeSet(type, record.set, unit)),
      recordColumn("Sessions", String(sessions.length)),
    ];

  const chart = lineChart(points, `${CHART_CAPTIONS[type]}, ${points.length} ${sessionWord(points.length)}`);
  const rows = sessions.map((session, index) => sessionRow(session, type, unit, points[index].isRecord)).reverse();

  setHeader("progress", { title: "", backLabel: "Progress", onBack: () => openLift(null, rerender) });
  return [
    el("h1", { class: "headline", text: selectedName }),
    el("div", { class: "record-columns" }, ...columns),
    el("h2", { class: "kicker", text: CHART_CAPTIONS[type] }),
    el("section", { class: "chart-section" },
      chart,
      points.length === 1 ? el("p", { class: "lede", text: "Do this lift again to see your trend." }) : null),
    el("h2", { class: "kicker", text: "Sessions" }),
    el("div", { class: "session-list", role: "list" }, ...rows),
  ];
}

export function renderProgress(workouts, unit) {
  const rerender = () => renderProgress(workouts, unit);
  const content = selectedName === null
    ? renderList(workouts, unit, rerender)
    : renderDetail(workouts, unit, rerender);
  byId("progressContent").replaceChildren(...content);
}
