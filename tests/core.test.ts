import { describe, it, expect } from "vitest";
import { getTilePositions, remapDetection } from "../src/ai/tiling";
import { globalNms, iou } from "../src/ai/nms";
import {
  bemisiaPerDay,
  calculateTrend,
  percentChange,
  trendStatus,
} from "../src/utils/trend";
import {
  scoreQuality,
  trapCoverageCheck,
} from "../src/imageQuality/qualityEvaluator";
import { blurCheck } from "../src/imageQuality/blurCheck";
import {
  brightnessCheck,
  luminances,
} from "../src/imageQuality/brightnessCheck";
import { glareCheck } from "../src/imageQuality/glareCheck";
import { DEFAULT_SETTINGS } from "../src/types";
import type { Detection } from "../src/ai/types";
const box: Detection = {
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  confidence: 0.9,
  classId: 0,
  className: "Bemisia",
};
describe("tiling", () => {
  it("covers every pixel including the last edge without duplicate positions", () => {
    const tiles = getTilePositions(1001, 701);
    expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(tiles.length);
    expect(
      tiles.some((t) => t.x + t.width === 1001 && t.y + t.height === 701),
    ).toBe(true);
    for (let y = 0; y < 701; y += 13)
      for (let x = 0; x < 1001; x += 13)
        expect(
          tiles.some(
            (t) =>
              x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height,
          ),
        ).toBe(true);
    expect(tiles[1].x).toBe(240);
  });
  it("handles images smaller than one tile", () =>
    expect(getTilePositions(150, 180)).toEqual([
      { x: 0, y: 0, width: 150, height: 180 },
    ]));
  it("rejects invalid configuration", () => {
    expect(() => getTilePositions(0, 100)).toThrow();
    expect(() => getTilePositions(100, 100, 320, 1)).toThrow();
  });
  it("remaps resized tile coordinates including independent edge crop scales", () =>
    expect(
      remapDetection(
        { ...box, x2: 640, y2: 640 },
        { x: 240, y: 480, width: 320, height: 160 },
      ),
    ).toMatchObject({ x1: 240, y1: 480, x2: 560, y2: 640 }));
  it("clips model predictions to crop bounds", () =>
    expect(
      remapDetection(
        { ...box, x1: -10, y1: -20, x2: 700, y2: 700 },
        { x: 0, y: 0, width: 320, height: 320 },
      ),
    ).toMatchObject({ x1: 0, y1: 0, x2: 320, y2: 320 }));
});
describe("global NMS", () => {
  it("deduplicates overlap using highest confidence", () =>
    expect(
      globalNms([
        { ...box, confidence: 0.5 },
        box,
        { ...box, x1: 300, x2: 400 },
      ]),
    ).toHaveLength(2));
  it("filters confidence without suppressing other classes", () =>
    expect(
      globalNms([
        box,
        { ...box, classId: 1 },
        { ...box, x1: 300, x2: 400, confidence: 0.2 },
      ]),
    ).toHaveLength(2));
  it("returns zero IoU for disjoint boxes and handles empty input", () => {
    expect(iou(box, { ...box, x1: 200, x2: 300 })).toBe(0);
    expect(globalNms([])).toEqual([]);
  });
});
describe("trend", () => {
  it("normalizes different exposure periods", () => {
    const t = calculateTrend(200, 10, {
      bemisia_count: 140,
      bemisia_per_day: 20,
      exposure_days: 7,
    });
    expect(t.percent_change).toBeCloseTo(42.857);
    expect(t.rate_change_percent).toBe(0);
  });
  it("handles zero, missing and invalid durations without Infinity", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
    expect(bemisiaPerDay(10, 0)).toBeNull();
    expect(bemisiaPerDay(10, -1)).toBeNull();
    expect(bemisiaPerDay(10, null)).toBeNull();
    expect(bemisiaPerDay(0, 7)).toBe(0);
    expect(bemisiaPerDay(438, 7)).toBeCloseTo(62.5714);
  });
  it("applies exact configurable status boundaries", () => {
    expect(trendStatus(19.9, DEFAULT_SETTINGS)).toBe("NORMAL");
    expect(trendStatus(20, DEFAULT_SETTINGS)).toBe("WATCH");
    expect(trendStatus(50, DEFAULT_SETTINGS)).toBe("WATCH");
    expect(trendStatus(50.1, DEFAULT_SETTINGS)).toBe("HIGH");
    expect(trendStatus(null, DEFAULT_SETTINGS)).toBe("UNKNOWN");
    expect(trendStatus(60, { watchThreshold: 70, highThreshold: 100 })).toBe(
      "NORMAL",
    );
  });
  it("has no comparison for the first observation", () =>
    expect(calculateTrend(10, 2)).toMatchObject({
      previous_count: null,
      rate_change_percent: null,
      bemisia_per_day: 5,
    }));
});
describe("quality", () => {
  const good = {
    width: 1200,
    height: 1600,
    sharpnessScore: 100,
    brightness: 170,
    glarePercent: 2,
  };
  it("accepts a well lit sharp photo and does not assert coverage", () => {
    expect(scoreQuality(good, DEFAULT_SETTINGS)).toMatchObject({
      status: "GOOD",
      qualityScore: 100,
      coverage: "UNKNOWN",
    });
    expect(trapCoverageCheck()).toBe("UNKNOWN");
  });
  it("blocks low resolution, blur, severe darkness and glare", () => {
    for (const patch of [
      { width: 999 },
      { sharpnessScore: 1 },
      { brightness: 10 },
      { glarePercent: 50 },
    ])
      expect(scoreQuality({ ...good, ...patch }, DEFAULT_SETTINGS).status).toBe(
        "RETAKE",
      );
  });
  it("warns for moderate blur and keeps score within bounds", () => {
    expect(
      scoreQuality({ ...good, sharpnessScore: 40 }, DEFAULT_SETTINGS).status,
    ).toBe("WARNING");
    expect(
      scoreQuality(
        {
          ...good,
          width: 2,
          sharpnessScore: 0,
          brightness: 0,
          glarePercent: 90,
        },
        DEFAULT_SETTINGS,
      ).qualityScore,
    ).toBe(0);
  });
  it("measures uniform image Laplacian as zero", () =>
    expect(blurCheck(new Float32Array(100).fill(150), 10, 10)).toBe(0));
  it("does not classify saturated yellow as white glare", () => {
    const l = luminances(new Uint8ClampedArray([255, 255, 0, 255]));
    expect(brightnessCheck(l)).toBeLessThan(245);
    expect(glareCheck(l)).toBe(0);
  });
});
