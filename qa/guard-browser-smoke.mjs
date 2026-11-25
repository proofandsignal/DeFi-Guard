/**
 * Hermetic Chromium smoke for the DeFi Guard synthetic risk preview.
 * Uses only a preinstalled Chrome/Chromium and Node's CDP WebSocket.
 * It is not deployed HTTPS, Samsung, legal, or owner approval evidence.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function locateChrome() {
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("No preinstalled Chromium/Chrome; abort without downloading");
}


async function allocatePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise(resolve => probe.close(resolve));
  if (!port) throw new Error("Unable to allocate a local DevTools port");
  return port;
}

async function eventually(fn, description, attempts = 150) {
  let last = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const value = await fn();
      if (value) return value;
      last = String(value);
    } catch (error) {
      last = error.message;
    }
    await pause(100);
  }
  throw new Error("Timed out: " + description + " (" + last + ")");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.requests = [];
    ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(message.params?.exceptionDetails?.text || "JS exception");
      }
      if (message.method === "Network.requestWillBeSent") {
        this.requests.push(message.params?.request?.url || "");
      }
      if (message.id == null) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  call(method, params = {}) {
    const id = ++this.id;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return Promise.race([
      result,
      pause(7000).then(() => { throw new Error("CDP timeout: " + method); }),
    ]);
  }

  async eval(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }
}


const html = await readFile(new URL("../preview/boost-nine/index.html", import.meta.url), "utf8");
const server = createServer((request, response) => {
  if (request.url !== "/") {
    response.writeHead(404, { "content-type": "text/plain" }); response.end("Not found"); return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

let chrome, ws;
const profile = await mkdtemp(join(tmpdir(), "defi-guard-browser-"));
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const appUrl = "http://127.0.0.1:" + server.address().port;
  const debugPort = await allocatePort();
  chrome = spawn(locateChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-background-networking", "--disable-extensions", "--no-first-run",
    "--no-default-browser-check", "--remote-allow-origins=*",
    "--remote-debugging-port=" + debugPort, "--user-data-dir=" + profile, "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeError = "";
  chrome.stderr.on("data", chunk => { chromeError = (chromeError + String(chunk)).slice(-1500); });
  const port = await eventually(async () => {
    if (chrome.exitCode !== null) throw new Error("Chrome exited: " + chromeError);
    const response = await fetch("http://127.0.0.1:" + debugPort + "/json/version");
    return response.ok ? debugPort : false;
  }, "Chrome DevTools endpoint");
  const page = await eventually(async () => {
    const response = await fetch("http://127.0.0.1:" + port + "/json/list");
    return (await response.json()).find(item => item.type === "page" && item.webSocketDebuggerUrl);
  }, "Chrome page target");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Network.enable");
  await cdp.call("Page.navigate", { url: appUrl + "/" });
  await eventually(() => cdp.eval("document.readyState === 'complete' && document.querySelector('#state')?.textContent === 'OK'"), "first guard state");
  assert.equal(await cdp.eval("document.documentElement.lang"), "en");
  assert.match(await cdp.eval("document.title"), /DeFi Guard/);
  const states = [
    ["ok", "OK"], ["watch", "WATCH"], ["warning", "WARNING"],
    ["critical", "CRITICAL"], ["stale", "VERIFY"]
  ];
  for (const [preset, expected] of states) {
    const result = await cdp.eval(
      "document.querySelector('#preset').value=" + JSON.stringify(preset) +
      "; document.querySelector('#preset').dispatchEvent(new Event('change', {bubbles:true})); document.querySelector('#state').textContent"
    );
    assert.equal(result, expected, "preset " + preset);
    assert.equal(await cdp.eval("document.querySelector('#result').dataset.state"), expected);
  }
  await cdp.eval("document.querySelector('#upstream').value='BLOCK'; document.querySelector('#evaluate').click()");
  assert.equal(await cdp.eval("document.querySelector('#state').textContent"), "CRITICAL");
  await cdp.eval("document.querySelector('#upstream').value='OK'; document.querySelector('#quality').value='UNKNOWN'; document.querySelector('#evaluate').click()");
  assert.equal(await cdp.eval("document.querySelector('#state').textContent"), "VERIFY");
  await cdp.eval("document.querySelector('#quality').value='COMPLETE'; document.querySelector('#hf').value='-2'; document.querySelector('#evaluate').click()");
  assert.equal(await cdp.eval("document.querySelector('#state').textContent"), "VERIFY");
  assert.match(await cdp.eval("document.querySelector('#summary').textContent"), /Invalid numeric input/);
  await cdp.eval("document.querySelector('#preset').value='ok'; document.querySelector('#preset').dispatchEvent(new Event('change'))");
  for (const width of [360, 412, 1440]) {
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      width, height: 900, deviceScaleFactor: 2, mobile: width < 700
    });
    await pause(150);
    const metrics = await cdp.eval("({viewport: innerWidth, scroll: document.documentElement.scrollWidth})");
    assert.equal(metrics.viewport, width);
    assert.ok(metrics.scroll <= width + 2, "horizontal overflow at " + width);
  }
  const external = cdp.requests.filter(url => url && !url.startsWith(appUrl) &&
    !url.startsWith("data:") && !url.startsWith("about:"));
  assert.deepEqual(external, [], "no external network calls");
  assert.deepEqual(cdp.exceptions, [], "no JavaScript exceptions");
  process.stdout.write("DEFI GUARD CHROMIUM PASS: five risk presets, upstream block, stale evidence, input validation, 360/412/1440 layouts, zero external calls\n");
} finally {
  if (ws) ws.close();
  if (chrome && chrome.exitCode === null) {
    const exited = once(chrome, "exit").catch(() => {});
    chrome.kill("SIGTERM");
    await Promise.race([exited, pause(1500)]);
    if (chrome.exitCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([exited, pause(1000)]);
    }
  }
  await new Promise(resolve => server.close(() => resolve()));
  await rm(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 125 });
}
