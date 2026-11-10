import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  enqueueAnalysis,
  jobPhoto,
  listJobs,
  nextWaitingJob,
  recoverInterruptedJobs,
  removeJob,
  saveJob,
} from "../src/offline/analysisQueue";
import { DEFAULT_SETTINGS, type AnalysisJob } from "../src/types";

const job = (id: string, created_at: string): AnalysisJob => ({
  id,
  trap_id: "trap-1",
  label: "GH12 / T01",
  captured_at: created_at,
  created_at,
  quality: {} as AnalysisJob["quality"],
  settings: DEFAULT_SETTINGS,
  file_name: `${id}.jpg`,
  status: "waiting",
  attempts: 0,
});

describe("background analysis queue", () => {
  it("keeps queued photos in order and survives an interrupted analysis", async () => {
    await enqueueAnalysis(
      job("b", "2026-11-10T02:00:00Z"),
      new Blob(["second"], { type: "image/jpeg" }),
    );
    await enqueueAnalysis(
      job("a", "2026-11-10T01:00:00Z"),
      new Blob(["first"], { type: "image/jpeg" }),
    );
    expect((await listJobs()).map((j) => j.id)).toEqual(["a", "b"]);
    expect(await (await jobPhoto("a"))?.text()).toBe("first");

    // The app closed while "a" was being analysed.
    await saveJob({ ...(await listJobs())[0], status: "processing" });
    expect(nextWaitingJob(await listJobs())?.id).toBe("b");
    await recoverInterruptedJobs();
    expect(nextWaitingJob(await listJobs())?.id).toBe("a");
  });

  it("removes the job and its photo together", async () => {
    await removeJob("a");
    expect((await listJobs()).map((j) => j.id)).toEqual(["b"]);
    expect(await jobPhoto("a")).toBeUndefined();
    await removeJob("b");
    expect(nextWaitingJob(await listJobs())).toBeUndefined();
  });
});
