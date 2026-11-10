// Small helpers for building the screens out of Ionic components (https://ionicframework.com),
// which give the app its iPhone-style toolbars, lists, sheets and alerts.

const TOAST_DURATION_MS = 2600;
const CONFIRM_ROLE = "destructive";
const SHEET_HEIGHTS = [0, 0.6, 1];

export function byId(id) {
  return document.getElementById(id);
}

// Browser events are all lower case ("onclick", "onInput" both work); Ionic's are camel
// case, so "onIonInput" listens for "ionInput".
function eventName(key) {
  const name = key.slice(2);
  return name.startsWith("Ion") ? `ion${name.slice(3)}` : name.toLowerCase();
}

// Builds an element. `class`, `text`, `value` and `hidden` are set as properties,
// `on*` keys become event listeners, and everything else becomes an attribute.
// Null children are skipped so callers can write `condition ? node : null`.
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "value" || key === "hidden") node[key] = value;
    else if (key.startsWith("on")) node.addEventListener(eventName(key), value);
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null));
  return node;
}

// Puts `children` into `container`, skipping nulls. replaceChildren on its own would turn a
// null into the text "null", so screens with optional sections use this instead.
export function fillContainer(container, ...children) {
  container.replaceChildren(...children.filter((child) => child !== null));
}

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_SHAPES = {
  back: { d: "M15 5l-7 7 7 7" },
  forward: { d: "M9 5l7 7-7 7" },
  close: { d: "M6 6l12 12M18 6L6 18" },
  plus: { d: "M12 5v14M5 12h14" },
  edit: { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  arrow: { d: "M5 12h14M13 6l6 6-6 6" },
  play: { d: "M8 5v14l11-7z", filled: true },
  pause: { d: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", filled: true },
};

// A small inline icon that takes the colour of the text around it. Inside an Ionic button
// that also has text, `slot` ("start" or "end") puts it before or after the text with a gap.
export function icon(name, slot = null) {
  const { d, filled } = ICON_SHAPES[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", filled ? "icon icon-filled" : "icon");
  svg.setAttribute("aria-hidden", "true");
  if (slot !== null) svg.setAttribute("slot", slot);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

/* ---------- Buttons, rows and fields ---------- */

const BUTTON_LOOKS = {
  primary: { expand: "block", class: "primary-action" },
  secondary: { expand: "block", class: "secondary-action" },
  danger: { expand: "block", color: "danger" },
  text: { expand: "block", fill: "clear", color: "medium" },
};

// A full-width button in one of the app's four looks: "primary" (lime), "secondary"
// (grey), "danger" (red) or "text" (no background).
export function button(look, attributes, ...children) {
  const { class: lookClass = "", ...lookAttributes } = BUTTON_LOOKS[look];
  const className = [lookClass, attributes.class ?? ""].join(" ").trim();
  return el("ion-button", { ...lookAttributes, ...attributes, class: className }, ...children);
}

// One tappable row of a list: a bold title with a line under it, and up to two short
// lines on the right. `label` is what a screen reader says for the whole row.
export function listRow({ title, detail, sideTop = null, sideBottom = null, label, onTap }) {
  return el("ion-item", { button: "true", detail: "false", "aria-label": label, onclick: onTap },
    el("ion-label", {}, el("h2", { text: title }), el("p", { text: detail })),
    el("div", { slot: "end", class: "row-side" },
      sideTop ? el("span", { class: "row-when", text: sideTop }) : null,
      sideBottom ? el("span", { class: "row-accent", text: sideBottom }) : null));
}

// A read-only row: a label on the left and its value on the right, with an optional badge.
export function detailRow(label, value, badge = null) {
  return el("ion-item", {},
    el("ion-label", { text: label }),
    el("ion-note", { slot: "end", class: "row-value", text: value }),
    badge ? el("ion-badge", { slot: "end", text: badge }) : null);
}

// A group of rows in one rounded box, the way iPhone settings screens look.
export function insetList(...rows) {
  return el("ion-list", { inset: "true", lines: "none" }, ...rows);
}

// A labelled field as a list row. Returns the row; read or focus the field through `input`.
export function fieldRow(input) {
  return el("ion-item", {}, input);
}

// What is typed in an Ionic field, always as text.
export function fieldText(input) {
  return String(input.value ?? "");
}

// Puts the cursor in a field, whether it is an Ionic field or a plain one.
export function focusField(input) {
  if (typeof input?.setFocus === "function") input.setFocus();
  else input?.focus?.();
}

/* ---------- Screens ---------- */

// Fills a screen's toolbar: its title, an optional back button on the left, and optional
// buttons on the right. `title` is text, or an element on a screen with one title.
export function setHeader(screen, { title, backLabel = "Back", onBack = null, end = [] }) {
  const page = byId(`${screen}Screen`);
  for (const titleNode of page.querySelectorAll("[data-header='title']")) {
    titleNode.replaceChildren(title);
  }
  fillContainer(page.querySelector("[data-header='start']"),
    onBack ? el("ion-button", { onclick: onBack }, icon("back", "start"), backLabel) : null);
  fillContainer(page.querySelector("[data-header='end']"), ...end);
}

export function scrollToTop(screen) {
  byId(`${screen}Screen`).querySelector("ion-content").scrollToTop?.();
}

/* ---------- Toasts, alerts and sheets ---------- */

// Shows an Ionic overlay and resolves with how it was closed. The overlay is added to the
// page straight away; presenting waits for Ionic to finish loading.
async function presentOverlay(overlay) {
  (document.querySelector("ion-app") ?? document.body).append(overlay);
  await customElements.whenDefined(overlay.localName);
  await overlay.present();
  const result = await overlay.onDidDismiss();
  overlay.remove();
  return result;
}

export function showToast(message) {
  const toast = el("ion-toast", { position: "top" });
  toast.message = message;
  toast.duration = TOAST_DURATION_MS;
  presentOverlay(toast);
}

// An in-page replacement for window.confirm, which some phone browsers block.
// Resolves to true if the user confirms and false if they cancel.
export function confirmAction(message, confirmLabel) {
  const alert = el("ion-alert");
  alert.header = message;
  alert.buttons = [
    { text: "Cancel", role: "cancel" },
    { text: confirmLabel, role: CONFIRM_ROLE },
  ];
  return presentOverlay(alert).then(({ role }) => role === CONFIRM_ROLE);
}

// A sheet that asks the user to pick one option. Resolves to the chosen option's `value`,
// or null if they cancel. The option marked `isPrimary` is shown as the current choice.
export function chooseOption(title, options) {
  const sheet = el("ion-action-sheet");
  sheet.header = title;
  sheet.buttons = [
    ...options.map((option) => ({
      text: option.label,
      role: option.isPrimary ? "selected" : undefined,
      data: { value: option.value },
    })),
    { text: "Cancel", role: "cancel" },
  ];
  return presentOverlay(sheet).then(({ data }) => data?.value ?? null);
}

// A sheet that slides up from the bottom and can be dragged taller or away. Returns
// `content` to fill and `close()`; `onClosed` runs however it was closed.
export function openSheet(title, onClosed = () => {}) {
  const content = el("div", { class: "sheet-body" });
  const modal = el("ion-modal", {},
    el("ion-header", {},
      el("ion-toolbar", {},
        el("ion-title", { text: title }),
        el("ion-buttons", { slot: "end" },
          el("ion-button", { strong: "true", text: "Done", onclick: () => modal.dismiss() })))),
    el("ion-content", {}, content));
  modal.breakpoints = SHEET_HEIGHTS;
  modal.initialBreakpoint = SHEET_HEIGHTS[1];
  presentOverlay(modal).then(onClosed);
  return { content, close: () => modal.dismiss?.() };
}
