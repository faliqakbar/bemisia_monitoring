import { describe, it, expect } from "vitest";
import { parseExpectedSize, parseParams } from "../server/params";
import { datasetFiles, parseDatasetMeta } from "../server/dataset";
import { resizeTileBilinear } from "../src/ai/resample";
import { parseServerResult } from "../src/ai/serverDetector";
import { decodeYolo, toPlanar } from "../src/ai/yolo";
import { DEFAULT_SETTINGS } from "../src/types";

describe("server request parameters", () => {
  it("defaults to the app settings and accepts valid overrides", () => {
    expect(parseParams(new URLSearchParams())).toEqual({
      confidence: DEFAULT_SETTINGS.confidence,
      nmsIou: DEFAULT_SETTINGS.nmsIou,
      tileSize: DEFAULT_SETTINGS.tileSize,
      overlap: DEFAULT_SETTINGS.overlap,
    });
    expect(
      parseParams(new URLSearchParams("tileSize=640.4&confidence=0.4")),
    ).toMatchObject({ tileSize: 640, confidence: 0.4 });
  });
  it("rejects values outside the Settings page ranges", () => {
    for (const q of ["tileSize=5", "overlap=0.9", "confidence=abc", "nmsIou=1"])
      expect(() => parseParams(new URLSearchParams(q))).toThrow(
        "harus di antara",
      );
  });
});

describe("shared YOLO decoding", () => {
  it("keeps boxes above the threshold and maps them back into the photo", () => {
    // Two candidates (N=2): rows cx, cy, w, h, score.
    const data = new Float32Array([
      320, 100, 320, 100, 64, 10, 64, 10, 0.9, 0.1,
    ]);
    const tile = { x: 100, y: 200, width: 320, height: 320 };
    expect(decodeYolo(data, [1, 5, 2], 0.25, tile)).toEqual([
      {
        x1: 100 + 144,
        y1: 200 + 144,
        x2: 100 + 176,
        y2: 200 + 176,
        confidence: expect.closeTo(0.9),
        classId: 0,
        className: "Bemisia",
      },
    ]);
    expect(() => decodeYolo(data, [1, 6, 2], 0.25, tile)).toThrow("[1,5,N]");
  });
  it("converts interleaved RGB and RGBA pixels to planar CHW", () => {
    const planar = (values: number[], pixels: number, channels: number) =>
      Array.from(toPlanar(values, pixels, channels)).map((v) => +v.toFixed(4));
    expect(planar([255, 0, 51, 0, 255, 102], 2, 3)).toEqual([
      1, 0, 0, 1, 0.2, 0.4,
    ]);
    expect(planar([255, 0, 51, 9], 1, 4)).toEqual([1, 0, 0.2]);
  });
});

describe("server response validation", () => {
  const ok = {
    detections: [
      {
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        confidence: 0.8,
        classId: 0,
        className: "Bemisia",
      },
    ],
    count: 1,
    meanConfidence: 0.8,
    inferenceTimeMs: 1200,
    modelVersion: "bemisia-trial-v1-3f577990f777",
    tileCount: 25,
  };
  it("accepts a well-formed result and drops unknown fields", () => {
    expect(parseServerResult({ ...ok, warning: "x", extra: 1 })).toEqual(ok);
  });
  it("rejects malformed or inconsistent responses", () => {
    for (const bad of [
      null,
      { ...ok, count: 2 },
      { ...ok, modelVersion: "<script>" },
      { ...ok, detections: [{ ...ok.detections[0], x1: "1" }] },
      { error: "Analisis gagal di server." },
    ])
      expect(() => parseServerResult(bad)).toThrow("tidak valid");
  });
});

describe("canvas-style tile resize", () => {
  it("keeps pixels unchanged at 1:1 and reads only inside the tile", () => {
    // 3x2 RGB image; tile = the right 2x2 block.
    const src = [
      1, 1, 1, 10, 20, 30, 40, 50, 60, 2, 2, 2, 70, 80, 90, 100, 110, 120,
    ];
    expect(
      Array.from(
        resizeTileBilinear(src, 3, 3, { x: 1, y: 0, width: 2, height: 2 }, 2),
      ),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  });
  it("interpolates between pixel centres and clamps at the edges", () => {
    // 2x1 grey gradient 0 -> 100 upscaled to 4 columns (RGBA input).
    const src = [0, 0, 0, 255, 100, 100, 100, 255];
    const out = resizeTileBilinear(
      src,
      2,
      4,
      { x: 0, y: 0, width: 2, height: 1 },
      4,
    );
    expect(Array.from(out.filter((_, i) => i % 3 === 0)).slice(0, 4)).toEqual([
      0, 25, 75, 100,
    ]);
  });
});

describe("expected photo size", () => {
  it("is optional but must be positive integers when given", () => {
    expect(parseExpectedSize(new URLSearchParams())).toBeNull();
    expect(
      parseExpectedSize(new URLSearchParams("width=4000&height=3000")),
    ).toEqual({
      width: 4000,
      height: 3000,
    });
    for (const q of ["width=4000", "width=0&height=1", "width=1.5&height=2"])
      expect(() => parseExpectedSize(new URLSearchParams(q))).toThrow(
        "bilangan bulat",
      );
  });
});

describe("dataset metadata", () => {
  const meta = {
    id: "3f2a9c1e-0000-4000-8000-000000000001",
    label: "GH12 / T01",
    trap_id: "00000000-0000-4000-8000-000000000011",
    captured_at: "2026-11-10T03:00:00.000Z",
    model_version: "bemisia-trial-v2-e1af752e74de",
    width: 1600,
    height: 1200,
    feedback: "needs_review",
    notes: "box terlewat di pojok",
    bemisia_count: 1,
    exposure_days: 7,
    detections: [{ x1: 160, y1: 120, x2: 176, y2: 132, confidence: 0.8 }],
  };
  it("accepts a reviewed photo and stores boxes as fractions of the photo", () => {
    const files = datasetFiles(parseDatasetMeta(meta), "image/jpeg");
    expect(files.image).toBe(
      "images/2026-11/3f2a9c1e-0000-4000-8000-000000000001.jpg",
    );
    expect(files.labelPath).toBe(
      "labels/3f2a9c1e-0000-4000-8000-000000000001.json",
    );
    expect(files.label.predictions[0]).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.01,
      height: 0.01,
      confidence: 0.8,
    });
  });
  it("rejects unsafe paths, bad boxes and unknown feedback", () => {
    for (const bad of [
      { ...meta, id: "../../etc" },
      { ...meta, label: "<script>" },
      { ...meta, detections: [{ x1: 5, y1: 5, x2: 1, y2: 1, confidence: 1 }] },
      { ...meta, feedback: "maybe" },
      { ...meta, width: 0 },
    ])
      expect(() => parseDatasetMeta(bad)).toThrow("tidak valid");
    expect(() => datasetFiles(parseDatasetMeta(meta), "image/gif")).toThrow(
      "tipe foto",
    );
  });
});
