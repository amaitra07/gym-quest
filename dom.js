const TOAST_DURATION_MS = 2600;

export function byId(id) {
  return document.getElementById(id);
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
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
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
  edit: { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  arrow: { d: "M5 12h14M13 6l6 6-6 6" },
  play: { d: "M8 5v14l11-7z", filled: true },
  pause: { d: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", filled: true },
};

// A small inline icon that takes the colour of the text around it.
export function icon(name) {
  const { d, filled } = ICON_SHAPES[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", filled ? "icon icon-filled" : "icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

export function showToast(message) {
  const toast = el("div", { class: "toast", text: message });
  byId("toastHost").append(toast);
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

// An in-page replacement for window.confirm, which some phone browsers block.
// Resolves to true if the user confirms and false if they cancel.
export function confirmAction(message, confirmLabel) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const close = (answer) => {
      overlay.remove();
      previousFocus?.focus?.();
      resolve(answer);
    };
    const cancelButton = el("button", {
      class: "secondary-button",
      type: "button",
      text: "Cancel",
      onclick: () => close(false),
    });
    const overlay = el("div", {
      class: "dialog-overlay",
      onclick: (event) => {
        if (event.target === overlay) close(false);
      },
      onkeydown: (event) => {
        if (event.key === "Escape") close(false);
      },
    },
      el("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-label": message },
        el("p", { class: "dialog-message", text: message }),
        el("div", { class: "dialog-actions" },
          cancelButton,
          el("button", {
            class: "danger-button",
            type: "button",
            text: confirmLabel,
            onclick: () => close(true),
          }))));
    document.body.append(overlay);
    cancelButton.focus();
  });
}

// A dialog that asks the user to pick one option. Resolves to the chosen option's `value`,
// or null if they cancel.
export function chooseOption(title, options) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const close = (answer) => {
      overlay.remove();
      previousFocus?.focus?.();
      resolve(answer);
    };
    const buttons = options.map((option) => el("button", {
      class: option.isPrimary ? "primary-button" : "secondary-button",
      type: "button",
      text: option.label,
      onclick: () => close(option.value),
    }));
    const overlay = el("div", {
      class: "dialog-overlay",
      onclick: (event) => {
        if (event.target === overlay) close(null);
      },
      onkeydown: (event) => {
        if (event.key === "Escape") close(null);
      },
    },
      el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": title },
        el("p", { class: "dialog-message", text: title }),
        el("div", { class: "choice-list" }, ...buttons),
        el("button", { class: "text-button choice-cancel", type: "button", text: "Cancel", onclick: () => close(null) })));
    document.body.append(overlay);
    buttons[0]?.focus();
  });
}
