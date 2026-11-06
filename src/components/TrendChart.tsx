import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import type { MonitoringSession } from "../types";
import { chartSeries } from "../utils/trend";
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
);
export function TrendChart({ sessions }: { sessions: MonitoringSession[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const sorted = chartSeries(sessions).points;
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels: sorted.map((s) =>
          new Date(s.captured_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          }),
        ),
        datasets: [
          {
            label: "Bemisia / hari",
            data: sorted.map((s) => s.bemisia_per_day),
            borderColor: "#3e775d",
            backgroundColor: "rgba(90,140,98,.09)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            borderWidth: 2,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#edf0ea" },
            ticks: { color: "#7c867e" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#7c867e", maxTicksLimit: 6 },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [sessions]);
  const { version, hidden } = chartSeries(sessions);
  return (
    <>
      <div className="chart-wrap">
        <canvas
          ref={ref}
          role="img"
          aria-label="Grafik tren Bemisia per hari"
        />
      </div>
      {hidden > 0 && (
        <p className="muted small">
          Hanya model {version === "mock-v1" ? "Simulation" : version}; {hidden}{" "}
          pengamatan versi model lain tidak ditampilkan karena tidak sebanding.
        </p>
      )}
    </>
  );
}
