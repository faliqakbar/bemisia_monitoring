// Cloud Run AI server: runs the same ONNX model, tiling, decoder and NMS as the
// browser detector, so results and model version stay comparable.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import path from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { getTilePositions } from "../src/ai/tiling";
import {
  MODEL_INPUT,
  decodeYolo,
  summarizeDetections,
  toPlanar,
} from "../src/ai/yolo";
import { modelIdentity, parseModelInfo } from "../src/ai/modelInfo";
import { HttpError, parseCrop, parseExpectedSize, parseParams } from "./params";
import { resizeTileBilinear } from "../src/ai/resample";
import { uploadFiles } from "@huggingface/hub";
import { datasetFiles, parseDatasetMeta, type DatasetMeta } from "./dataset";
import type { Detection, DetectorResult } from "../src/ai/types";

const PORT = Number(process.env.PORT ?? 8080);
const MODEL_DIR = process.env.MODEL_DIR ?? path.resolve("models");
// Comma separated list, or "*" to allow any site to call the server.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
// Cloud Run rejects HTTP/1 bodies above 32 MiB.
const MAX_BODY_BYTES = 30 * 1024 * 1024;
// Same ceiling the app applies before analysis.
const MAX_PIXELS = 50_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Private Hugging Face dataset for reviewed photos (Modal secret "bemisia-hf").
const HF_TOKEN = process.env.HF_TOKEN ?? "";
const HF_DATASET = process.env.HF_DATASET ?? "";

async function loadModel() {
  const bytes = await readFile(path.join(MODEL_DIR, "bemisia.onnx"));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const info = parseModelInfo(
    JSON.parse(await readFile(path.join(MODEL_DIR, "model-info.json"), "utf8")),
  );
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: ["cpu"],
    intraOpNumThreads: availableParallelism(),
  });
  return { session, version: modelIdentity(info, sha256) };
}

async function detect(
  model: Awaited<ReturnType<typeof loadModel>>,
  body: Buffer,
  params: ReturnType<typeof parseParams>,
  expected: { width: number; height: number } | null,
  crop: ReturnType<typeof parseCrop>,
): Promise<DetectorResult> {
  const start = performance.now();
  let decoded;
  try {
    // rotate() applies EXIF orientation, as the browser does when it draws the photo.
    decoded = await sharp(body, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(415, "Foto tidak dapat dibaca atau melebihi 50MP.");
  }
  const { data, info } = decoded;
  // Detections are in the app's canvas coordinates, so the decoded size must match it.
  if (
    expected &&
    (expected.width !== info.width || expected.height !== info.height)
  )
    throw new HttpError(
      409,
      `Ukuran foto ${info.width}x${info.height} berbeda dari aplikasi ${expected.width}x${expected.height}.`,
    );
  if (
    crop &&
    (crop.x + crop.width > info.width || crop.y + crop.height > info.height)
  )
    throw new HttpError(400, "Area potong trap di luar foto.");
  const area = crop ?? { x: 0, y: 0, width: info.width, height: info.height };
  // Tiles are laid out over the crop; pixels are read from the full photo.
  const tiles = getTilePositions(
    area.width,
    area.height,
    params.tileSize,
    params.overlap,
  );
  const all: Detection[] = [];
  for (const tile of tiles) {
    const pixels = resizeTileBilinear(
      data,
      info.width,
      3,
      { ...tile, x: tile.x + area.x, y: tile.y + area.y },
      MODEL_INPUT,
    );
    const input = new ort.Tensor(
      "float32",
      toPlanar(pixels, MODEL_INPUT * MODEL_INPUT, 3),
      [1, 3, MODEL_INPUT, MODEL_INPUT],
    );
    const outputs = await model.session.run({
      [model.session.inputNames[0]]: input,
    });
    const output = outputs[model.session.outputNames[0]];
    all.push(
      ...decodeYolo(
        output.data as Float32Array,
        output.dims,
        params.confidence,
        tile,
      ),
    );
  }
  return {
    ...summarizeDetections(all, params),
    inferenceTimeMs: performance.now() - start,
    modelVersion: model.version,
    tileCount: tiles.length,
  };
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > MAX_BODY_BYTES)
      return reject(new HttpError(413, "Foto melebihi 30 MB."));
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Foto melebihi 30 MB."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*"))
    res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const model = await loadModel();
console.log(`Model ${model.version} loaded, ${availableParallelism()} threads`);

createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
    } else if (
      req.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      send(res, 200, {
        ok: true,
        modelVersion: model.version,
        dataset: !!(HF_TOKEN && HF_DATASET),
      });
    } else if (req.method === "POST" && url.pathname === "/dataset") {
      if (!HF_TOKEN || !HF_DATASET)
        throw new HttpError(503, "Dataset belum dikonfigurasi di server.");
      const body = await readBody(req);
      let form: FormData;
      try {
        form = await new Request("http://local/", {
          method: "POST",
          headers: { "content-type": req.headers["content-type"] ?? "" },
          body: new Uint8Array(body),
        }).formData();
      } catch {
        throw new HttpError(400, "Kirim foto dan metadata sebagai form-data.");
      }
      const photo = form.get("photo"),
        rawMeta = form.get("meta");
      if (!(photo instanceof Blob) || !IMAGE_TYPES.includes(photo.type))
        throw new HttpError(415, "Foto dataset harus JPEG, PNG, atau WebP.");
      let meta: DatasetMeta;
      try {
        meta = parseDatasetMeta(JSON.parse(String(rawMeta)));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, "Metadata dataset bukan JSON.");
      }
      const bytes = Buffer.from(await photo.arrayBuffer());
      // Boxes are in the app's upright canvas; the stored file must match it.
      const info = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
        .metadata()
        .catch(() => {
          throw new HttpError(415, "Foto dataset tidak dapat dibaca.");
        });
      const turned = (info.orientation ?? 1) >= 5;
      const [w, h] = turned
        ? [info.height, info.width]
        : [info.width, info.height];
      if (w !== meta.width || h !== meta.height)
        throw new HttpError(409, "Ukuran foto dataset berbeda dari aplikasi.");
      const files = datasetFiles(meta, photo.type);
      await uploadFiles({
        repo: { type: "dataset", name: HF_DATASET },
        accessToken: HF_TOKEN as `hf_${string}`,
        commitTitle: `Add ${meta.label} ${meta.captured_at}`,
        files: [
          {
            path: files.image,
            content: new Blob([bytes], { type: photo.type }),
          },
          {
            path: files.labelPath,
            content: new Blob([JSON.stringify(files.label, null, 1)], {
              type: "application/json",
            }),
          },
        ],
      });
      console.log(`dataset ${files.image} boxes=${meta.detections.length}`);
      send(res, 200, { ok: true, image: files.image });
    } else if (req.method === "POST" && url.pathname === "/detect") {
      const type = (req.headers["content-type"] ?? "").split(";")[0].trim();
      if (!IMAGE_TYPES.includes(type))
        throw new HttpError(
          415,
          "Kirim foto sebagai image/jpeg, image/png, atau image/webp.",
        );
      const params = parseParams(url.searchParams);
      const body = await readBody(req);
      if (!body.length) throw new HttpError(400, "Foto kosong.");
      const result = await detect(
        model,
        body,
        params,
        parseExpectedSize(url.searchParams),
        parseCrop(url.searchParams),
      );
      console.log(
        `detect ${(body.length / 1e6).toFixed(1)}MB tiles=${result.tileCount} count=${result.count} ${Math.round(result.inferenceTimeMs)}ms`,
      );
      send(res, 200, result);
    } else send(res, 404, { error: "Tidak ditemukan." });
  } catch (error) {
    if (error instanceof HttpError)
      send(res, error.status, { error: error.message });
    else {
      console.error(error);
      send(res, 500, { error: "Permintaan gagal di server." });
    }
  }
}).listen(PORT, () => console.log(`Listening on ${PORT}`));
