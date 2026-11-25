// The muscle map on Progress: a front and back anatomy figure, each muscle filled in lime by
// how many sets it got in the last 7 days, with notes on what was missed and the details
// of a muscle when it is tapped. Profile picks a male or female figure.

import { el } from "./dom.js";
import { FIGURES } from "./body-shapes.js";
import { MUSCLES, muscleLevel, setsPerMuscle, setsText } from "./muscles.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attributes = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.append(...children);
  return node;
}

// The figures are anatomy artwork (see body-shapes.js): for each body, a front and a back
// view, each with its own coordinates, drawn side by side in nested <svg> boxes.
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 200;
const GAP = 10;

function view(art, x, tally, selected, onPick) {
  const label = (key) => MUSCLES.find((muscle) => muscle.key === key).label;
  const parts = [svg("path", { class: "body-shape", d: art.outline, "aria-hidden": "true" })];
  for (const [key, paths] of art.parts) {
    const drawn = paths.map((d) => svg("path", { d }));
    // Head, hair, hands, feet, knees and the inner thigh are body, not a muscle the map tracks.
    if (key === null) {
      parts.push(svg("g", { class: "body-outline", "aria-hidden": "true" }, ...drawn));
      continue;
    }
    const level = muscleLevel(tally.get(key).sets);
    const group = svg("g", {
      class: `muscle level-${level}${selected === key ? " is-selected" : ""}`,
      role: "button",
      tabindex: 0,
      "aria-label": `${label(key)}, ${setsText(tally.get(key).sets)} this week`,
    }, ...drawn);
    group.addEventListener("click", () => onPick(key));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") onPick(key);
    });
    parts.push(group);
  }
  return svg("svg", { x, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT, viewBox: art.viewBox }, ...parts);
}

function figure(tally, selected, onPick, body) {
  const art = FIGURES[body];
  const backX = VIEW_WIDTH + GAP;
  return svg("svg", { class: "muscle-figure", viewBox: `0 0 ${backX + VIEW_WIDTH} ${VIEW_HEIGHT + 14}` },
    view(art.front, 0, tally, selected, onPick),
    view(art.back, backX, tally, selected, onPick),
    svg("text", { class: "figure-label", x: VIEW_WIDTH / 2, y: VIEW_HEIGHT + 11, "text-anchor": "middle" }, "FRONT"),
    svg("text", { class: "figure-label", x: backX + VIEW_WIDTH / 2, y: VIEW_HEIGHT + 11, "text-anchor": "middle" }, "BACK"));
}

// What a tapped muscle shows: its sets and which exercises they came from.
function muscleDetail(key, entry) {
  const muscle = MUSCLES.find((item) => item.key === key);
  const rows = [...entry.exercises.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, sets]) => el("li", {}, el("span", { text: name }), el("span", { class: "muted", text: setsText(sets) })));
  return el("div", { class: "muscle-detail" },
    el("p", { class: "muscle-detail-title" }, el("strong", { text: muscle.label }), ` · ${setsText(entry.sets)} in the last 7 days`),
    rows.length > 0
      ? el("ul", { class: "muscle-detail-list" }, ...rows)
      : el("p", { class: "muted", text: "Nothing for this muscle in the last 7 days." }));
}

// The whole card. `selected` is the muscle tapped (or null); `onPick(key)` selects one.
// `body` is "male" or "female", chosen in Profile.
export function muscleMapCard(workouts, today, selected, onPick, body) {
  const tally = setsPerMuscle(workouts, today);
  const trainedAny = [...tally.values()].some((entry) => entry.sets > 0);
  const missed = MUSCLES.filter(({ key }) => tally.get(key).sets === 0).map(({ label }) => label);
  const summary = !trainedAny
    ? "No strength sets in the last 7 days. Your map fills in as you train."
    : missed.length === 0
      ? "Every muscle group got work in the last 7 days."
      : `Needs work: ${missed.join(", ")}. No sets in the last 7 days.`;
  return el("section", { class: "card muscle-map" },
    figure(tally, selected, onPick, body),
    el("div", { class: "muscle-legend", "aria-hidden": "true" },
      el("span", { class: "legend-title", text: "Sets" }),
      ...["0", "1–4", "5–9", "10+"].map((text, level) =>
        el("span", { class: `legend-item level-${level}` }, el("i"), text))),
    el("p", { class: trainedAny && missed.length > 0 ? "muscle-summary needs-work" : "muscle-summary", text: summary }),
    selected ? muscleDetail(selected, tally.get(selected)) : el("p", { class: "muted muscle-hint", text: "Tap a muscle to see its sets." }));
}
