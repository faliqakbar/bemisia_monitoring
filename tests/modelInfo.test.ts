import { describe, it, expect } from "vitest";
import { parseModelInfo, modelIdentity } from "../src/ai/modelInfo";
import { calculateTrend, chartSeries, findBaseline } from "../src/utils/trend";
const sha256 = "a".repeat(64);
const metadata = {
  version: "bemisia-trial-v1",
  sha256,
  trial: true,
  inputSize: 640,
  classNames: ["bemisia"],
};
describe("installed model identity", () => {
  it("does not turn a switch from mock to real into a population alert", () => {
    const previous = {
      bemisia_count: 280,
      bemisia_per_day: 40,
      exposure_days: 7,
      model_version: "mock-v1",
    };
    expect(calculateTrend(39, 7, previous, "bemisia-trial-v1")).toMatchObject({
      previous_count: null,
      rate_change_percent: null,
    });
    expect(
      calculateTrend(560, 7, previous, "mock-v1").rate_change_percent,
    ).toBe(100);
  });
  it("records trial version and actual weight fingerprint", () => {
    expect(modelIdentity(parseModelInfo(metadata), sha256)).toBe(
      "bemisia-trial-v1-aaaaaaaaaaaa",
    );
  });
  it("rejects stale metadata after replacing weights", () => {
    expect(() => modelIdentity(metadata, "b".repeat(64))).toThrow(
      "tidak cocok",
    );
  });
  it("fingerprints models without a sidecar", () => {
    expect(modelIdentity(null, sha256)).toBe("bemisia-onnx-aaaaaaaaaaaa");
  });
  it("rejects unrelated classes and incompatible image sizes", () => {
    expect(() =>
      parseModelInfo({ ...metadata, classNames: ["person"] }),
    ).toThrow();
    expect(() => parseModelInfo({ ...metadata, inputSize: 320 })).toThrow();
    expect(() => parseModelInfo({ ...metadata, sha256: "invalid" })).toThrow();
  });
});

describe("comparison across model versions", () => {
  const s = (captured_at: string, model_version: string, trap_id = "t1") => ({
    trap_id,
    captured_at,
    model_version,
  });
  const sessions = [
    s("2026-11-05", "mock-v1"),
    s("2026-11-04", "bemisia-trial-v1-aaa"),
    s("2026-11-03", "bemisia-trial-v1-aaa", "t2"),
    s("2026-11-01", "mock-v1"),
  ];
  it("skips a mock fallback and compares with the last same-model observation", () => {
    expect(
      findBaseline(sessions, "t1", "2026-11-06", "bemisia-trial-v1-aaa"),
    ).toBe(sessions[1]);
    expect(
      findBaseline(sessions, "t1", "2026-11-06", "bemisia-trial-v2-bbb"),
    ).toBeUndefined();
    expect(
      findBaseline(sessions, "t1", "2026-11-04", "bemisia-trial-v1-aaa"),
    ).toBeUndefined();
  });
  it("charts only the newest model version", () => {
    const t1 = sessions.filter((x) => x.trap_id === "t1");
    expect(chartSeries(t1)).toEqual({
      version: "mock-v1",
      points: [t1[2], t1[0]],
      hidden: 1,
    });
    expect(chartSeries([])).toEqual({
      version: undefined,
      points: [],
      hidden: 0,
    });
  });
});
