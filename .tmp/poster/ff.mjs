// Firefox render of the poster over WebDriver BiDi (the way scripts/firefox-qa.mjs talks to it).
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sleep, waitUntil } from "../../scripts/browser-qa-helpers.mjs";
const [url, out] = process.argv.slice(2);
const profile = await mkdtemp(path.join(os.tmpdir(), "ff-poster-"));
const ff = spawn("/Applications/Firefox.app/Contents/MacOS/firefox", ["--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", "9347", "about:blank"], { stdio: "ignore" });
try {
  let socket;
  await waitUntil(async () => {
    try {
      socket = new WebSocket("ws://127.0.0.1:9347/session");
      await new Promise((ok, no) => { socket.addEventListener("open", ok, { once: true }); socket.addEventListener("error", no, { once: true }); });
      return true;
    } catch { return false; }
  }, "firefox bidi", 30_000, 500);
  let id = 1; const pending = new Map();
  socket.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.no(new Error(m.error + ": " + m.message)) : p.ok(m.result); } });
  const send = (method, params = {}) => new Promise((ok, no) => { const n = id++; pending.set(n, { ok, no }); socket.send(JSON.stringify({ id: n, method, params })); });
  await send("session.new", { capabilities: {} });
  const context = (await send("browsingContext.getTree")).contexts[0].context;
  await send("browsingContext.setViewport", { context, viewport: { width: 960, height: 620 }, devicePixelRatio: 1 });
  await send("browsingContext.navigate", { context, url, wait: "complete" });
  await sleep(1500);
  const r = await send("script.evaluate", { awaitPromise: false, target: { context }, expression:
    `document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4270; }); JSON.stringify([document.getElementById("sky").width, getComputedStyle(document.querySelector(".scrim")).backgroundImage.slice(0, 30), getComputedStyle(document.querySelector(".drip--1")).transform])` });
  console.log("firefox:", r.result.value);
  await sleep(300);
  const shot = await send("browsingContext.captureScreenshot", { context });
  await writeFile(out, Buffer.from(shot.data, "base64"));
  socket.close();
} finally {
  ff.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true });
}
