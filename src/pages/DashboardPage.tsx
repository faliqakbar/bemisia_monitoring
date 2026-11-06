import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  Warehouse,
  Grid2X2,
  ClipboardCheck,
  TrendingUp,
  Sun,
  SlidersHorizontal,
} from "lucide-react";
import { useApp } from "../state";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";
import { trendStatus } from "../utils/trend";
import { number, percent } from "../utils/format";
import { formatDate, dateInput } from "../utils/date";
export function DashboardPage() {
  const { greenhouses, traps, sessions, settings } = useApp();
  const [filter, setFilter] = useState("all");
  const filteredTraps = traps.filter(
    (t) => t.active && (filter === "all" || t.greenhouse_id === filter),
  );
  const records = sessions.filter((s) =>
    filteredTraps.some((t) => t.id === s.trap_id),
  );
  const latest = filteredTraps.flatMap((t) => {
    const s = records.find((r) => r.trap_id === t.id);
    return s ? [s] : [];
  });
  const alerts = latest
    .filter((s) =>
      ["HIGH", "WATCH"].includes(trendStatus(s.rate_change_percent, settings)),
    )
    .sort(
      (a, b) => (b.rate_change_percent ?? 0) - (a.rate_change_percent ?? 0),
    );
  const today = records.filter(
    (s) => dateInput(new Date(s.captured_at)) === dateInput(),
  ).length;
  const chartTrap = alerts[0]?.trap_id ?? filteredTraps[0]?.id;
  const chartSessions = useMemo(
    () => records.filter((s) => s.trap_id === chartTrap),
    [sessions, filter, chartTrap],
  );
  const trapName = (id: string) => {
    const t = traps.find((x) => x.id === id);
    return `${greenhouses.find((g) => g.id === t?.greenhouse_id)?.code ?? ""} / ${t?.trap_code ?? ""}`;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OVERVIEW</div>
          <h1>Dashboard</h1>
          <p>Pantau greenhouse. Kenali perubahan lebih awal.</p>
        </div>
        <div className="date-chip">
          <Sun size={17} />
          {formatDate(new Date().toISOString())}
        </div>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">DARI LAPANGAN, UNTUK TANAMAN</span>
          <h2>
            Tanaman sehat dimulai
            <br />
            dari pengamatan rutin.
          </h2>
          <p>Catat yellow trap hari ini dan ikuti perkembangan Bemisia.</p>
          <Link className="button light" to="/monitoring">
            <ScanLine size={18} />
            Mulai Monitoring
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="greenhouse-art" aria-hidden="true">
          <div className="sun-art" />
          <svg viewBox="0 0 320 220">
            <path
              d="M40 200V94L160 22l120 72v106z"
              fill="#ffffff08"
              stroke="#b1c8a6"
              strokeWidth="2"
            />
            <path
              d="M40 94h240M160 22v178M100 58v142M220 58v142M40 145h240M160 22L100 94M160 22l60 72"
              fill="none"
              stroke="#b1c8a6"
              strokeWidth="1.4"
            />
            <path d="M20 202h280" stroke="#b1c8a6" />
            <g fill="#8ca77f">
              <path d="M73 198v-45q-30-25-24-7 3 21 24 20 30-30 25-34-23 2-25 21" />
              <path d="M244 198v-40q-24-33-28-19 1 21 28 26 26-25 28-38-26 0-28 31" />
            </g>
            <rect
              x="174"
              y="109"
              width="27"
              height="40"
              rx="2"
              fill="#edcc5a"
            />
            <path d="M188 109V95" stroke="#edcc5a" />
            <g fill="#665f2b">
              <circle cx="182" cy="120" r="1.5" />
              <circle cx="193" cy="132" r="1.5" />
              <circle cx="185" cy="140" r="1.5" />
            </g>
          </svg>
        </div>
      </section>
      <div className="section-head filter-head">
        <span className="eyebrow">RINGKASAN LAPANGAN</span>
        <label className="inline-select">
          <SlidersHorizontal size={15} />
          <select
            aria-label="Filter greenhouse"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua greenhouse</option>
            {greenhouses
              .filter((g) => g.active)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Greenhouse aktif",
            value: greenhouses.filter(
              (g) => g.active && (filter === "all" || g.id === filter),
            ).length,
            icon: Warehouse,
            note: "Area pengamatan",
          },
          {
            label: "Trap aktif",
            value: filteredTraps.length,
            icon: Grid2X2,
            note: "Yellow sticky traps",
          },
          {
            label: "Monitoring hari ini",
            value: today,
            icon: ClipboardCheck,
            note: "Pengamatan tercatat",
          },
          {
            label: "Peningkatan tinggi",
            value: alerts.filter(
              (s) => trendStatus(s.rate_change_percent, settings) === "HIGH",
            ).length,
            icon: TrendingUp,
            note: "Perlu ditinjau",
            alert: true,
          },
        ].map(({ label, value, icon: Icon, note, alert }) => (
          <section
            className={`stat-card ${alert ? "stat-alert" : ""}`}
            key={label}
          >
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{number(value)}</strong>
            <small>
              {alert ? (
                <span className="dot amber" />
              ) : (
                <span className="dot" />
              )}
              {note}
            </small>
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-head">
            <h2>
              <span className="dot amber" />
              Perlu perhatian
            </h2>
            <span className="badge">{alerts.length} trap</span>
          </div>
          <p className="muted small">Perubahan berdasarkan Bemisia per hari.</p>
          {alerts.length ? (
            alerts.map((s) => (
              <Link
                className="alert-row"
                key={s.id}
                to={`/history/${s.trap_id}`}
              >
                <div className="trap-mini">▥</div>
                <div>
                  <h3>{trapName(s.trap_id)}</h3>
                  <small>
                    {number(s.bemisia_count)} Bemisia ·{" "}
                    {number(s.bemisia_per_day, 1)}/hari
                  </small>
                  <StatusBadge
                    status={trendStatus(s.rate_change_percent, settings)}
                  />
                </div>
                <strong className="change">
                  {percent(s.rate_change_percent)}
                  <ArrowUpRight size={16} />
                </strong>
              </Link>
            ))
          ) : (
            <div className="empty">
              Tidak ada peningkatan yang perlu ditinjau.
            </div>
          )}
          <p className="footnote">
            Ambang sementara untuk R&D, belum divalidasi.
          </p>
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>Tren pengamatan</h2>
            <span className="badge">12 TERAKHIR</span>
          </div>
          <p className="muted small">
            {chartTrap ? trapName(chartTrap) : "Belum ada trap"}{" "}
            <span className="chart-legend">● Bemisia / hari</span>
          </p>
          {chartSessions.length ? (
            <TrendChart sessions={chartSessions} />
          ) : (
            <div className="empty">Belum ada data tren.</div>
          )}
          <Link
            className="text-link"
            to={chartTrap ? `/history/${chartTrap}` : "/history"}
          >
            Lihat riwayat trap
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="section-head">
          <div>
            <h2>Monitoring terbaru</h2>
            <p className="muted small">
              Catatan pengamatan terakhir dari greenhouse Anda.
            </p>
          </div>
          <Link className="text-link" to="/history">
            Lihat semua
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>GREENHOUSE / TRAP</th>
                <th>TANGGAL</th>
                <th>JUMLAH</th>
                <th>PER HARI</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 5).map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{trapName(s.trap_id)}</strong>
                    <small className="table-sub">
                      {s.model_version === "mock-v1" ? "Simulation" : "ONNX"} ·{" "}
                      {s.sync_status}
                    </small>
                  </td>
                  <td>{formatDate(s.captured_at)}</td>
                  <td>{number(s.bemisia_count)}</td>
                  <td>{number(s.bemisia_per_day, 1)}</td>
                  <td>
                    <StatusBadge
                      status={trendStatus(s.rate_change_percent, settings)}
                    />
                  </td>
                  <td>
                    <Link
                      aria-label={`Riwayat ${trapName(s.trap_id)}`}
                      to={`/history/${s.trap_id}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <div className="empty">
              Mulai monitoring untuk membuat catatan pertama.
            </div>
          )}
        </div>
      </section>
      <div className="page-footer">
        <span>Bemisia Monitoring · Research & Development</span>
        <span>Data berlabel Simulation adalah simulasi, bukan hasil AI nyata</span>
      </div>
    </>
  );
}
