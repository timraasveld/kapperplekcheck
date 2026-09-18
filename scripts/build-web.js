import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const webDirectory = path.join(root, "www");
const staticFiles = [
  ["public/index.html", "index.html"],
  ["public/styles.css", "styles.css"],
  ["shared/domain.js", "domain.js"],
  ["src/source.js", "source.js"],
];

await rm(webDirectory, { recursive: true, force: true });
await mkdir(webDirectory, { recursive: true });
await Promise.all(
  staticFiles.map(([source, target]) =>
    copyFile(path.join(root, source), path.join(webDirectory, target)),
  ),
);

await build({
  entryPoints: [path.join(root, "public/app.js")],
  bundle: true,
  external: ["/domain.js", "/source.js"],
  format: "esm",
  outfile: path.join(webDirectory, "app.js"),
  platform: "browser",
  sourcemap: true,
  target: "chrome120",
});