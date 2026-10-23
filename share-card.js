import { describeSet } from "./exercises.js";

// Draws the shareable summary of a finished workout as a PNG (see workoutSummary in
// records.js for the input). Everything is drawn on a canvas, so nothing leaves the phone.

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 80;
const FONT = '"Inter", -apple-system, system-ui, sans-serif';
const COLORS = {
  background: "#0a0a0c",
  panel: "#16161a",
  line: "#26262d",
  text: "#f4f4f5",
  dim: "#8e8e98",
  accent: "#c8f542",
  accentInk: "#0a0a0c",
};
const MAX_EXERCISE_LINES = 6;
const MAX_RECORD_LINES = 3;
const FONT_WAIT_MS = 1500;

function fit(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}…`;
}

function roundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

// Draws text at `size`, shrinking it down to `minSize` before cutting it with an ellipsis.
function write(context, text, x, y, { size, minSize = size, weight = 700, color = COLORS.text, align = "left", maxWidth = WIDTH - MARGIN * 2 }) {
  let fontSize = size;
  context.font = `${weight} ${fontSize}px ${FONT}`;
  while (fontSize > minSize && context.measureText(text).width > maxWidth) {
    fontSize -= 4;
    context.font = `${weight} ${fontSize}px ${FONT}`;
  }
  context.fillStyle = color;
  context.textAlign = align;
  context.fillText(fit(context, text, maxWidth), x, y);
}

async function waitForFont() {
  try {
    await Promise.race([
      document.fonts.load(`800 60px ${FONT}`),
      new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
    ]);
  } catch {
    // Fall back to the system font if Inter cannot load.
  }
}

function longDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export async function drawShareCard(summary, unit) {
  await waitForFont();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  roundedRect(context, MARGIN, 90, 14, 62, 7, COLORS.accent);
  write(context, "GYM QUEST", MARGIN + 36, 140, { size: 44, weight: 800, color: COLORS.accent });

  write(context, summary.name, MARGIN, 270, { size: 104, minSize: 56, weight: 800 });
  write(context, longDate(summary.date), MARGIN, 335, { size: 40, weight: 500, color: COLORS.dim });

  const stats = [
    [String(summary.exerciseCount), summary.exerciseCount === 1 ? "exercise" : "exercises"],
    [String(summary.setCount), summary.setCount === 1 ? "set" : "sets"],
    [summary.volume.toLocaleString(), `${unit} lifted`],
  ];
  const gap = 24;
  const boxWidth = (WIDTH - MARGIN * 2 - gap * 2) / 3;
  stats.forEach(([value, label], index) => {
    const x = MARGIN + index * (boxWidth + gap);
    roundedRect(context, x, 400, boxWidth, 190, 28, COLORS.panel);
    write(context, value, x + boxWidth / 2, 505, { size: 76, weight: 800, color: COLORS.accent, align: "center", maxWidth: boxWidth - 24 });
    write(context, label, x + boxWidth / 2, 558, { size: 32, weight: 500, color: COLORS.dim, align: "center", maxWidth: boxWidth - 24 });
  });

  let y = 680;
  const records = summary.records.slice(0, MAX_RECORD_LINES);
  if (records.length > 0) {
    write(context, "NEW PERSONAL RECORDS", MARGIN, y, { size: 34, weight: 800, color: COLORS.accent });
    y += 30;
    for (const record of records) {
      roundedRect(context, MARGIN, y, WIDTH - MARGIN * 2, 96, 24, COLORS.accent);
      write(context, record.name, MARGIN + 32, y + 63, { size: 42, weight: 800, color: COLORS.accentInk, maxWidth: 520 });
      write(context, describeSet(record.type, record.set, unit), WIDTH - MARGIN - 32, y + 63, { size: 42, weight: 800, color: COLORS.accentInk, align: "right", maxWidth: 400 });
      y += 116;
    }
    y += 24;
  }

  // Lifts that set a record already have their own highlighted row above.
  const recordNames = new Set(records.map((record) => record.name.toLowerCase()));
  const lines = summary.lines
    .filter((line) => !recordNames.has(line.name.toLowerCase()))
    .slice(0, MAX_EXERCISE_LINES);
  const room = Math.floor((1210 - y) / 78);
  for (const line of lines.slice(0, Math.max(room, 0))) {
    context.fillStyle = COLORS.line;
    context.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 2);
    write(context, line.name, MARGIN, y + 52, { size: 40, weight: 600, maxWidth: 520 });
    write(context, describeSet(line.type, line.set, unit), WIDTH - MARGIN, y + 52, { size: 40, weight: 500, color: COLORS.dim, align: "right", maxWidth: 420 });
    y += 78;
  }

  write(context, "Logged with Gym Quest", MARGIN, 1270, { size: 34, weight: 500, color: COLORS.dim });
  write(context, `+${summary.xp} XP`, WIDTH - MARGIN, 1270, { size: 44, weight: 800, color: COLORS.accent, align: "right" });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image."))), "image/png");
  });
}
