import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wav", "audio/wav"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"]
]);

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntil(task, label, timeout = 5_000, interval = 80) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      if (await task()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

export async function assertDistExists(distDir, message) {
  try {
    const result = await stat(path.join(distDir, "index.html"));
    assert(result.isFile(), "app/dist/index.html is not a file");
  } catch {
    throw new Error(message);
  }
}

export async function assertAppReachable(port, hint = "Run scripts/preview-built.cmd first.") {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  if (!response.ok) throw new Error(`Preview server on 127.0.0.1:${port} returned ${response.status}. ${hint}`);
}

export async function startStaticServer(distDir) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(distDir, `.${pathname}`);
      if (!isInsideDir(distDir, filePath)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  const port = await listen(server);
  return {
    port,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

export async function startBrowser({
  profilePrefix = "cozy-browser-",
  downloadPrefix,
  extraArgs = [],
  windowSize,
  debuggerTimeout = 10_000
} = {}) {
  const executable = await findBrowserExecutable();
  const debugPort = await freePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), profilePrefix));
  const downloadDir = downloadPrefix ? await mkdtemp(path.join(os.tmpdir(), downloadPrefix)) : null;
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    ...extraArgs,
    "--disable-background-networking",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--headless=new",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
    ...(windowSize ? [`--window-size=${windowSize}`] : []),
    "about:blank"
  ];
  const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  await waitUntil(async () => {
    if (child.exitCode !== null) throw new Error(`Browser exited early:\n${stderr}`);
    return Boolean(await browserTargets(debugPort).catch(() => null));
  }, "browser debugger to start", debuggerTimeout);

  return {
    debugPort,
    downloadDir,
    close: async () => {
      child.kill();
      await waitForExit(child);
      await Promise.allSettled([
        removeTempDir(userDataDir),
        downloadDir ? removeTempDir(downloadDir) : Promise.resolve()
      ]);
    }
  };
}

export async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_BINARY,
    process.env.CHROME,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome or Edge executable found. Set BROWSER_BINARY to run browser QA.");
  return found;
}

export async function connectToFirstPage(debugPort, label = "browser", timeout = 10_000) {
  await waitUntil(async () => {
    try {
      await browserTargets(debugPort);
      return true;
    } catch {
      return false;
    }
  }, `${label} remote debugging`, timeout);

  const targets = await browserTargets(debugPort);
  const target = targets.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
  assert(target, `no debuggable ${label} page target found`);
  return Cdp.connect(target.webSocketDebuggerUrl);
}

export async function browserTargets(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  if (!response.ok) throw new Error(`debugger list returned ${response.status}`);
  return response.json();
}

export class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    socket.onmessage = async (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(await event.data.arrayBuffer()).toString("utf8");
      const message = JSON.parse(text);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) ?? []) handler(message.params ?? {});
    };
    socket.onclose = () => {
      for (const pending of this.pending.values()) pending.reject(new Error("CDP socket closed"));
      this.pending.clear();
    };
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("failed to open CDP socket"));
    });
    return new Cdp(socket);
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async close() {
    this.socket.close();
  }
}

export async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluation failed");
  return result.result.value;
}

export async function captureScreenshot(cdp, outputDir, fileName) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, Buffer.from(screenshot.data, "base64"));
  return filePath;
}

export async function clickPoint(cdp, x, y, delay = 45) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(delay);
}

export async function clickSelector(cdp, selector, options = {}) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })()`
  );
  assert(box, `missing element for click: ${selector}`);
  const x = box.left + box.width * (options.xRatio ?? 0.5);
  const y = box.top + box.height * (options.yRatio ?? 0.5);
  await clickPoint(cdp, x, y, options.delay ?? 80);
}

export async function dragPath(cdp, points) {
  const first = points[0];
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: first.x, y: first.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: first.x, y: first.y, button: "left", clickCount: 1 });
  for (const point of points.slice(1)) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1 });
    await sleep(12);
  }
  const last = points[points.length - 1];
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", clickCount: 1 });
  await sleep(55);
}

export async function setRange(cdp, selector, value) {
  await setInputValue(cdp, selector, value);
}

export async function setText(cdp, selector, value) {
  await setInputValue(cdp, selector, value);
}

export async function statusText(cdp) {
  return evaluate(cdp, `document.querySelector('[data-testid="status-message"]')?.textContent ?? ""`);
}

export async function waitForStatus(cdp, expected, timeout = 5_000) {
  await waitUntil(async () => (await statusText(cdp)) === expected, `status "${expected}"`, timeout);
}

async function setInputValue(cdp, selector, value) {
  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error(${JSON.stringify(`missing input: ${selector}`)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return input.value;
    })()`
  );
  await sleep(40);
}

function isInsideDir(baseDir, filePath) {
  const relative = path.relative(baseDir, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "server did not bind to a TCP port");
      resolve(address.port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1_500);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function removeTempDir(dir) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Could not remove temporary browser directory: ${error.message}`);
        return;
      }
      await sleep(150 * attempt);
    }
  }
}
