// The app's moving parts: a bar that fills, screens that fade in, a pop that replays, and a
// burst for a finished set. Each does nothing extra when the phone asks for less motion.

const FADE_MS = 360;

export function prefersLessMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Sets an Ionic progress bar to `value`, filling it from empty so the fill can be seen.
export function fillBar(bar, value) {
  if (prefersLessMotion()) {
    bar.value = value;
    return;
  }
  bar.value = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.value = value;
  }));
}

// Plays a CSS animation class again, even if the element already has it.
export function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const SPRING = "cubic-bezier(0.3, 1.6, 0.5, 1)";

// Runs `mutate` (which redraws part of the screen), then grows or shrinks every element
// matching `selector` inside `container` from its old height to its new one, so opening
// or closing something slides instead of snapping. Elements are matched before and after
// by their `data-motion-key`.
export function animateHeights(container, selector, mutate) {
  if (prefersLessMotion()) {
    mutate();
    return;
  }
  const before = new Map();
  for (const node of container.querySelectorAll(selector)) {
    before.set(node.dataset.motionKey, node.getBoundingClientRect().height);
  }
  mutate();
  for (const node of container.querySelectorAll(selector)) {
    const from = before.get(node.dataset.motionKey);
    const to = node.getBoundingClientRect().height;
    if (from === undefined || Math.abs(from - to) < 1) continue;
    node.animate([{ height: `${from}px`, overflow: "hidden" }, { height: `${to}px`, overflow: "hidden" }],
      { duration: 280, easing: EASE_OUT });
  }
}

// Fades `nodes` in one after another, for a tab that has just opened. Only the opacity
// changes, so the words never move: moving text is what stuttered on phones (2026-11-27).
export function fadeInOneByOne(nodes, { maxItems = 12, gapMs = 40 } = {}) {
  if (prefersLessMotion()) return;
  [...nodes].slice(0, maxItems).forEach((node, index) => {
    node.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_MS, delay: index * gapMs, easing: "ease-out", fill: "backwards" });
  });
}

// A springy pop, for a tick or a badge appearing.
export function pop(node, delayMs = 0) {
  if (prefersLessMotion() || !node) return;
  node.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(1)" }],
    { duration: 380, delay: delayMs, easing: SPRING, fill: "backwards" });
}

// A gold ring and a check mark bursting out of `anchor`, for finishing a set.
export function burstFrom(anchor) {
  if (prefersLessMotion() || !anchor) return;
  const box = anchor.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "set-burst";
  burst.setAttribute("aria-hidden", "true");
  burst.style.left = `${box.left + box.width / 2}px`;
  burst.style.top = `${box.top + box.height / 2}px`;
  burst.innerHTML = '<span class="set-burst-ring"></span><svg class="icon set-burst-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  document.body.append(burst);
  setTimeout(() => burst.remove(), 800);
}
