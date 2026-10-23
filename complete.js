import { byId, el, showToast } from "./dom.js";
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
  const actions = el("div", { class: "complete-actions" });

  byId("completeContent").replaceChildren(
    el("h1", { class: "screen-title", text: records.length > 0 ? "New PR!" : "Workout saved" }),
    el("p", { class: "complete-xp", text: levelMessage ?? `+${summary.xp} XP` }),
    records.length > 0
      ? el("section", { class: "panel" },
        el("h2", { text: records.length === 1 ? "New personal record" : "New personal records" }),
        el("ul", { class: "history" }, ...records.map((record) => el("li", { class: "session-row" },
          el("span", { class: "session-date", text: record.name }),
          el("span", { class: "session-sets", text: describeSet(record.type, record.set, unit) }),
          el("span", { class: "pr-badge", text: "PR" })))))
      : null,
    preview,
    actions,
    el("button", { class: "text-button", type: "button", text: "Done", onclick: onDone }));
  window.scrollTo(0, 0);

  drawShareCard(summary, unit).then((blob) => {
    const fileName = fileNameFor(summary);
    const file = new File([blob], fileName, { type: "image/png" });
    const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    preview.replaceChildren(el("img", {
      class: "share-preview",
      src: URL.createObjectURL(blob),
      alt: `Share card for ${summary.name}`,
    }));
    const shareButton = el("button", {
      class: "primary-button",
      type: "button",
      text: "Share",
      onclick: () => shareImage(file, summary),
    });
    const saveButton = el("button", {
      class: canShareFile ? "secondary-button" : "primary-button",
      type: "button",
      text: "Save image",
      onclick: () => downloadImage(blob, fileName),
    });
    actions.replaceChildren(...(canShareFile ? [shareButton, saveButton] : [saveButton]));
  }).catch(() => {
    preview.replaceChildren(el("p", { class: "empty", text: "Couldn't make the share card, but your workout is saved." }));
  });
}
