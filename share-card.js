import { describeSet } from "./exercises.js";
import { headlineStat } from "./records.js";

// Draws the shareable summary of a finished workout as a PNG (see workoutSummary in
// records.js for the input). Everything is drawn on a canvas, so nothing leaves the phone.

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 80;
const SANS = '"Inter", -apple-system, system-ui, sans-serif';
const SERIF = '"Fraunces", Georgia, serif';
// The gold "Editorial" look: warm black, a soft gold light in the corner, thin gold lines.
const COLORS = {
  background: "#0c0b09",
  glow: "rgba(212, 185, 127, 0.16)",
  hair: "rgba(212, 185, 127, 0.28)",
  text: "#ece6da",
  dim: "#8a8478",
  gold: "#d4b97f",
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

function hairline(context, y) {
  context.fillStyle = COLORS.hair;
  context.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 2);
}

// Draws text at `size`, shrinking it down to `minSize` before cutting it with an ellipsis.
// `spacing` spreads the letters, for the small gold capitals.
function write(context, text, x, y, {
  size, minSize = size, weight = 400, color = COLORS.text, align = "left", maxWidth = WIDTH - MARGIN * 2,
  family = SANS, italic = false, spacing = 0,
}) {
  const font = (fontSize) => `${italic ? "italic " : ""}${weight} ${fontSize}px ${family}`;
  let fontSize = size;
  context.font = font(fontSize);
  context.letterSpacing = `${spacing}px`;
  while (fontSize > minSize && context.measureText(text).width > maxWidth) {
    fontSize -= 4;
    context.font = font(fontSize);
  }
  context.fillStyle = color;
  context.textAlign = align;
  context.fillText(fit(context, text, maxWidth), x, y);
  context.letterSpacing = "0px";
}

async function waitForFont() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`500 40px ${SANS}`),
        document.fonts.load(`300 120px ${SERIF}`),
        document.fonts.load(`italic 300 120px ${SERIF}`),
      ]),
      new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
    ]);
  } catch {
    // Fall back to the system fonts if the web fonts cannot load.
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
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, 900);
  glow.addColorStop(0, COLORS.glow);
  glow.addColorStop(1, "rgba(212, 185, 127, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  write(context, "GYM QUEST", MARGIN, 140, { size: 30, weight: 500, color: COLORS.gold, spacing: 9 });
  write(context, summary.name, MARGIN, 280, { size: 120, minSize: 64, weight: 300, family: SERIF, italic: true });
  write(context, longDate(summary.date), MARGIN, 345, { size: 36, color: COLORS.dim });

  // The workout in numbers: three columns between thin gold lines.
  const stats = [
    [String(summary.exerciseCount), summary.exerciseCount === 1 ? "EXERCISE" : "EXERCISES"],
    [String(summary.setCount), summary.setCount === 1 ? "SET" : "SETS"],
    headlineStat(summary, unit).map((part, index) => (index === 1 ? part.toUpperCase() : part)),
  ];
  const columnWidth = (WIDTH - MARGIN * 2) / 3;
  hairline(context, 410);
  hairline(context, 610);
  stats.forEach(([value, label], index) => {
    const x = MARGIN + index * columnWidth + (index === 0 ? 0 : 36);
    if (index > 0) {
      context.fillStyle = COLORS.hair;
      context.fillRect(MARGIN + index * columnWidth, 410, 2, 200);
    }
    write(context, label, x, 470, { size: 24, weight: 500, color: COLORS.gold, spacing: 6, maxWidth: columnWidth - 48 });
    write(context, value, x, 570, { size: 80, minSize: 48, weight: 300, family: SERIF, maxWidth: columnWidth - 48 });
  });

  let y = 700;
  const records = summary.records.slice(0, MAX_RECORD_LINES);
  if (records.length > 0) {
    write(context, "NEW PERSONAL RECORDS", MARGIN, y, { size: 24, weight: 500, color: COLORS.gold, spacing: 6 });
    y += 30;
    for (const record of records) {
      write(context, record.name, MARGIN, y + 66, { size: 46, weight: 300, family: SERIF, maxWidth: 520 });
      write(context, describeSet(record.type, record.set, unit), WIDTH - MARGIN, y + 66, {
        size: 44, weight: 300, family: SERIF, italic: true, color: COLORS.gold, align: "right", maxWidth: 400,
      });
      y += 100;
      hairline(context, y);
    }
  }

  // Lifts that set a record already have their own line above.
  const recordNames = new Set(records.map((record) => record.name.toLowerCase()));
  const lines = summary.lines
    .filter((line) => !recordNames.has(line.name.toLowerCase()))
    .slice(0, MAX_EXERCISE_LINES);
  const room = Math.floor((1200 - y) / 78);
  // Each line sits above a thin gold line, so the last record's line doubles as the top.
  for (const line of lines.slice(0, Math.max(room, 0))) {
    write(context, line.name, MARGIN, y + 52, { size: 38, maxWidth: 520 });
    write(context, describeSet(line.type, line.set, unit), WIDTH - MARGIN, y + 52, { size: 36, color: COLORS.dim, align: "right", maxWidth: 420 });
    y += 78;
    hairline(context, y);
  }

  write(context, "Logged with Gym Quest", MARGIN, 1270, { size: 30, color: COLORS.dim });
  write(context, `+${summary.xp} XP`, WIDTH - MARGIN, 1270, { size: 46, weight: 300, family: SERIF, italic: true, color: COLORS.gold, align: "right" });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image."))), "image/png");
  });
}
