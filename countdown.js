import { el } from "./dom.js";
import { replay } from "./motion.js";

// The 3, 2, 1, Go before a guided workout starts, and the beeps that go with it and with the
// end of every rest. Beeps are made with the Web Audio API, so there are no sound files to
// load. Phones only allow sound after a tap, so `unlockSound` must run inside one (the tap on
// Begin workout); after that, beeps can play on their own. An iPhone's silent switch mutes
// them, and iPhones ignore vibration from web apps.

const COUNT_FROM = 3;
const SECOND_MS = 1000;
const GO_SHOWN_MS = 700;
const COUNT_IN_TICK_MS = 50;

const TICK_TONE = { frequency: 880, seconds: 0.12 };
const GO_TONE = { frequency: 1320, seconds: 0.35 };
const PEAK_VOLUME = 0.3;

// What the count-in shows `elapsedMs` after it began: "3", "2", "1", "Go", or null once over.
export function countInLabel(elapsedMs) {
  if (elapsedMs < 0) return String(COUNT_FROM);
  const second = Math.floor(elapsedMs / SECOND_MS);
  if (second < COUNT_FROM) return String(COUNT_FROM - second);
  return elapsedMs < COUNT_FROM * SECOND_MS + GO_SHOWN_MS ? "Go" : null;
}

// The whole seconds left in a rest if it is in its final three (3, 2 or 1), otherwise null.
// The rest screen beeps each time this changes and highlights the clock while it is set.
export function finalSecondsLeft(remainingMs) {
  if (remainingMs <= 0) return null;
  const secondsLeft = Math.ceil(remainingMs / SECOND_MS);
  return secondsLeft <= COUNT_FROM ? secondsLeft : null;
}

let audio = null;

export function unlockSound() {
  try {
    audio ??= new AudioContext();
    audio.resume();
  } catch {
    audio = null; // No Web Audio in this browser; the countdown still shows.
  }
}

// A short tick for 3, 2, 1 and a longer, higher tone for Go.
export function beep(isGo = false) {
  const tone = isGo ? GO_TONE : TICK_TONE;
  navigator.vibrate?.(isGo ? 250 : 80);
  if (audio === null || audio.state !== "running") return;
  const start = audio.currentTime;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.frequency.value = tone.frequency;
  // Fade in and out quickly so the beep doesn't click.
  volume.gain.setValueAtTime(0, start);
  volume.gain.linearRampToValueAtTime(PEAK_VOLUME, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.001, start + tone.seconds);
  oscillator.connect(volume).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + tone.seconds);
}

// Covers the screen with a big 3, 2, 1, Go, beeping on each, then calls `onDone`. Tapping
// anywhere starts straight away.
export function runCountIn(onDone) {
  const number = el("p", { class: "count-in-number", text: String(COUNT_FROM) });
  const overlay = el("div", { class: "count-in", role: "timer", "aria-live": "assertive" },
    el("p", { class: "count-in-label", text: "Get ready" }),
    number,
    el("p", { class: "count-in-hint", text: "Tap to start now" }));
  const startedAt = Date.now();
  let shown = null;
  let timer = null;

  function finish() {
    clearInterval(timer);
    overlay.remove();
    onDone();
  }

  function tick() {
    const label = countInLabel(Date.now() - startedAt);
    if (label === null) {
      finish();
      return;
    }
    if (label === shown) return;
    shown = label;
    number.textContent = label;
    number.classList.toggle("is-go", label === "Go");
    replay(number, "is-new");
    beep(label === "Go");
  }

  overlay.addEventListener("click", finish);
  (document.querySelector("ion-app") ?? document.body).append(overlay);
  tick();
  timer = setInterval(tick, COUNT_IN_TICK_MS);
}
