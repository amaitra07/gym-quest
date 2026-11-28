// The app's moving parts: numbers that count up, a bar that fills, a pop that
// replays, and a burst for a finished set. Each does nothing extra when the phone asks for less motion.

const COUNT_UP_MS = 900;

export function prefersLessMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Shows `target` in `node`, counting up from 0 with an ease-out. `format` turns the
// current number into text.
export function countUp(node, target, format = String) {
  if (prefersLessMotion() || target <= 0) {
    node.textContent = format(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / COUNT_UP_MS);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  node.textContent = format(0);
  requestAnimationFrame(step);
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

// Slides `nodes` up into place one after another, for a screen that builds itself.
export function staggerIn(nodes, { maxItems = 14, gapMs = 45 } = {}) {
  if (prefersLessMotion()) return;
  [...nodes].slice(0, maxItems).forEach((node, index) => {
    node.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
      { duration: 420, delay: index * gapMs, easing: EASE_OUT, fill: "backwards" });
  });
}

// A springy pop, for a tick or a badge appearing.
export function pop(node, delayMs = 0) {
  if (prefersLessMotion() || !node) return;
  node.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(1)" }],
    { duration: 380, delay: delayMs, easing: SPRING, fill: "backwards" });
}

// Slides a screen in from the side of the tab that was tapped: `direction` 1 from the
// right, -1 from the left.
export function slideIn(node, direction) {
  if (prefersLessMotion() || !node || direction === 0) return;
  node.animate([{ opacity: 0.4, transform: `translateX(${direction * 28}px)` }, { opacity: 1, transform: "none" }],
    { duration: 300, easing: EASE_OUT });
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
