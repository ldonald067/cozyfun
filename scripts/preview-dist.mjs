import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "app", "dist");
const host = "127.0.0.1";
const port = Number(process.argv[2] ?? 4173);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"]
]);

await assertPortAvailable(port);

createServer(async (req, res) => {
  let file = safeDistPath(req.url ?? "/");
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, "index.html");
  } catch {
    file = path.join(distDir, "index.html");
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", mimeTypes.get(path.extname(file)) ?? "application/octet-stream");
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Serving current build at http://${host}:${port}/`);
  logBuiltAssets().catch(() => {});
  console.log("Press Ctrl+C to stop.");
});

function safeDistPath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const requested = path.resolve(distDir, `.${decodeURIComponent(pathname)}`);
  return isInsideDist(requested) ? requested : path.join(distDir, "index.html");
}

function isInsideDist(filePath) {
  const relative = path.relative(distDir, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function assertPortAvailable(targetPort) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Port ${targetPort} is already in use.`)));
    probe.once("listening", () => probe.close(resolve));
    probe.listen(targetPort, host);
  });
}

async function logBuiltAssets() {
  const html = await readFile(path.join(distDir, "index.html"), "utf8");
  const assets = Array.from(html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g), (match) => match[1]);
  for (const asset of assets) console.log(`- ${asset}`);
}
