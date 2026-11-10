import { lineChart } from "./chart.js";
import { formatDate } from "./dates.js";
import { byId, detailRow, el, insetList, listRow, scrollToTop, setHeader } from "./dom.js";
import { describeSet } from "./exercises.js";
import { exerciseSummary, listExercises, progressPoints } from "./records.js";

// The exercise whose detail page is open, or null for the list of all exercises.
let selectedName = null;

export function resetProgress() {
  selectedName = null;
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

function renderList(workouts, unit, rerender) {
  const exercises = listExercises(workouts);
  const rows = exercises.map((exercise) => listRow({
    title: exercise.name,
    detail: `${exercise.sessions} ${sessionWord(exercise.sessions)} · last ${formatDate(exercise.lastDate)}`,
    sideTop: "Best",
    sideBottom: describeSet(exercise.type, exercise.record.set, unit),
    label: `Open ${exercise.name}`,
    onTap: () => openLift(exercise.name, rerender),
  }));

  setHeader("progress", { title: "Progress" });
  return exercises.length === 0
    ? [el("section", { class: "card" },
      el("p", { class: "empty", text: "Your records and charts show up here after you log a workout. Every lift you do gets its own page." }))]
    : [
      el("h2", { class: "section-title", text: "Your lifts" }),
      el("ion-list", { class: "card-list", lines: "none" }, ...rows),
    ];
}

function recordCard(label, value) {
  return el("div", { class: "stat-card" },
    el("span", { class: "muted", text: label }),
    el("strong", { text: value }));
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
  const recordSessions = new Set(points.map((point, index) => (point.isRecord ? index : -1)));
  const cards = type === "strength"
    ? [
      recordCard("Best set", describeSet(type, record.set, unit)),
      recordCard("Heaviest", heaviest ? `${heaviest.set.weight} ${unit}` : "Bodyweight"),
      recordCard("Est. 1-rep max", oneRepMax ? `${oneRepMax} ${unit}` : "–"),
    ]
    : [
      recordCard("Best", describeSet(type, record.set, unit)),
      recordCard("Sessions", String(sessions.length)),
    ];

  const chart = lineChart(points, `${CHART_CAPTIONS[type]}, ${points.length} ${sessionWord(points.length)}`);
  const sessionRows = sessions.map((session, index) => detailRow(
    formatDate(session.date),
    session.sets.map((set) => describeSet(type, set, unit)).join(", "),
    recordSessions.has(index) ? "PR" : null)).reverse();

  setHeader("progress", { title: selectedName, backLabel: "Progress", onBack: () => openLift(null, rerender) });
  return [
    el("div", { class: "stat-cards" }, ...cards),
    el("h2", { class: "section-title", text: CHART_CAPTIONS[type] }),
    el("section", { class: "card" },
      chart,
      points.length === 1 ? el("p", { class: "empty", text: "Do this lift again to see your trend." }) : null),
    el("h2", { class: "section-title", text: "Sessions" }),
    insetList(...sessionRows),
  ];
}

export function renderProgress(workouts, unit) {
  const rerender = () => renderProgress(workouts, unit);
  const content = selectedName === null
    ? renderList(workouts, unit, rerender)
    : renderDetail(workouts, unit, rerender);
  byId("progressContent").replaceChildren(...content);
}
