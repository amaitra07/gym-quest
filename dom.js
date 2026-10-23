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
