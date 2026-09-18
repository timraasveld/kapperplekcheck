const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const PERIODS = Object.freeze({
  morning: Object.freeze({ label: "Ochtend", times: Object.freeze(["10:00:00"]) }),
  afternoon: Object.freeze({ label: "Middag", times: Object.freeze(["13:00:00", "15:30:00"]) }),
  evening: Object.freeze({ label: "Avond", times: Object.freeze(["18:30:00"]) })
});

export function parseIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Ongeldige datum: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Ongeldige datum: ${value}`);
  }

  return date;
}

export function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value, amount) {
  const date = parseIsoDate(value);
  return formatIsoDate(new Date(date.valueOf() + amount * DAY_IN_MILLISECONDS));
}

export function getAmsterdamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getWeekStart(value) {
  const date = parseIsoDate(value);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(value, -daysSinceMonday);
}

export function getMonitoringDates(today = getAmsterdamToday(), days = 60) {
  return Array.from({ length: days }, (_, index) => addDays(today, index)).filter((value) => {
    const day = parseIsoDate(value).getUTCDay();
    return day >= 1 && day <= 5;
  });
}

export function getAllowedWeekStarts(today = getAmsterdamToday()) {
  return [...new Set(getMonitoringDates(today).map(getWeekStart))];
}

export function periodForTime(time) {
  return Object.entries(PERIODS).find(([, period]) => period.times.includes(time))?.[0] ?? null;
}

export function selectionKey(date, period) {
  return `${date}|${period}`;
}

export function cellKey(date, time) {
  return `${date}|${time}`;
}

export function findNewlyAvailable(previousPlaces, cells, selectedKeys) {
  return cells.filter((cell) => {
    const period = periodForTime(cell.time);
    const key = cellKey(cell.date, cell.time);
    return (
      period &&
      selectedKeys.has(selectionKey(cell.date, period)) &&
      previousPlaces.has(key) &&
      previousPlaces.get(key) === 0 &&
      cell.places > 0 &&
      !cell.closed &&
      !cell.tooSoon
    );
  });
}