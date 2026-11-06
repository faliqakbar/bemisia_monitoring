import type { QualityResult } from "../imageQuality/qualityEvaluator";
import { StatusBadge } from "./StatusBadge";
export function ImageQualityCard({ quality: q }: { quality: QualityResult }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Kualitas foto</h2>
        <StatusBadge status={q.status} />
      </div>
      <div className="metric-grid">
        <div>
          <small>Ketajaman</small>
          <strong>{q.sharpnessScore.toFixed(0)}</strong>
        </div>
        <div>
          <small>Luminansi</small>
          <strong>{q.brightness.toFixed(0)} / 255</strong>
        </div>
        <div>
          <small>Highlight</small>
          <strong>{q.glarePercent.toFixed(1)}%</strong>
        </div>
        <div>
          <small>Resolusi</small>
          <strong>
            {q.width} × {q.height}
          </strong>
        </div>
      </div>
      <p>
        Skor kualitas <strong>{q.qualityScore}/100</strong>
      </p>
      {q.messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
      <small>
        Cakupan trap & sudut kamera: UNKNOWN — periksa secara manual.
      </small>
    </section>
  );
}
