import { lineChart } from "./chart.js";
import { formatDate } from "./dates.js";
import { byId, el } from "./dom.js";
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

function renderList(workouts, unit, rerender) {
  const exercises = listExercises(workouts);
  const rows = exercises.map((exercise) => el("li", {},
    el("button", {
      class: "history-item",
      type: "button",
      "aria-label": `Open ${exercise.name}`,
      onclick: () => {
        selectedName = exercise.name;
        rerender();
        window.scrollTo(0, 0);
      },
    },
    el("span", { class: "history-main" },
      el("span", { class: "history-name", text: exercise.name }),
      el("span", { class: "muted", text: `${exercise.sessions} ${sessionWord(exercise.sessions)} · last ${formatDate(exercise.lastDate)}` })),
    el("span", { class: "history-side" },
      el("span", { class: "when", text: "Best" }),
      el("span", { class: "xp", text: describeSet(exercise.type, exercise.record.set, unit) })))));

  return [
    el("h1", { class: "screen-title", text: "Progress" }),
    exercises.length === 0
      ? el("section", { class: "panel" },
        el("p", { class: "empty", text: "Your records and charts show up here after you log a workout. Every lift you do gets its own page." }))
      : el("section", { class: "panel card-list" },
        el("h2", { text: "Your lifts" }),
        el("ul", { class: "history" }, ...rows)),
  ];
}

function recordCard(label, value) {
  return el("div", { class: "record-card" },
    el("span", { class: "muted", text: label }),
    el("strong", { text: value }));
}

function renderDetail(workouts, unit, rerender) {
  const summary = exerciseSummary(workouts, selectedName);
  const back = el("button", {
    class: "back-button",
    type: "button",
    text: "← Progress",
    onclick: () => {
      selectedName = null;
      rerender();
      window.scrollTo(0, 0);
    },
  });
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
  const sessionRows = sessions.map((session, index) => el("li", { class: "session-row" },
    el("span", { class: "session-date", text: formatDate(session.date) }),
    el("span", { class: "session-sets", text: session.sets.map((set) => describeSet(type, set, unit)).join(", ") }),
    recordSessions.has(index) ? el("span", { class: "pr-badge", text: "PR" }) : null)).reverse();

  return [
    el("div", { class: "top-bar" }, back),
    el("h1", { class: "screen-title", text: selectedName }),
    el("div", { class: "record-cards" }, ...cards),
    el("section", { class: "panel" },
      el("h2", { text: CHART_CAPTIONS[type] }),
      chart,
      points.length === 1 ? el("p", { class: "empty", text: "Do this lift again to see your trend." }) : null),
    el("section", { class: "panel" },
      el("h2", { text: "Sessions" }),
      el("ul", { class: "history" }, ...sessionRows)),
  ];
}

export function renderProgress(workouts, unit) {
  const rerender = () => renderProgress(workouts, unit);
  const content = selectedName === null
    ? renderList(workouts, unit, rerender)
    : renderDetail(workouts, unit, rerender);
  byId("progressContent").replaceChildren(...content);
}
