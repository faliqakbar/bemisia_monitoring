import type { DetectorResult } from "../ai/types";
import type { calculateTrend } from "../utils/trend";
import { number, percent } from "../utils/format";
import { StatusBadge } from "./StatusBadge";
export function DetectionSummary({
  result,
  trend,
  status,
}: {
  result: DetectorResult;
  trend: ReturnType<typeof calculateTrend>;
  status: string;
}) {
  return (
    <section className="panel result-summary">
      <span className="eyebrow">BEMISIA TERDETEKSI</span>
      <div className="result-count">{number(result.count)}</div>
      <StatusBadge status={status} />
      <div className="metric-grid">
        <div>
          <small>Sebelumnya</small>
          <strong>{number(trend.previous_count)}</strong>
        </div>
        <div>
          <small>Selisih count</small>
          <strong>{number(trend.count_difference)}</strong>
        </div>
        <div>
          <small>Bemisia / hari</small>
          <strong>{number(trend.bemisia_per_day, 1)}</strong>
        </div>
        <div>
          <small>Perubahan rate</small>
          <strong>{percent(trend.rate_change_percent)}</strong>
        </div>
      </div>
      <p>
        Confidence rata-rata {number(result.meanConfidence * 100, 1)}% ·{" "}
        {number(result.inferenceTimeMs / 1000, 2)} detik
      </p>
      <small>
        Model: {result.modelVersion} · {result.tileCount} tiles
      </small>
    </section>
  );
}
