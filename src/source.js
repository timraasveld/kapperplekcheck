const PAGE_DATA_PATTERN =
  /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;
const SOURCE_URL = "https://app.hairkappersopleiding.nl/afspraak";

export function parseAvailabilityPage(html) {
  const match = PAGE_DATA_PATTERN.exec(html);

  if (!match) {
    throw new Error("De boekingspagina bevat geen beschikbaarheidsgegevens.");
  }

  const page = JSON.parse(match[1]);
  const week = page?.props?.week;

  if (!week || !Array.isArray(week.days)) {
    throw new Error("De beschikbaarheidsgegevens hebben een onbekend formaat.");
  }

  return normalizeWeek(week);
}

function normalizeWeek(week) {
  return {
    weekStart: String(week.weekStart),
    days: week.days.map((day) => ({
      date: String(day.date),
      cells: Array.isArray(day.cells)
        ? day.cells.map((cell) => ({
            date: String(cell.date),
            time: String(cell.time),
            places: Number(cell.places) || 0,
            closed: Boolean(cell.closed),
            tooSoon: Boolean(cell.tooSoon),
          }))
        : [],
    })),
  };
}

export async function fetchAvailabilityWeek(weekStart, fetchImpl = fetch) {
  const url = new URL(SOURCE_URL);
  url.search = new URLSearchParams({
    addons: "",
    behandeling: "",
    bril: "",
    vak: "barber",
    variant: "",
    week: weekStart,
  });

  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Kapperplekcheck/0.1",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `De boekingssite antwoordde met status ${response.status}.`,
    );
  }

  const week = parseAvailabilityPage(await response.text());
  if (week.weekStart !== weekStart) {
    throw new Error("De boekingssite stuurde gegevens voor een andere week.");
  }

  return week;
}
