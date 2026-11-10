import { button, byId, detailRow, el, fillContainer, insetList, scrollToTop, setHeader, showToast } from "./dom.js";
import { describeSet } from "./exercises.js";
import { workoutSummary } from "./records.js";
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

// The screen after finishing a workout: what you earned, any new records, and a share card.
export function renderComplete(workout, records, levelMessage, unit, onDone) {
  const summary = workoutSummary(workout, records);
  const preview = el("div", { class: "share-preview-frame" }, el("p", { class: "muted", text: "Making your card…" }));
  const actions = el("div", { class: "button-stack" });

  setHeader("complete", {
    title: "Summary",
    end: [el("ion-button", { strong: "true", text: "Done", onclick: onDone })],
  });
  fillContainer(
    byId("completeContent"),
    el("h1", { class: "hero-title", text: records.length > 0 ? "New PR!" : "Workout saved" }),
    el("p", { class: "hero-accent", text: levelMessage ?? `+${summary.xp} XP` }),
    records.length > 0
      ? el("h2", { class: "section-title", text: records.length === 1 ? "New personal record" : "New personal records" })
      : null,
    records.length > 0
      ? insetList(...records.map((record) => detailRow(record.name, describeSet(record.type, record.set, unit), "PR")))
      : null,
    preview,
    actions,
    button("text", { text: "Done", onclick: onDone }));
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
    const shareButton = button("primary", { text: "Share", onclick: () => shareImage(file, summary) });
    const saveButton = button(canShareFile ? "secondary" : "primary", {
      text: "Save image",
      onclick: () => downloadImage(blob, fileName),
    });
    actions.replaceChildren(...(canShareFile ? [shareButton, saveButton] : [saveButton]));
  }).catch(() => {
    preview.replaceChildren(el("p", { class: "empty", text: "Couldn't make the share card, but your workout is saved." }));
  });
}
