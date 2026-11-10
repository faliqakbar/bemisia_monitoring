import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../state";
import { DetectionCanvas } from "../components/DetectionCanvas";
import { DetectionSummary } from "../components/DetectionSummary";
import { ImageQualityCard } from "../components/ImageQualityCard";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { calculateTrend, findBaseline, trendStatus } from "../utils/trend";
import { formatDate } from "../utils/date";
import { compressedImage } from "../utils/image";
import { monitoringRepository } from "../database/monitoring";
import { isDemo } from "../database/supabase";
import { datasetAvailable, sendToDataset } from "../ai/datasetUpload";
import type { MonitoringSession } from "../types";
export function DetectionResultPage() {
  const {
    draft,
    setDraft,
    sessions,
    greenhouses,
    settings,
    refresh,
    notify,
    deleteJob,
  } = useApp();
  const [days, setDays] = useState(() => {
      if (!draft?.trap.installation_date) return "";
      return String(
        Math.max(
          0,
          (new Date(draft.capturedAt).getTime() -
            new Date(`${draft.trap.installation_date}T00:00:00`).getTime()) /
            86400000,
        ).toFixed(2),
      );
    }),
    [notes, setNotes] = useState(""),
    [feedback, setFeedback] =
      useState<MonitoringSession["feedback_status"]>("unreviewed"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(false),
    [toDataset, setToDataset] = useState(false),
    [canDataset, setCanDataset] = useState(false),
    [savingMessage, setSavingMessage] = useState("Saving result...");
  const id = useRef(crypto.randomUUID()),
    savingRef = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    void datasetAvailable().then(setCanDataset);
  }, []);
  if (!draft)
    return (
      <section className="panel">
        <h1>Belum ada hasil</h1>
        <Link className="button primary" to="/monitoring">
          Mulai Monitoring
        </Link>
      </section>
    );
  const previous = sessions.find(
    (s) => s.trap_id === draft.trap.id && s.captured_at < draft.capturedAt,
  );
  const baseline = findBaseline(
    sessions,
    draft.trap.id,
    draft.capturedAt,
    draft.result.modelVersion,
  );
  const exposure = days === "" ? null : Number(days),
    trend = calculateTrend(
      draft.result.count,
      exposure,
      baseline,
      draft.result.modelVersion,
    ),
    status = trendStatus(trend.rate_change_percent, settings),
    gh = greenhouses.find((g) => g.id === draft.trap.greenhouse_id);
  async function save() {
    if (!draft || savingRef.current) return;
    if (exposure !== null && (!Number.isFinite(exposure) || exposure <= 0)) {
      setError(
        "Durasi pemasangan harus lebih dari 0 hari, atau kosongkan bila tidak diketahui.",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const confidences = draft.result.detections.map((d) => d.confidence);
      const session: MonitoringSession = {
        id: id.current,
        trap_id: draft.trap.id,
        captured_at: draft.capturedAt,
        trap_installed_at:
          exposure === null
            ? null
            : new Date(
                new Date(draft.capturedAt).getTime() - exposure * 86400000,
              ).toISOString(),
        exposure_days: exposure,
        bemisia_count: draft.result.count,
        ...trend,
        image_quality_score: draft.quality.qualityScore,
        image_quality_status: draft.quality.status,
        mean_confidence: draft.result.meanConfidence,
        min_confidence: confidences.length ? Math.min(...confidences) : 0,
        max_confidence: confidences.length ? Math.max(...confidences) : 0,
        model_version: draft.result.modelVersion,
        original_image_url: null,
        detection_image_url: null,
        notes,
        feedback_status: feedback,
        image_width: draft.image.width,
        image_height: draft.image.height,
        tile_count: draft.result.tileCount,
        inference_time_ms: draft.result.inferenceTimeMs,
        total_processing_time_ms: draft.totalMs,
        created_at: new Date().toISOString(),
        sync_status: isDemo ? "local" : "pending",
        detections: draft.result.detections,
      };
      await monitoringRepository.save(
        session,
        await compressedImage(draft.image),
      );
      // Saved: the queued copy is no longer needed.
      if (draft.jobId) await deleteJob(draft.jobId);
      await refresh();
      // The monitoring record is safe locally; a dataset failure only adds a note.
      let datasetNote = "";
      if (toDataset && canDataset) {
        setSavingMessage("Mengirim foto ke dataset...");
        try {
          await sendToDataset({
            draft,
            sessionId: session.id,
            label: (gh?.code ?? "GH") + " / " + draft.trap.trap_code,
            exposureDays: exposure,
            feedback,
            notes,
          });
          datasetNote = " Foto masuk dataset.";
        } catch (e) {
          datasetNote =
            " Gagal masuk dataset: " +
            (e instanceof Error ? e.message : "coba lagi nanti") +
            ".";
        }
      }
      notify(
        (isDemo
          ? "Monitoring tersimpan di perangkat ini."
          : "Monitoring tersimpan di perangkat — PENDING SYNC.") + datasetNote,
      );
      setDraft(null);
      navigate(`/history/${session.trap_id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Penyimpanan gagal. Foto dan hasil tetap tersedia, coba lagi.",
      );
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {gh?.code} / YELLOW TRAP {draft.trap.trap_code}
          </div>
          <h1>Hasil pengamatan</h1>
          <p>Periksa hasil sebelum menyimpan monitoring.</p>
        </div>
        <span className="badge demo">
          {draft.result.modelVersion === "mock-v1"
            ? "SIMULATION MODE"
            : "ONNX · EXPERIMENTAL"}
        </span>
      </div>
      {draft.result.modelVersion === "mock-v1" && (
        <div className="simulation-notice">
          {draft.result.warning ||
            "Bounding box dan jumlah adalah simulasi, bukan deteksi Bemisia nyata."}
        </div>
      )}
      <div className="capture-layout">
        <div>
          {previous && previous.model_version !== draft.result.modelVersion && (
            <div className="simulation-notice">
              Versi model berbeda dari pengamatan sebelumnya.{" "}
              {baseline
                ? `Hasil ini dibandingkan dengan pengamatan versi model yang sama pada ${formatDate(baseline.captured_at)}.`
                : "Hasil ini menjadi data awal untuk perbandingan berikutnya dengan versi model yang sama."}
            </div>
          )}
          <DetectionSummary
            result={draft.result}
            trend={trend}
            status={status}
          />
          <section className="panel">
            <label>
              Lama trap terpasang (hari)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="Kosongkan jika tidak diketahui"
              />
            </label>
            <p className="muted small">
              Periksa durasi yang benar sejak trap dipasang atau diganti. Status
              memakai perubahan Bemisia/hari. Nilai sebelumnya nol atau durasi
              tidak diketahui tidak diberi persentase.
            </p>
            <label>
              Catatan
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kondisi trap, tanaman, atau hal yang perlu ditinjau..."
              />
            </label>
            <h3>Apakah hasil deteksi terlihat benar?</h3>
            <div className="button-row">
              <button
                className={`button ${feedback === "correct" ? "selected" : ""}`}
                aria-pressed={feedback === "correct"}
                onClick={() => setFeedback("correct")}
              >
                ✓ Sesuai
              </button>
              <button
                className={`button ${feedback === "needs_review" ? "selected" : ""}`}
                aria-pressed={feedback === "needs_review"}
                onClick={() => {
                  setFeedback("needs_review");
                  // Photos the model got wrong are the most useful for retraining.
                  setToDataset(true);
                }}
              >
                ⚠ Perlu Koreksi
              </button>
            </div>
            {canDataset && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={toDataset}
                  onChange={(e) => setToDataset(e.target.checked)}
                />
                Masukkan ke dataset (foto asli + box AI) untuk dikoreksi dan
                melatih ulang model
              </label>
            )}
          </section>
        </div>
        <div>
          <ImageQualityCard quality={draft.quality} />
          <button className="button full" onClick={() => setReview(!review)}>
            {review ? "Tutup" : "Review Detection"}
          </button>
        </div>
      </div>
      {review && (
        <DetectionCanvas
          image={draft.image}
          detections={draft.result.detections}
        />
      )}
      <div className="button-row">
        <button
          className="button primary"
          disabled={saving}
          onClick={() => void save()}
        >
          Save Monitoring
        </button>
        <Link className="button" to={`/capture/${draft.trap.id}`}>
          Ambil ulang
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saving && <LoadingOverlay message={savingMessage} />}
    </>
  );
}
