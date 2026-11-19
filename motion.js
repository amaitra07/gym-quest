// The Arcade look's moving parts: numbers that count up, a bar that fills, a pop that
// replays, and a confetti burst. Each does nothing extra when the phone asks for less motion.

const COUNT_UP_MS = 900;
const CONFETTI_PIECES = 44;
const CONFETTI_COLORS = ["#c8f542", "#2de2c6", "#c9b8ff", "#ffffff", "#e8ff7a"];
const CONFETTI_LIFETIME_MS = 2600;

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

// Drops confetti over `container` for a couple of seconds.
export function burstConfetti(container = document.body) {
  if (prefersLessMotion()) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  for (let index = 0; index < CONFETTI_PIECES; index++) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.animationDuration = `${1.3 + Math.random() * 0.9}s`;
    layer.append(piece);
  }
  container.append(layer);
  setTimeout(() => layer.remove(), CONFETTI_LIFETIME_MS);
}
