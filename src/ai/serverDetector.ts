import type { Detection, DetectorResult } from "./types";
import type { Settings } from "../types";
import { getTilePositions } from "./tiling";
import { sourceFiles } from "../utils/image";
import { cropSources } from "../utils/crop";

export const aiServerUrl = (import.meta.env.VITE_AI_SERVER_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

// Large photos can take a while on a cold Cloud Run instance; the local model takes over after this.
const TIMEOUT_MS = 180_000;

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
// Untrusted network response: accept only a well-formed DetectorResult.
export function parseServerResult(value: unknown): DetectorResult {
  const v = value as Partial<DetectorResult> | null;
  const valid =
    !!v &&
    Array.isArray(v.detections) &&
    v.detections.every(
      (d: Partial<Detection>) =>
        !!d &&
        isNumber(d.x1) &&
        isNumber(d.y1) &&
        isNumber(d.x2) &&
        isNumber(d.y2) &&
        isNumber(d.confidence) &&
        isNumber(d.classId) &&
        typeof d.className === "string",
    ) &&
    v.count === v.detections.length &&
    isNumber(v.meanConfidence) &&
    isNumber(v.inferenceTimeMs) &&
    isNumber(v.tileCount) &&
    typeof v.modelVersion === "string" &&
    /^[a-zA-Z0-9._-]{1,120}$/.test(v.modelVersion);
  if (!valid) throw new Error("Respons server AI tidak valid.");
  const r = v as DetectorResult;
  return {
    detections: r.detections,
    count: r.count,
    meanConfidence: r.meanConfidence,
    inferenceTimeMs: r.inferenceTimeMs,
    modelVersion: r.modelVersion,
    tileCount: r.tileCount,
  };
}

const SERVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Lossless copy of the canvas (live camera frames, or a retry after a size mismatch).
const canvasPng = (image: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    image.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Foto gagal disiapkan.")),
      "image/png",
    ),
  );

export async function detectOnServer(
  image: HTMLCanvasElement,
  settings: Settings,
  onProgress?: (message: string) => void,
): Promise<DetectorResult> {
  onProgress?.("Menyiapkan foto untuk server AI...");
  // Re-encoding (even JPEG 0.92) changes counts noticeably, so send the original
  // file when there is one; the server applies EXIF rotation like the browser.
  // A trap crop is sent as the original file plus the crop rectangle; the server
  // crops after decoding, so the upload stays the small camera JPEG.
  const crop = cropSources.get(image);
  const file = crop?.file ?? sourceFiles.get(image);
  const tiles = getTilePositions(
    image.width,
    image.height,
    settings.tileSize,
    settings.overlap,
  ).length;
  const base = {
    confidence: String(settings.confidence),
    nmsIou: String(settings.nmsIou),
    tileSize: String(settings.tileSize),
    overlap: String(settings.overlap),
  };
  const fileParams = new URLSearchParams(
    crop
      ? {
          ...base,
          width: String(crop.fullWidth),
          height: String(crop.fullHeight),
          cropX: String(crop.x),
          cropY: String(crop.y),
          cropWidth: String(image.width),
          cropHeight: String(image.height),
        }
      : { ...base, width: String(image.width), height: String(image.height) },
  );
  // The canvas itself (already cropped) needs no crop parameters.
  const canvasParams = new URLSearchParams({
    ...base,
    width: String(image.width),
    height: String(image.height),
  });
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const send = (blob: Blob, params: URLSearchParams) =>
    fetch(`${aiServerUrl}/detect?${params}`, {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
      signal: controller.signal,
    });
  try {
    onProgress?.(`Menganalisis di server AI (${tiles} tiles)...`);
    let response =
      file && SERVER_TYPES.includes(file.type)
        ? await send(file, fileParams)
        : await send(await canvasPng(image), canvasParams);
    // 409: the server decoded the file to a different size (e.g. orientation).
    if (response.status === 409 && file)
      response = await send(await canvasPng(image), canvasParams);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        (body as { error?: string } | null)?.error ??
          `Server AI gagal (HTTP ${response.status}).`,
      );
    return parseServerResult(body);
  } finally {
    clearTimeout(timer);
  }
}
