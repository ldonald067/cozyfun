import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert, assertAppReachable, waitUntil } from "./browser-qa-helpers.mjs";
import { MATERIAL_SHOWCASE_QA_LABEL, materialShowcaseScript } from "./material-showcase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "firefox-qa");
const appPort = Number(process.env.FIREFOX_QA_APP_PORT ?? 4173);
const remotePort = Number(process.argv[2] ?? process.env.FIREFOX_QA_REMOTE_PORT ?? 9340);
const appUrl = `http://127.0.0.1:${appPort}/?firefoxQa=${MATERIAL_SHOWCASE_QA_LABEL}&cache=${Date.now()}`;

async function main() {
  await assertAppReachable(appPort);
  await mkdir(outputDir, { recursive: true });

  await waitForPort(remotePort, "Firefox remote debugging");
  const bidi = await connectBiDi(remotePort);
  try {
    await bidi.send("session.new", { capabilities: {} });
    const tree = await bidi.send("browsingContext.getTree");
    const context = tree.contexts[0].context;
    await bidi.send("browsingContext.setViewport", {
      context,
      viewport: { width: 1280, height: 800 },
      devicePixelRatio: 1
    }).catch(() => {});
    await bidi.send("browsingContext.navigate", { context, url: appUrl, wait: "complete" });
    await waitUntil(
      async () =>
        (await bidi.evaluate(
          context,
          `Boolean(document.querySelector('[data-testid="sandbox-tray"]')) &&
           (document.querySelector('[data-testid="status-message"]')?.textContent ?? "").includes("online")`
        )) === true,
      "Firefox app shell",
      15_000,
      150
    );

    const state = await bidi.evaluate(
      context,
      `(() => ({
        title: document.title,
        status: document.querySelector('[data-testid="status-message"]')?.textContent ?? "",
        styles: Array.from(document.styleSheets).map((sheet) => sheet.href).filter(Boolean),
        scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
        share: document.querySelector(".share-panel")?.textContent ?? "",
        rooms: Array.from(document.querySelectorAll('[data-testid^="scene-environment-"]')).map((button) => button.textContent.trim()),
        providers: Array.from(document.querySelectorAll(".music-source-control button")).map((button) => button.textContent.trim()),
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      }))()`
    );
    assert(state.title === "Cozy Pixel Sandbox", `Firefox loaded unexpected title: ${state.title}`);
    assert(state.status.includes("online"), `Firefox app did not report online: ${state.status}`);
    assert(state.styles.some((href) => href.includes("/assets/index-")), `Firefox did not load built CSS asset: ${state.styles.join(", ")}`);
    assert(state.scripts.some((src) => src.includes("/assets/index-")), `Firefox did not load built JS asset: ${state.scripts.join(", ")}`);
    assert(state.rooms.length === 6, `Firefox room controls mismatch: ${state.rooms.join(", ")}`);
    assert(state.providers.join("|") === "Generated|Desk Radio", `Firefox music providers mismatch: ${state.providers.join(", ")}`);
    assert(!state.hasOverflow, "Firefox desktop layout has horizontal overflow");

    const desktopPath = await capture(bidi, context, "firefox-current-desktop.png");
    await paintMaterialScene(bidi, context);
    const paintedPath = await capture(bidi, context, "firefox-painted-materials.png");
    await loadMaterialShowcase(bidi, context);
    const materialShowcasePath = await capture(bidi, context, `firefox-${MATERIAL_SHOWCASE_QA_LABEL}.png`);

    await bidi.send("browsingContext.close", { context }).catch(() => {});
    await bidi.send("session.end").catch(() => {});

    console.log("Firefox QA passed");
    console.log(`- ${desktopPath}`);
    console.log(`- ${paintedPath}`);
    console.log(`- ${materialShowcasePath}`);
    console.log(`- ${state.styles.join(", ")}`);
    console.log(`- ${state.scripts.join(", ")}`);
  } finally {
    await bidi.close().catch(() => {});
  }
}

async function connectBiDi(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error}: ${message.message ?? ""}`));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  function send(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(context, expression) {
    const result = await send("script.evaluate", {
      awaitPromise: true,
      expression,
      target: { context }
    });
    return remoteValue(result.result);
  }

  async function close() {
    if (socket.readyState === WebSocket.OPEN) socket.close();
  }

  return { close, evaluate, send };
}

async function capture(bidi, context, fileName) {
  const screenshot = await bidi.send("browsingContext.captureScreenshot", { context });
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, Buffer.from(screenshot.data, "base64"));
  return filePath;
}

async function loadMaterialShowcase(bidi, context) {
  await bidi.evaluate(context, materialShowcaseScript());
  await waitUntil(
    async () => (await bidi.evaluate(context, `(document.querySelector('[data-testid="status-message"]')?.textContent ?? "").includes("browser save loaded")`)) === true,
    "Firefox material showcase",
    15_000,
    150
  );
  await bidi.evaluate(context, `new Promise((resolve) => setTimeout(resolve, 600))`);
}

async function paintMaterialScene(bidi, context) {
  await bidi.evaluate(
    context,
    `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const tray = document.querySelector('[data-testid="sandbox-tray"]');
      const brush = document.querySelector('.brush-control input');
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      valueSetter.call(brush, '2');
      brush.dispatchEvent(new Event('input', { bubbles: true }));
      brush.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(80);
      const materialButton = (title) => Array.from(document.querySelectorAll(".material-button")).find((button) => button.textContent.trim() === title);
      const select = async (title) => {
        materialButton(title)?.click();
        await wait(40);
      };
      const point = (x, y) => {
        const rect = tray.getBoundingClientRect();
        return { clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y };
      };
      const paint = async (title, points) => {
        await select(title);
        const first = point(points[0][0], points[0][1]);
        tray.dispatchEvent(new PointerEvent("pointerdown", { ...first, bubbles: true, button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true }));
        for (const [x, y] of points) {
          const next = point(x, y);
          tray.dispatchEvent(new PointerEvent("pointermove", { ...next, bubbles: true, button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          await wait(16);
        }
        const last = point(points.at(-1)[0], points.at(-1)[1]);
        tray.dispatchEvent(new PointerEvent("pointerup", { ...last, bubbles: true, button: 0, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
        await wait(80);
      };
      const line = (x1, y1, x2, y2, steps) => Array.from({ length: steps }, (_, i) => {
        const t = steps <= 1 ? 0 : i / (steps - 1);
        return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
      });

      await paint("Wall", line(0.22, 0.78, 0.78, 0.78, 22));
      await paint("Stone", line(0.25, 0.7, 0.38, 0.7, 9));
      await paint("Wood", line(0.44, 0.71, 0.57, 0.71, 9));
      await paint("Soil", line(0.48, 0.62, 0.56, 0.62, 7));
      await paint("Seed", [[0.52, 0.57], [0.54, 0.57]]);
      await paint("Water", [[0.5, 0.57], [0.51, 0.58]]);
      await paint("Soil", line(0.62, 0.7, 0.74, 0.7, 9));
      await paint("Seed", [[0.68, 0.62], [0.69, 0.61], [0.7, 0.62]]);
      await paint("Water", line(0.66, 0.6, 0.71, 0.6, 5));
      await paint("Moss", line(0.65, 0.66, 0.75, 0.66, 8));
      await paint("Sand", line(0.3, 0.38, 0.43, 0.38, 10));
      await paint("Water", line(0.48, 0.38, 0.58, 0.38, 8));
      await paint("Lava", [[0.18, 0.5], [0.19, 0.49], [0.2, 0.5]]);
      await paint("Fire", [[0.45, 0.63], [0.46, 0.62], [0.47, 0.63]]);
      await paint("Moonwater", line(0.72, 0.36, 0.8, 0.36, 7));
      await wait(2200);
      return true;
    })()`
  );
}

function remoteValue(value) {
  if (!value || typeof value !== "object") return value;
  if (value.type === "array") return value.value.map(remoteValue);
  if (value.type === "object") return Object.fromEntries(value.value.map(([key, nested]) => [key, remoteValue(nested)]));
  if ("value" in value) return value.value;
  return value;
}

async function waitForPort(port, label) {
  await waitUntil(
    () =>
      new Promise((resolve) => {
        const socket = net.connect(port, "127.0.0.1");
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
      }),
    label,
    30000,
    150
  );
}

await main();
