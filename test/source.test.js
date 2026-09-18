import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAvailabilityWeek,
  fetchAvailabilityWeeks,
  parseAvailabilityPage,
} from "../src/source.js";

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

test("fetches weeks independently when one request fails", async () => {
  const fetchImpl = async (url) => {
    const weekStart = new URL(url).searchParams.get("week");
    if (weekStart === "2026-10-19") {
      return new Response("Onderhoud", { status: 503 });
    }

    return new Response(
      `<script type="application/json">${JSON.stringify({
        props: { week: { weekStart, days: [] } },
      })}</script>`,
    );
  };

  const result = await fetchAvailabilityWeeks(
    ["2026-10-12", "2026-10-19"],
    fetchImpl,
  );

  assert.deepEqual(result.weeks, [
    { weekStart: "2026-10-12", days: [] },
  ]);
  assert.deepEqual(result.errors, [
    {
      weekStart: "2026-10-19",
      message: "De boekingssite antwoordde met status 503.",
    },
  ]);
  assert.match(result.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
});