import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

import { getAllowedWeekStarts } from "../shared/domain.js";
import { fetchAvailabilityWeek } from "./source.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const CACHE_DURATION = 30_000;
const ROOT = new URL("../", import.meta.url);
const STATIC_FILES = new Map([
  ["/", ["public/index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["public/app.js", "text/javascript; charset=utf-8"]],
  ["/domain.js", ["shared/domain.js", "text/javascript; charset=utf-8"]],
  ["/source.js", ["src/source.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["public/styles.css", "text/css; charset=utf-8"]],
]);
const cache = new Map();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function validateWeeks(searchParams) {
  const requested = searchParams.getAll("week");
  const allowed = new Set(getAllowedWeekStarts());

  if (requested.length === 0 || requested.length > 10) {
    throw new Error("Vraag tussen één en tien weken op.");
  }

  const weeks = [...new Set(requested)];
  if (weeks.some((week) => !allowed.has(week))) {
    throw new Error("Een opgevraagde week valt buiten de komende 60 dagen.");
  }

  return weeks;
}

async function getWeek(weekStart) {
  const cached = cache.get(weekStart);
  if (cached && Date.now() - cached.savedAt < CACHE_DURATION) {
    return cached.week;
  }

  const week = await fetchAvailabilityWeek(weekStart);
  cache.set(weekStart, { savedAt: Date.now(), week });
  return week;
}

async function handleAvailability(requestUrl, response) {
  let requested;
  try {
    requested = validateWeeks(requestUrl.searchParams);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const results = await Promise.all(
    requested.map(async (weekStart) => {
      try {
        return { week: await getWeek(weekStart) };
      } catch (error) {
        return { error: { weekStart, message: error.message } };
      }
    }),
  );
  const weeks = results.flatMap((result) => (result.week ? [result.week] : []));
  const errors = results.flatMap((result) =>
    result.error ? [result.error] : [],
  );

  sendJson(response, weeks.length === 0 ? 502 : 200, {
    fetchedAt: new Date().toISOString(),
    weeks,
    errors,
  });
}

async function handleStatic(pathname, response) {
  const staticFile = STATIC_FILES.get(pathname);
  if (!staticFile) {
    response.writeHead(404).end("Niet gevonden");
    return;
  }

  try {
    const [relativePath, contentType] = staticFile;
    const content = await readFile(new URL(relativePath, ROOT));
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "Content-Security-Policy":
        "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch {
    response.writeHead(500).end("De app kon niet worden geladen.");
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" }).end();
    return;
  }

  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  );
  if (requestUrl.pathname === "/api/availability") {
    await handleAvailability(requestUrl, response);
    return;
  }

  await handleStatic(requestUrl.pathname, response);
});

server.listen(PORT, HOST, () => {
  console.log(`Kapperplekcheck draait op http://${HOST}:${PORT}`);
});
