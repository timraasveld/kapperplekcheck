import {
  PERIODS,
  cellKey,
  findNewlyAvailable,
  getAmsterdamToday,
  getMonitoringDates,
  getWeekStart,
  periodForTime,
  selectionKey,
} from "/domain.js";
import { fetchAvailabilityWeeks } from "/source.js";

const STORAGE_KEY = "Kapperplekcheck:selected-v1";
const POLL_INTERVAL = 10 * 60 * 1000;
const IS_NATIVE_APP =
  globalThis.Capacitor?.isNativePlatform?.() === true;
const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
});

const elements = {
  body: document.querySelector("#dates-body"),
  error: document.querySelector("#error-message"),
  lastChecked: document.querySelector("#last-checked"),
  notifications: document.querySelector("#notifications-button"),
  refresh: document.querySelector("#refresh-button"),
  selectionCount: document.querySelector("#selection-count"),
  statusIndicator: document.querySelector("#status-indicator"),
  statusText: document.querySelector("#status-text"),
};

const state = {
  dates: getMonitoringDates(getAmsterdamToday()),
  selected: loadSelection(),
  cells: new Map(),
  observedPlaces: new Map(),
  weekStatus: new Map(),
  refreshing: false,
  audioContext: null,
};

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected]));
}

function formatDate(value) {
  return dateFormatter
    .format(new Date(`${value}T12:00:00Z`))
    .replaceAll(".", "");
}

function formatTime(value) {
  return value.slice(0, 5);
}

function selectedWeeks() {
  return [
    ...new Set(
      [...state.selected]
        .map((key) => key.split("|")[0])
        .filter((date) => state.dates.includes(date))
        .map(getWeekStart),
    ),
  ].sort();
}

async function loadAvailability(weeks) {
  if (IS_NATIVE_APP) {
    return fetchAvailabilityWeeks(weeks);
  }

  const search = new URLSearchParams();
  weeks.forEach((week) => search.append("week", week));
  const response = await fetch(`/api/availability?${search}`);
  return response.json();
}

function renderRows() {
  const fragment = document.createDocumentFragment();

  for (const date of state.dates) {
    const row = document.createElement("tr");
    row.dataset.date = date;

    const dateCell = document.createElement("td");
    dateCell.className = "date-label";
    dateCell.textContent = formatDate(date);
    row.append(dateCell);

    for (const [periodId, period] of Object.entries(PERIODS)) {
      const cell = document.createElement("td");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.date = date;
      checkbox.dataset.period = periodId;
      checkbox.checked = state.selected.has(selectionKey(date, periodId));
      checkbox.setAttribute(
        "aria-label",
        `${formatDate(date)} ${period.label}`,
      );
      label.className = "period-choice";
      label.append(
        checkbox,
        document.createTextNode(period.times.map(formatTime).join(" / ")),
      );
      cell.append(label);
      row.append(cell);
    }

    const availability = document.createElement("td");
    availability.className = "availability";
    availability.dataset.availability = date;
    row.append(availability);
    fragment.append(row);
  }

  elements.body.replaceChildren(fragment);
  renderSelectionState();
  renderAvailability();
}

function renderSelectionState() {
  const validSelections = [...state.selected].filter((key) =>
    state.dates.includes(key.split("|")[0]),
  );
  elements.selectionCount.textContent = `${validSelections.length} ${validSelections.length === 1 ? "moment" : "momenten"}`;

  for (const checkbox of document.querySelectorAll("[data-select-all]")) {
    const period = checkbox.dataset.selectAll;
    const count = state.dates.filter((date) =>
      state.selected.has(selectionKey(date, period)),
    ).length;
    checkbox.checked = count === state.dates.length;
    checkbox.indeterminate = count > 0 && count < state.dates.length;
  }
}

function renderAvailability() {
  for (const date of state.dates) {
    const target = document.querySelector(`[data-availability="${date}"]`);
    const selectedPeriods = Object.keys(PERIODS).filter((period) =>
      state.selected.has(selectionKey(date, period)),
    );
    target.replaceChildren();

    if (selectedPeriods.length === 0) {
      target.textContent = "Niet gevolgd";
      continue;
    }

    const weekStart = getWeekStart(date);
    const status = state.weekStatus.get(weekStart);
    if (!status) {
      target.textContent = state.refreshing
        ? "Controleren…"
        : "Nog niet gecontroleerd";
      continue;
    }

    if (status.stale) {
      const stale = document.createElement("span");
      stale.className = "stale-label";
      stale.textContent = "Verouderd";
      target.append(stale);
    }

    const available = [...state.cells.values()].filter((cell) => {
      const period = periodForTime(cell.time);
      return (
        cell.date === date &&
        period &&
        selectedPeriods.includes(period) &&
        cell.places > 0 &&
        !cell.closed &&
        !cell.tooSoon
      );
    });

    if (available.length === 0) {
      target.append(
        document.createTextNode(
          status.stale ? " Geen bekende plek" : "Geen plek",
        ),
      );
      continue;
    }

    const links = document.createElement("div");
    links.className = "availability-links";
    for (const cell of available) {
      const link = document.createElement("a");
      link.className = "booking-link";
      link.href = bookingUrl(cell);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${formatTime(cell.time)} · ${cell.places} ${cell.places === 1 ? "plek" : "plekken"} · Boeken`;
      links.append(link);
    }
    target.append(links);
  }
}

function bookingUrl(cell) {
  const url = new URL(
    "https://app.hairkappersopleiding.nl/afspraak/bevestigen",
  );
  url.search = new URLSearchParams({
    addons: "",
    datum: cell.date,
    tijd: cell.time,
    vak: "barber",
  });
  return url;
}

function setStatus(kind, text) {
  elements.statusIndicator.className = `status-indicator status-${kind}`;
  elements.statusText.textContent = text;
}

function pruneObservedPlaces() {
  for (const key of state.observedPlaces.keys()) {
    const [date, time] = key.split("|");
    const period = periodForTime(time);
    if (!period || !state.selected.has(selectionKey(date, period))) {
      state.observedPlaces.delete(key);
    }
  }
}

function replaceWeekCells(week) {
  for (const [key, cell] of state.cells) {
    if (getWeekStart(cell.date) === week.weekStart) {
      state.cells.delete(key);
    }
  }

  for (const day of week.days) {
    for (const cell of day.cells) {
      state.cells.set(cellKey(cell.date, cell.time), cell);
    }
  }
}

function observeWeek(week, suppressNotifications) {
  const cells = week.days.flatMap((day) => day.cells);
  const newlyAvailable = suppressNotifications
    ? []
    : findNewlyAvailable(state.observedPlaces, cells, state.selected);

  for (const cell of cells) {
    const period = periodForTime(cell.time);
    const key = cellKey(cell.date, cell.time);
    if (period && state.selected.has(selectionKey(cell.date, period))) {
      state.observedPlaces.set(
        key,
        cell.closed || cell.tooSoon ? 0 : cell.places,
      );
    } else {
      state.observedPlaces.delete(key);
    }
  }

  return newlyAvailable;
}

async function refreshAvailability() {
  const weeks = selectedWeeks();
  if (weeks.length === 0) {
    setStatus("idle", "Kies de momenten die je wilt volgen.");
    elements.lastChecked.textContent = "Nog niet gecontroleerd";
    return;
  }

  if (state.refreshing) {
    return;
  }

  state.refreshing = true;
  elements.refresh.disabled = true;
  elements.error.hidden = true;
  setStatus(
    "checking",
    `${weeks.length} ${weeks.length === 1 ? "week" : "weken"} controleren…`,
  );
  renderAvailability();

  try {
    const payload = await loadAvailability(weeks);
    const newlyAvailable = [];

    for (const week of payload.weeks ?? []) {
      const previousStatus = state.weekStatus.get(week.weekStart);
      newlyAvailable.push(...observeWeek(week, previousStatus?.stale === true));
      replaceWeekCells(week);
      state.weekStatus.set(week.weekStart, {
        stale: false,
        checkedAt: payload.fetchedAt,
      });
    }

    for (const error of payload.errors ?? []) {
      state.weekStatus.set(error.weekStart, {
        stale: true,
        checkedAt: state.weekStatus.get(error.weekStart)?.checkedAt ?? null,
        error: error.message,
      });
    }

    const errors = payload.errors ?? [];
    if (errors.length > 0) {
      elements.error.textContent = `Niet alle weken konden worden gecontroleerd: ${errors.map((error) => error.message).join(" ")}`;
      elements.error.hidden = false;
      setStatus(
        "error",
        `${errors.length} ${errors.length === 1 ? "week is" : "weken zijn"} verouderd.`,
      );
    } else {
      setStatus("ok", "Beschikbaarheid is bijgewerkt.");
    }

    if ((payload.weeks ?? []).length > 0) {
      elements.lastChecked.textContent = `Laatste controle ${timeFormatter.format(new Date(payload.fetchedAt))}`;
    }
    renderAvailability();
    alertFor(newlyAvailable);
  } catch (error) {
    for (const week of weeks) {
      const previous = state.weekStatus.get(week);
      state.weekStatus.set(week, {
        ...previous,
        stale: true,
        error: error.message,
      });
    }
    elements.error.textContent =
      "De beschikbaarheid kon niet worden gecontroleerd. De getoonde gegevens zijn verouderd.";
    elements.error.hidden = false;
    setStatus("error", "Controle mislukt.");
    renderAvailability();
  } finally {
    state.refreshing = false;
    elements.refresh.disabled = false;
  }
}

async function getNativeNotifications() {
  const { LocalNotifications } = await import(
    "@capacitor/local-notifications"
  );
  return LocalNotifications;
}

async function alertFor(cells) {
  if (cells.length === 0) {
    return;
  }

  playSound();
  const descriptions = cells.map(
    (cell) => `${formatDate(cell.date)} ${formatTime(cell.time)}`,
  );

  if (IS_NATIVE_APP) {
    try {
      const notifications = await getNativeNotifications();
      const permission = await notifications.checkPermissions();
      if (permission.display !== "granted") {
        return;
      }

      await notifications.schedule({
        notifications: [
          {
            id: Date.now() % 2_147_483_647,
            title:
              cells.length === 1
                ? "Nieuwe vrije plek"
                : `${cells.length} nieuwe vrije plekken`,
            body: descriptions.join(", "),
          },
        ],
      });
    } catch {
      // Availability should remain current when Android cannot show an alert.
    }
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(
    cells.length === 1
      ? "Nieuwe vrije plek"
      : `${cells.length} nieuwe vrije plekken`,
    { body: descriptions.join(", ") },
  );
  notification.onclick = () =>
    window.open(bookingUrl(cells[0]), "_blank", "noopener");
}

function playSound() {
  if (!state.audioContext) {
    return;
  }

  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.18,
    state.audioContext.currentTime + 0.02,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    state.audioContext.currentTime + 0.35,
  );
  oscillator.connect(gain).connect(state.audioContext.destination);
  oscillator.start();
  oscillator.stop(state.audioContext.currentTime + 0.36);
}

async function enableNotifications() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    state.audioContext ??= new AudioContext();
    await state.audioContext.resume();
    playSound();
  }

  if (IS_NATIVE_APP) {
    try {
      const notifications = await getNativeNotifications();
      const permission = await notifications.requestPermissions();
      elements.notifications.textContent =
        permission.display === "granted"
          ? "Meldingen ingeschakeld"
          : "Alleen geluid ingeschakeld";
    } catch {
      elements.notifications.textContent = "Alleen geluid ingeschakeld";
    }
    return;
  }

  if (!("Notification" in window)) {
    elements.notifications.textContent = "Geluid ingeschakeld";
    return;
  }

  const permission = await Notification.requestPermission();
    await alertFor(newlyAvailable);
    permission === "granted"
      ? "Meldingen ingeschakeld"
      : "Alleen geluid ingeschakeld";
}

function selectionChanged() {
  pruneObservedPlaces();
  saveSelection();
  renderSelectionState();
  renderAvailability();
  refreshAvailability();
}

elements.body.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-date][data-period]");
  if (!checkbox) {
    return;
  }

  const key = selectionKey(checkbox.dataset.date, checkbox.dataset.period);
  if (checkbox.checked) {
    state.selected.add(key);
  } else {
    state.selected.delete(key);
  }
  selectionChanged();
});

document.querySelector("thead").addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-select-all]");
  if (!checkbox) {
    return;
  }

  for (const date of state.dates) {
    const key = selectionKey(date, checkbox.dataset.selectAll);
    if (checkbox.checked) {
      state.selected.add(key);
    } else {
      state.selected.delete(key);
    }
  }
  renderRows();
  selectionChanged();
});

elements.refresh.addEventListener("click", refreshAvailability);
elements.notifications.addEventListener("click", enableNotifications);

renderRows();
refreshAvailability();
setInterval(refreshAvailability, POLL_INTERVAL);
