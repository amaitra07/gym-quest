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
