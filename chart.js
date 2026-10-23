const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 340;
const HEIGHT = 200;
const PAD = { left: 44, right: 16, top: 16, bottom: 30 };
const GRID_LINES = 3;

function svg(tag, attributes = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.append(...children);
  return node;
}

function shortDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeOf(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

// A line chart of `points` ({ date, value, isRecord }), oldest first. Dots that beat every
// earlier point are drawn larger. Returns an <svg>, or null when there is nothing to draw.
export function lineChart(points, description) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.max(high * 0.1, 1);
  const yMin = low - span * 0.2;
  const yMax = high + span * 0.2;

  const firstTime = timeOf(points[0].date);
  const timeSpan = timeOf(points.at(-1).date) - firstTime;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (point) =>
    PAD.left + (timeSpan === 0 ? plotWidth / 2 : ((timeOf(point.date) - firstTime) / timeSpan) * plotWidth);
  const y = (value) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const grid = [];
  for (let index = 0; index < GRID_LINES; index += 1) {
    const value = yMin + ((yMax - yMin) * index) / (GRID_LINES - 1);
    grid.push(
      svg("line", { class: "chart-grid", x1: PAD.left, x2: WIDTH - PAD.right, y1: y(value), y2: y(value) }),
      svg("text", { class: "chart-label", x: PAD.left - 8, y: y(value) + 4, "text-anchor": "end" },
        String(Math.round(value))),
    );
  }

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const dots = points.map((point) => svg("circle", {
    class: point.isRecord ? "chart-dot chart-record" : "chart-dot",
    cx: x(point).toFixed(1),
    cy: y(point.value).toFixed(1),
    r: point.isRecord ? 6 : 4,
  }));

  const dateLabels = points.length === 1
    ? [svg("text", { class: "chart-label", x: WIDTH / 2, y: HEIGHT - 8, "text-anchor": "middle" }, shortDate(points[0].date))]
    : [
      svg("text", { class: "chart-label", x: PAD.left, y: HEIGHT - 8, "text-anchor": "start" }, shortDate(points[0].date)),
      svg("text", { class: "chart-label", x: WIDTH - PAD.right, y: HEIGHT - 8, "text-anchor": "end" }, shortDate(points.at(-1).date)),
    ];

  return svg("svg", { class: "chart", viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: "img", "aria-label": description },
    ...grid,
    points.length > 1 ? svg("path", { class: "chart-line", d: path }) : null,
    ...dots,
    ...dateLabels);
}
