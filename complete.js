import { button, byId, detailRow, el, fillContainer, insetList, scrollToTop, setHeader, showToast } from "./dom.js";
import { describeSet } from "./exercises.js";
import { headlineStat, workoutSummary } from "./records.js";
import { drawShareCard } from "./share-card.js";

function fileNameFor(summary) {
  const slug = summary.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `gym-quest-${slug || "workout"}-${summary.date}.png`;
}

function downloadImage(blob, fileName) {
  const link = el("a", { href: URL.createObjectURL(blob), download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function shareImage(file, summary) {
  try {
    await navigator.share({ files: [file], title: `${summary.name} on Gym Quest` });
  } catch (error) {
    if (error.name !== "AbortError") showToast("Couldn't open sharing. Try Save image instead.");
  }
}

// A summary number as a column: a small gold label over a serif value.
function summaryColumn(label, value) {
  return el("div", { class: "record-column" }, el("span", { class: "kicker", text: label }), el("b", { class: "num", text: value }));
}

// The screen after finishing a workout: a gold glow spreads out behind "Well done." (or
// "New PR."), then what you earned, the workout in numbers, any new records, and a share card.
export function renderComplete(workout, records, levelMessage, unit, onDone) {
  const summary = workoutSummary(workout, records);
  const [headlineValue, headlineLabel] = headlineStat(summary, unit);
  const hasRecord = records.length > 0;
  const preview = el("div", { class: "share-preview-frame" }, el("p", { class: "muted", text: "Making your card…" }));
  const actions = el("div", { class: "button-stack" });

  // One way out: the big Done under the card (no second Done in the top bar).
  setHeader("complete", { title: "Summary" });
  fillContainer(
    byId("completeContent"),
    el("div", { class: "finish-glow", "aria-hidden": "true" }),
    el("p", { class: "kicker", text: hasRecord ? "Workout saved · new record" : "Workout saved" }),
    el("h1", { class: "headline finish-title", text: hasRecord ? "New PR." : "Well done." }),
    el("p", { class: "finish-xp", text: levelMessage ?? `+${summary.xp} XP` }),
    el("div", { class: "record-columns" },
      summaryColumn("Exercises", String(summary.exerciseCount)),
      summaryColumn("Sets", String(summary.setCount)),
      summaryColumn(headlineLabel, headlineValue)),
    hasRecord
      ? el("h2", { class: "kicker", text: records.length === 1 ? "New personal record" : "New personal records" })
      : null,
    hasRecord
      ? insetList(...records.map((record) => detailRow(record.name, describeSet(record.type, record.set, unit), "PR")))
      : null,
    preview,
    button("primary", { text: "Done", onclick: onDone }),
    actions);
  scrollToTop("complete");

  drawShareCard(summary, unit).then((blob) => {
    const fileName = fileNameFor(summary);
    const file = new File([blob], fileName, { type: "image/png" });
    const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    preview.replaceChildren(el("img", {
      class: "share-preview",
      src: URL.createObjectURL(blob),
      alt: `Share card for ${summary.name}`,
    }));
    const shareButton = button("secondary", { text: "Share", onclick: () => shareImage(file, summary) });
    const saveButton = button(canShareFile ? "text" : "secondary", {
      text: "Save image",
      onclick: () => downloadImage(blob, fileName),
    });
    actions.replaceChildren(...(canShareFile ? [shareButton, saveButton] : [saveButton]));
  }).catch(() => {
    preview.replaceChildren(el("p", { class: "empty", text: "Couldn't make the share card, but your workout is saved." }));
  });
}
