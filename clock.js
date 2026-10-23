// A stopwatch that takes the current time as an argument, so it can be tested
// and keeps correct time even if the page is throttled in the background.
export function createStopwatch() {
  let accumulatedMs = 0;
  let startedAt = null;
  return {
    start(now) {
      if (startedAt === null) startedAt = now;
    },
    pause(now) {
      if (startedAt === null) return;
      accumulatedMs += now - startedAt;
      startedAt = null;
    },
    reset() {
      accumulatedMs = 0;
      startedAt = null;
    },
    elapsedMs(now) {
      return accumulatedMs + (startedAt === null ? 0 : now - startedAt);
    },
  };
}

// 75 -> "1:15", 3725 -> "1:02:05"
export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
  return `${minutes}:${rest}`;
}
