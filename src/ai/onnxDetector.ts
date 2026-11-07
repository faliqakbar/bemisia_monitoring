import type * as Ort from "onnxruntime-web";
import type { BemisiaDetector, Detection } from "./types";
import type { Settings } from "../types";
import { getTilePositions } from "./tiling";
import { decodeYolo, summarizeDetections } from "./yolo";
import { cropTile, toCHW } from "./preprocessing";
import { loadModelInfo, modelIdentity } from "./modelInfo";
// Must match the runtimeCaching cacheName in vite.config.ts.
const MODEL_CACHE = "bemisia-model-weights";
export class OnnxBemisiaDetector implements BemisiaDetector {
  private session?: Ort.InferenceSession;
  private ort?: typeof Ort;
  private version = "onnx-not-initialized";
  constructor(private settings: Settings) {}
  async initialize() {
    const info = await loadModelInfo();
    // A fingerprinted URL lets the service worker keep the weights cache-first;
    // replacing the model changes model-info.json and therefore the URL.
    const url = info
      ? `${import.meta.env.BASE_URL}models/bemisia.onnx?v=${info.sha256}`
      : `${import.meta.env.BASE_URL}models/bemisia.onnx`;
    const response = await fetch(url, info ? {} : { cache: "no-store" });
    if (
      !response.ok ||
      response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("Model belum tersedia");
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    try {
      this.version = modelIdentity(info, sha256);
    } catch (error) {
      // Drop a bad cached copy so the next attempt downloads it again.
      if (typeof caches !== "undefined")
        await caches.delete(MODEL_CACHE).catch(() => undefined);
      throw error;
    }
    this.ort = await import("onnxruntime-web/wasm");
    // Threads need cross-origin isolation (public/_headers on Cloudflare Pages).
    this.ort.env.wasm.numThreads = globalThis.crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 1)
      : 1;
    this.session = await this.ort.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
    });
  }
  getModelInfo() {
    return { version: this.version, simulation: false };
  }
  async detect(
    image: HTMLCanvasElement,
    onProgress?: (message: string) => void,
  ) {
    if (!this.session || !this.ort) throw new Error("Model belum siap");
    const start = performance.now(),
      tiles = getTilePositions(
        image.width,
        image.height,
        this.settings.tileSize,
        this.settings.overlap,
      ),
      all: Detection[] = [];
    for (let i = 0; i < tiles.length; i++) {
      onProgress?.(`Analyzing tile ${i + 1} / ${tiles.length}`);
      // YOLO11 detect export: RGB, float32 NCHW [1,3,640,640], raw [1,5,N], single class, no embedded NMS.
      const input = new this.ort.Tensor(
        "float32",
        toCHW(cropTile(image, tiles[i])),
        [1, 3, 640, 640],
      );
      let outputs: Record<string, Ort.Tensor> | undefined;
      try {
        outputs = await this.session.run({
          [this.session.inputNames[0]]: input,
        });
        const output = outputs[this.session.outputNames[0]];
        all.push(
          ...decodeYolo(
            output.data as Float32Array,
            output.dims,
            this.settings.confidence,
            tiles[i],
          ),
        );
      } finally {
        input.dispose();
        if (outputs)
          for (const tensor of Object.values(outputs)) tensor.dispose();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onProgress?.("Combining detections...");
    return {
      ...summarizeDetections(all, this.settings),
      inferenceTimeMs: performance.now() - start,
      modelVersion: this.getModelInfo().version,
      tileCount: tiles.length,
    };
  }
  async dispose() {
    await this.session?.release();
  }
}
