import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ScanLine, ListPlus } from "lucide-react";
import { useApp } from "../state";
import { CameraCapture } from "../components/CameraCapture";
import { ImageQualityCard } from "../components/ImageQualityCard";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { DetectionCanvas } from "../components/DetectionCanvas";
import { readImage } from "../utils/image";
import {
  evaluateQuality,
  type QualityResult,
} from "../imageQuality/qualityEvaluator";
import { detectImage } from "../ai/detector";
import { formatDate } from "../utils/date";
// A fresh page per trap, so a photo taken for one trap never carries over to another.
export function CapturePage() {
  const { trapId } = useParams();
  return <TrapCapture key={trapId} trapId={trapId} />;
}
function TrapCapture({ trapId }: { trapId?: string }) {
  const {
    traps,
    greenhouses,
    sessions,
    settings,
    setDraft,
    queueAnalysis,
    notify,
  } = useApp();
  const trap = traps.find((t) => t.id === trapId),
    gh = greenhouses.find((g) => g.id === trap?.greenhouse_id),
    last = sessions.find((s) => s.trap_id === trapId);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null),
    [quality, setQuality] = useState<QualityResult | null>(null),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [capturedAt, setCapturedAt] = useState("");
  const navigate = useNavigate();
  function prepare(canvas: HTMLCanvasElement) {
    try {
      setError("");
      setImage(canvas);
      setCapturedAt(new Date().toISOString());
      setQuality(evaluateQuality(canvas, settings));
    } catch {
      setError("Foto tidak dapat diproses. Silakan pilih ulang.");
      setQuality(null);
    }
  }
  async function upload(file: File) {
    setProgress("Preparing image...");
    try {
      prepare(await readImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto gagal dibaca.");
    } finally {
      setProgress("");
    }
  }
  async function analyze() {
    if (!image || !quality || !trap || quality.status === "RETAKE") return;
    const start = performance.now();
    setProgress("Preparing image...");
    try {
      const result = await detectImage(image, settings, setProgress);
      setDraft({
        trap,
        image,
        quality,
        result,
        capturedAt,
        totalMs: performance.now() - start,
      });
      navigate("/result");
    } catch {
      setError("Analisis gagal. Foto tetap tersedia; coba kembali.");
    } finally {
      setProgress("");
    }
  }
  // Queue the photo and go straight back to choose the next trap.
  async function analyzeInBackground() {
    if (!image || !quality || !trap || !gh || quality.status === "RETAKE")
      return;
    setProgress("Menyimpan foto ke antrean...");
    try {
      await queueAnalysis({
        trap,
        label: gh.code + " / " + trap.trap_code,
        image,
        quality,
        capturedAt,
      });
      notify("Foto masuk antrean analisis. Lanjut ke trap berikutnya.");
      navigate("/monitoring");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Foto gagal masuk antrean; coba lagi.",
      );
    } finally {
      setProgress("");
    }
  }
  if (!trap || !trap.active || !gh?.active)
    return (
      <div className="panel">
        <h1>Trap tidak tersedia</h1>
        <Link to="/monitoring">Pilih trap lain</Link>
      </div>
    );
  return (
    <>
      <Link className="text-link" to="/monitoring">
        <ArrowLeft size={17} />
        Pilih trap
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{gh?.code} / MONITORING</div>
          <h1>Yellow Trap {trap.trap_code}</h1>
          <p>
            {last
              ? `Monitoring terakhir: ${last.bemisia_count} Bemisia · ${formatDate(last.captured_at)}`
              : "Belum ada monitoring sebelumnya."}
          </p>
        </div>
      </div>
      <div className="step-bar">
        <span>01 Pilih trap</span>
        <span className="active">02 Ambil foto</span>
        <span>03 Hasil deteksi</span>
      </div>
      <div className="capture-layout">
        <section className="panel">
          {image ? (
            <>
              <DetectionCanvas image={image} detections={[]} />
              <button
                className="button"
                onClick={() => {
                  setImage(null);
                  setQuality(null);
                }}
              >
                Foto ulang
              </button>
            </>
          ) : (
            <CameraCapture
              onFile={(file) => void upload(file)}
              onCapture={prepare}
            />
          )}
        </section>
        <div>
          {quality ? (
            <>
              <ImageQualityCard quality={quality} />
              <button
                className="button primary full"
                disabled={quality.status === "RETAKE" || !!progress}
                onClick={() => void analyzeInBackground()}
              >
                <ListPlus size={18} />
                Analyze di latar &amp; lanjut
              </button>
              <button
                className="button full"
                disabled={quality.status === "RETAKE" || !!progress}
                onClick={() => void analyze()}
              >
                <ScanLine size={18} />
                Analyze &amp; tunggu hasil
              </button>
              <p className="muted small">
                Di latar: foto dianalisis sambil Anda memotret trap lain; hasil
                muncul di Monitoring untuk direview. Biarkan aplikasi tetap
                terbuka.
              </p>
            </>
          ) : (
            <section className="panel guidance">
              <span className="eyebrow">FOTO YANG BAIK, DATA YANG BAIK</span>
              <h2>Empat hal sebelum memotret.</h2>
              <ol>
                <li>Seluruh yellow trap masuk bingkai.</li>
                <li>Gunakan kamera 1× tanpa zoom digital.</li>
                <li>Hindari pantulan lampu atau matahari.</li>
                <li>Pegang HP stabil dan fokuskan kamera.</li>
              </ol>
              <p>
                Foto minimum {settings.minResolution} × {settings.minResolution}{" "}
                px. Gunakan kamera perangkat jika resolusi live camera kurang.
              </p>
            </section>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {progress && <LoadingOverlay message={progress} />}
    </>
  );
}
