import { getDb } from "./db";
import type { AnalysisJob } from "../types";

// Photos analysed in the background, persisted so a closed app resumes where it stopped.
export async function enqueueAnalysis(job: AnalysisJob, photo: Blob) {
  const db = await getDb();
  const tx = db.transaction(["jobs", "job_images"], "readwrite");
  await Promise.all([
    tx.objectStore("jobs").put(job),
    tx.objectStore("job_images").put(photo, job.id),
    tx.done,
  ]);
}

export async function listJobs() {
  return (await (await getDb()).getAll("jobs")).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export async function saveJob(job: AnalysisJob) {
  await (await getDb()).put("jobs", job);
}

export async function jobPhoto(id: string) {
  return (await getDb()).get("job_images", id);
}

export async function removeJob(id: string) {
  const db = await getDb();
  const tx = db.transaction(["jobs", "job_images"], "readwrite");
  await Promise.all([
    tx.objectStore("jobs").delete(id),
    tx.objectStore("job_images").delete(id),
    tx.done,
  ]);
}

// A job left "processing" was cut off when the app closed; run it again.
export async function recoverInterruptedJobs() {
  for (const job of await listJobs())
    if (job.status === "processing")
      await saveJob({ ...job, status: "waiting" });
}

export const nextWaitingJob = (jobs: AnalysisJob[]) =>
  jobs.find((j) => j.status === "waiting");
