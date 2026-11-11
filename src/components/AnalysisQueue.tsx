import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state";
import { jobPhoto } from "../offline/analysisQueue";
import { readImage } from "../utils/image";
import { cropCanvas } from "../utils/crop";
import { formatDate } from "../utils/date";
import type { AnalysisJob } from "../types";

export function AnalysisQueue() {
  const { jobs, jobProgress, traps, setDraft, retryJob, deleteJob } = useApp();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  if (!jobs.length) return null;
  const ready = jobs.filter((j) => j.status === "done").length;

  // Opens a finished job on the usual result page; saving there removes it from the queue.
  async function review(job: AnalysisJob) {
    setError("");
    const trap = traps.find((t) => t.id === job.trap_id);
    const photo = await jobPhoto(job.id);
    if (!trap || !photo || !job.result) {
      setError("Data antrean tidak lengkap. Hapus lalu foto ulang trap ini.");
      return;
    }
    try {
      const full = await readImage(
        new File([photo], job.file_name, { type: photo.type }),
      );
      const image = job.crop ? cropCanvas(full, job.crop) : full;
      setDraft({
        trap,
        image,
        quality: job.quality,
        result: job.result,
        capturedAt: job.captured_at,
        totalMs: job.total_ms ?? 0,
        jobId: job.id,
      });
      navigate("/result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto antrean gagal dibuka.");
    }
  }

  const status = (job: AnalysisJob) =>
    job.status === "waiting"
      ? "Menunggu giliran"
      : job.status === "processing"
        ? (jobProgress[job.id] ?? "Sedang dianalisis...")
        : job.status === "done"
          ? `${job.result?.count ?? 0} Bemisia · siap direview`
          : `Gagal: ${job.error ?? "coba lagi"}`;

  return (
    <section className="panel analysis-queue">
      <div className="section-head">
        <h2>Antrean analisis</h2>
        <span className="badge">{ready} siap direview</span>
      </div>
      <ul>
        {jobs.map((job) => (
          <li key={job.id} className={`queue-item ${job.status}`}>
            <div>
              <strong>{job.label}</strong>
              <small>{formatDate(job.captured_at)}</small>
              <span>{status(job)}</span>
            </div>
            <div className="button-row">
              {job.status === "done" && (
                <button
                  className="button primary"
                  onClick={() => void review(job)}
                >
                  Review
                </button>
              )}
              {job.status === "failed" && (
                <button className="button" onClick={() => void retryJob(job)}>
                  Coba lagi
                </button>
              )}
              {job.status !== "processing" && (
                <button
                  className="button"
                  onClick={() => {
                    if (confirm(`Hapus foto ${job.label} dari antrean?`))
                      void deleteJob(job.id);
                  }}
                >
                  Hapus
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        Analisis berjalan satu per satu selama aplikasi terbuka. Jika aplikasi
        ditutup, antrean dilanjutkan saat dibuka kembali. Hasil baru tersimpan
        ke riwayat setelah direview dan disimpan.
      </p>
    </section>
  );
}
