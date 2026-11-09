// Local Chrome smoke test using the built-in DevTools protocol; no paid tools or browser download.
// First run npm run preview, then: node scripts/browser-check.mjs
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
const base = process.env.TEST_BASE_URL || "http://localhost:4173";
const realModel = process.env.TEST_REAL_MODEL === "1";
// Version label the installed weights must show (public/models/model-info.json).
const installedVersion = JSON.parse(
  await readFile("public/models/model-info.json", "utf8"),
).version;
const executable =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
if (!executable)
  throw new Error("Set CHROME_PATH to a Chrome/Chromium executable.");
const output = path.resolve("test-results");
await mkdir(output, { recursive: true });
const port = 9335;
const browser = spawn(
  executable,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(output, `browser-${Date.now()}`)}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket;
let sequence = 0;
const pending = new Map();
const errors = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label) {
  for (let i = 0; i < (realModel ? 1200 : 200); i++) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await pause(150);
  }
  throw new Error(`Timed out: ${label}`);
}
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.text +
        ": " +
        JSON.stringify(result.exceptionDetails.exception),
    );
  return result.result.value;
}
async function textIncludes(text) {
  return evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
}
async function click(label) {
  await evaluate(
    `(()=>{const button=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Button missing');button.click()})()`,
  );
}
async function navigate(route) {
  await evaluate(`location.hash=${JSON.stringify(route)}`);
  await pause(250);
}
async function upload(size) {
  await evaluate(
    `(async()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=${size};const ctx=canvas.getContext('2d');ctx.fillStyle='#e3c535';ctx.fillRect(0,0,${size},${size});let seed=3;for(let i=0;i<25000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%${size};seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%${size};ctx.fillStyle=i%2?'#726019':'#fff3a1';ctx.fillRect(x,y,3,3);}const blob=await new Promise(r=>canvas.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'trap.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}
try {
  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    return response.json();
  }, "Chrome startup");
  socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) p?.reject(new Error(message.error.message));
      else p?.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      void send("Fetch.fulfillRequest", {
        requestId: message.params.requestId,
        responseCode: 404,
        body: "",
      }).catch((error) => errors.push(String(error)));
    } else if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  // Default smoke test deliberately verifies missing-model fallback even when weights are installed.
  if (!realModel)
    await send("Fetch.enable", {
      patterns: [{ urlPattern: "*/models/bemisia.onnx*" }],
    });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: base });
  await waitFor(() => textIncludes("Monitoring terbaru"), "dashboard");
  if (!(await textIncludes("DEMO MODE")))
    throw new Error(
      "Use --mode browser-test for the preview build: smoke tests must not write to your cloud project.",
    );
  // public/_headers (Cloudflare) and vite preview enable multi-threaded ONNX.
  if (!(await evaluate("crossOriginIsolated")))
    throw new Error("Page is not cross-origin isolated");
  const desktop = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(output, "dashboard-desktop.png"),
    Buffer.from(desktop.data, "base64"),
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(200);
  if (await evaluate("document.documentElement.scrollWidth>window.innerWidth"))
    throw new Error("Horizontal overflow on mobile");
  const mobile = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(output, "dashboard-mobile.png"),
    Buffer.from(mobile.data, "base64"),
  );
  await navigate("/settings");
  await waitFor(() => textIncludes("Detection settings"), "settings");
  await evaluate(`document.querySelector('input[type=checkbox]').click()`);
  await click("Simpan Pengaturan");
  await waitFor(
    () => textIncludes("Pengaturan tersimpan."),
    "settings persistence",
  );
  await navigate("/monitoring");
  await click("Scan QR");
  await waitFor(
    () => evaluate('!!document.querySelector(".qr-video")'),
    "QR dialog",
  );
  await evaluate(
    `(()=>{const input=document.querySelector('input[placeholder="BEMISIA|GH12|T03"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'INVALID');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("Pilih Trap");
  await waitFor(() => textIncludes("QR tidak valid"), "invalid QR handling");
  await click("Scan QR");
  await evaluate(
    `(()=>{const input=document.querySelector('input[placeholder="BEMISIA|GH12|T03"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'BEMISIA|GH12|T03');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("Pilih Trap");
  await waitFor(() => textIncludes("Upload dari Galeri"), "capture");
  await upload(1200);
  await waitFor(() => textIncludes("Analyze Bemisia"), "quality evaluation");
  if (
    await evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze Bemisia')).disabled`,
    )
  )
    throw new Error("Valid generated image was rejected");
  await click("Analyze Bemisia");
  await waitFor(() => textIncludes("Hasil pengamatan"), "detection result");
  if (realModel) {
    if (
      !(await textIncludes(installedVersion)) ||
      (await textIncludes("AI model belum tersedia"))
    ) {
      throw new Error(
        "Real ONNX model failed: " +
          (await evaluate("document.body.innerText")),
      );
    }
    console.log(
      "Real model result: " +
        (await evaluate("document.querySelector('.result-summary').innerText")),
    );
    if (!(await textIncludes("Versi model berbeda")))
      throw new Error("A model switch must start a new comparison baseline.");
  } else if (!(await textIncludes("AI model belum tersedia")))
    throw new Error("Missing ONNX did not show fallback warning");
  await click("Review Detection");
  await waitFor(
    () =>
      evaluate(
        'document.querySelector(".image-viewport canvas")?.width===1200',
      ),
    "full resolution viewer",
  );
  await click("Perlu Koreksi").catch(() => click("⚠ Perlu Koreksi"));
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(
      output,
      realModel ? "result-onnx-mobile.png" : "result-mobile.png",
    ),
    Buffer.from(result.data, "base64"),
  );
  await click("Save Monitoring");
  await waitFor(
    () => textIncludes("Monitoring tersimpan di perangkat ini."),
    "local save",
  );
  // The worker only controls pages loaded after it activates; a fast analysis can beat it.
  await waitFor(
    () =>
      evaluate(
        "navigator.serviceWorker.getRegistration().then(r=>r?.active?.state==='activated')",
      ),
    "service worker activation",
  );
  await send("Page.reload");
  await waitFor(() => textIncludes("Perlu koreksi"), "persisted feedback");
  await navigate("/capture/00000000-0000-4000-8000-000000000013");
  await waitFor(() => textIncludes("Upload dari Galeri"), "capture again");
  await upload(200);
  await waitFor(() => textIncludes("Resolusi minimum"), "resolution rejection");
  if (
    !(await evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze Bemisia')).disabled`,
    ))
  )
    throw new Error("Low resolution image was not blocked");
  await navigate("/");
  await waitFor(
    () => evaluate("!!navigator.serviceWorker.controller"),
    "service worker control",
  );
  const analyzeTrap = async (label) => {
    await navigate("/capture/00000000-0000-4000-8000-000000000013");
    await waitFor(() => textIncludes("Upload dari Galeri"), `${label} capture`);
    await upload(1200);
    await waitFor(() => textIncludes("Analyze Bemisia"), `${label} quality`);
    await click("Analyze Bemisia");
    await waitFor(() => textIncludes("Hasil pengamatan"), `${label} result`);
    if (
      !(await textIncludes(installedVersion)) ||
      (await textIncludes("AI model belum tersedia"))
    )
      throw new Error(
        `${label} ONNX failed: ` + (await evaluate("document.body.innerText")),
      );
  };
  // Runtime caching only stores the model once the service worker controls the page.
  if (realModel) {
    await analyzeTrap("online cached");
    await navigate("/");
    await waitFor(() => textIncludes("Monitoring terbaru"), "dashboard");
  }
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await send("Page.reload");
  await waitFor(() => textIncludes("Monitoring terbaru"), "offline reload");
  if (realModel) await analyzeTrap("offline");
  if (errors.length)
    throw new Error(`Browser exceptions: ${JSON.stringify(errors)}`);
  console.log(
    `PASS: desktop/mobile dashboard, no mobile overflow, settings, invalid/valid QR, image upload, quality gate, ${realModel ? "real ONNX inference" : "missing ONNX fallback"}, full resolution viewer, feedback, save, persistence, offline PWA reload${realModel ? ", offline ONNX inference" : ""}.`,
  );
} finally {
  if (socket?.readyState === 1) {
    await send("Browser.close").catch(() => {});
    socket.close();
  }
  browser.kill();
}
