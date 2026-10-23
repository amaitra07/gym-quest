export function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysAgoIso(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toIsoDate(date);
}

export function todayIso() {
  return daysAgoIso(0);
}

function parseIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(isoDate, days) {
  const date = parseIso(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// 0 is Sunday, matching the calendar.
export function weekdayOf(isoDate) {
  return parseIso(isoDate).getDay();
}

export function formatDate(isoDate) {
  if (isoDate === daysAgoIso(0)) return "Today";
  if (isoDate === daysAgoIso(1)) return "Yesterday";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
