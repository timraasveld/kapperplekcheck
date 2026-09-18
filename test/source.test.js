import assert from "node:assert/strict";
import test from "node:test";

import { fetchAvailabilityWeek, parseAvailabilityPage } from "../src/source.js";

test("extracts the week payload from the booking page", () => {
  const page = {
    component: "Salon/Appointment",
    props: {
      week: {
        weekStart: "2026-10-12",
        days: [
          {
            date: "2026-10-14",
            cells: [{ date: "2026-10-14", time: "10:00:00", places: 1 }]
          }
        ]
      }
    }
  };
  const html = `<html><body><script type="application/json">${JSON.stringify(page)}</script></body></html>`;

  assert.deepEqual(parseAvailabilityPage(html), {
    weekStart: "2026-10-12",
    days: [
      {
        date: "2026-10-14",
        cells: [
          {
            date: "2026-10-14",
            time: "10:00:00",
            places: 1,
            closed: false,
            tooSoon: false
          }
        ]
      }
    ]
  });
});

test("rejects a page without availability data", () => {
  assert.throws(
    () => parseAvailabilityPage("<html><body>Onderhoud</body></html>"),
    /geen beschikbaarheidsgegevens/
  );
});

test("rejects a response for a different week", async () => {
  const html = `<script type="application/json">${JSON.stringify({
    props: { week: { weekStart: "2026-10-19", days: [] } }
  })}</script>`;
  const fetchImpl = async () => new Response(html);

  await assert.rejects(
    fetchAvailabilityWeek("2026-10-12", fetchImpl),
    /andere week/
  );
});