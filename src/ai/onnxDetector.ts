import type * as Ort from "onnxruntime-web";
import type { BemisiaDetector, Detection } from "./types";
import type { Settings } from "../types";
import { getTilePositions, remapDetection } from "./tiling";
import { cropTile, toCHW } from "./preprocessing";
import { globalNms } from "./nms";
import { loadModelInfo, modelIdentity } from "./modelInfo";
export class OnnxBemisiaDetector implements BemisiaDetector {
  private session?: Ort.InferenceSession;
  private ort?: typeof Ort;
  private version = "onnx-not-initialized";
  constructor(private settings: Settings) {}
  async initialize() {
    const url = `${import.meta.env.BASE_URL}models/bemisia.onnx`;
    const response = await fetch(url, { cache: "no-store" });
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
    this.version = modelIdentity(await loadModelInfo(), sha256);
    this.ort = await import("onnxruntime-web/wasm");
    this.ort.env.wasm.numThreads = 1;
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
        if (
          output.dims.length !== 3 ||
          output.dims[0] !== 1 ||
          output.dims[1] !== 5
        )
          throw new Error(
            "Output model harus [1,5,N]; sesuaikan decoder model.",
          );
        const n = output.dims[2],
          data = output.data as Float32Array;
        for (let j = 0; j < n; j++) {
          const confidence = data[4 * n + j];
          if (confidence < this.settings.confidence) continue;
          const x = data[j],
            y = data[n + j],
            w = data[2 * n + j],
            h = data[3 * n + j];
          all.push(
            remapDetection(
              {
                x1: x - w / 2,
                y1: y - h / 2,
                x2: x + w / 2,
                y2: y + h / 2,
                confidence,
                classId: 0,
                className: "Bemisia",
              },
              tiles[i],
            ),
          );
        }
      } finally {
        input.dispose();
        if (outputs)
          for (const tensor of Object.values(outputs)) tensor.dispose();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onProgress?.("Combining detections...");
    const detections = globalNms(
      all,
      this.settings.nmsIou,
      this.settings.confidence,
    );
    return {
      detections,
      count: detections.length,
      meanConfidence: detections.length
        ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
        : 0,
      inferenceTimeMs: performance.now() - start,
      modelVersion: this.getModelInfo().version,
      tileCount: tiles.length,
    };
  }
  async dispose() {
    await this.session?.release();
  }
}
