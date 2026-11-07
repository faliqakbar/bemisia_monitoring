// Shared by the browser detector and the Cloud Run server so both decode identically.
// Must stay free of DOM APIs: server/index.ts bundles it for Node.
import type { Detection } from "./types";
import type { Tile } from "./tiling";
import { remapDetection } from "./tiling";
import { globalNms } from "./nms";

export const MODEL_INPUT = 640;

// YOLO11 detect export: raw output [1,5,N] (cx, cy, w, h, score), single class, no embedded NMS.
export function decodeYolo(
  data: Float32Array,
  dims: readonly number[],
  confidence: number,
  tile: Tile,
): Detection[] {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 5)
    throw new Error("Output model harus [1,5,N]; sesuaikan decoder model.");
  const n = dims[2],
    result: Detection[] = [];
  for (let j = 0; j < n; j++) {
    const score = data[4 * n + j];
    if (score < confidence) continue;
    const x = data[j],
      y = data[n + j],
      w = data[2 * n + j],
      h = data[3 * n + j];
    result.push(
      remapDetection(
        {
          x1: x - w / 2,
          y1: y - h / 2,
          x2: x + w / 2,
          y2: y + h / 2,
          confidence: score,
          classId: 0,
          className: "Bemisia",
        },
        tile,
      ),
    );
  }
  return result;
}

// Interleaved RGB(A) bytes -> normalized planar CHW float32.
export function toPlanar(
  data: ArrayLike<number>,
  pixels: number,
  channels: number,
) {
  const output = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++)
    for (let c = 0; c < 3; c++)
      output[c * pixels + i] = data[i * channels + c] / 255;
  return output;
}

// Global NMS across tiles plus the summary fields of a DetectorResult.
export function summarizeDetections(
  all: Detection[],
  settings: { nmsIou: number; confidence: number },
) {
  const detections = globalNms(all, settings.nmsIou, settings.confidence);
  return {
    detections,
    count: detections.length,
    meanConfidence: detections.length
      ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
      : 0,
  };
}
