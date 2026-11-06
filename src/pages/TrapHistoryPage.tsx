import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../state";
import { TrendChart } from "../components/TrendChart";
import { StatusBadge } from "../components/StatusBadge";
import { trendStatus } from "../utils/trend";
import { number, percent } from "../utils/format";
import { formatDate } from "../utils/date";
import { monitoringRepository } from "../database/monitoring";
import type { MonitoringSession } from "../types";
export function TrapHistoryPage() {
  const { trapId } = useParams(),
    { traps, greenhouses, sessions, settings } = useApp();
  const [filter, setFilter] = useState("all"),
    [photo, setPhoto] = useState(""),
    [error, setError] = useState("");
  const selected = trapId || filter,
    trap = traps.find((t) => t.id === selected);
  const records = useMemo(
    () => sessions.filter((s) => selected === "all" || s.trap_id === selected),
    [sessions, selected],
  );
  const name = (id: string) => {
    const t = traps.find((t) => t.id === id);
    return `${greenhouses.find((g) => g.id === t?.greenhouse_id)?.code ?? ""} / ${t?.trap_code ?? ""}`;
  };
  async function view(s: MonitoringSession) {
    setError("");
    try {
      const blob = await monitoringRepository.image(s.id);
      if (!blob) {
        setError(
          "Data demo ini tidak memiliki foto. Foto dari monitoring baru akan tersedia.",
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setPhoto(String(reader.result));
      reader.readAsDataURL(blob);
    } catch {
      setError("Foto belum tersedia offline. Coba lagi saat terhubung.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CATATAN LAPANGAN</div>
          <h1>{trap ? name(trap.id) : "Riwayat monitoring"}</h1>
          <p>Telusuri hasil, durasi pemasangan, dan perubahan populasi.</p>
        </div>
        <Link
          className="button primary"
          to={trap ? `/capture/${trap.id}` : "/monitoring"}
        >
          Monitoring Baru
        </Link>
      </div>
      <section className="panel">
        <label>
          Filter trap
          <select
            value={selected}
            onChange={(e) => {
              setFilter(e.target.value);
              if (trapId)
                location.hash =
                  e.target.value === "all"
                    ? "/history"
                    : `/history/${e.target.value}`;
            }}
          >
            <option value="all">Semua trap</option>
            {traps.map((t) => (
              <option key={t.id} value={t.id}>
                {name(t.id)}
                {!t.active ? " (nonaktif)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selected !== "all" && (
          <>
            <h2>Bemisia per hari</h2>
            <TrendChart sessions={records} />
          </>
        )}
        {selected === "all" && (
          <p className="muted">
            Pilih satu trap untuk melihat grafik dengan periode yang sebanding.
          </p>
        )}
      </section>
      <div className="history-list">
        {records.map((s) => (
          <article className="panel history-card" key={s.id}>
            <div className="section-head">
              <div>
                <h3>{name(s.trap_id)}</h3>
                <small>{formatDate(s.captured_at)}</small>
              </div>
              <StatusBadge
                status={trendStatus(s.rate_change_percent, settings)}
              />
            </div>
            <div className="metric-grid">
              <div>
                <small>Bemisia</small>
                <strong>{number(s.bemisia_count)}</strong>
              </div>
              <div>
                <small>Per hari</small>
                <strong>{number(s.bemisia_per_day, 1)}</strong>
              </div>
              <div>
                <small>Durasi</small>
                <strong>{number(s.exposure_days, 2)} hari</strong>
              </div>
              <div>
                <small>Δ rate</small>
                <strong>{percent(s.rate_change_percent)}</strong>
              </div>
            </div>
            <div className="section-head">
              <span className="small">
                {s.model_version === "mock-v1"
                  ? "SIMULATION MODE"
                  : s.model_version}{" "}
                · <StatusBadge status={s.sync_status} />
              </span>
              <button className="text-button" onClick={() => void view(s)}>
                Lihat foto
              </button>
            </div>
            <p className="muted small">
              {s.notes || "Tanpa catatan"}
              {s.feedback_status === "needs_review" ? " · ⚠ Perlu koreksi" : ""}
            </p>
          </article>
        ))}
      </div>
      {!records.length && (
        <section className="panel empty">
          Belum ada monitoring tersimpan.
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {photo && (
        <div className="modal-backdrop">
          <section className="panel modal">
            <div className="section-head">
              <h2>Foto monitoring</h2>
              <button className="button" onClick={() => setPhoto("")}>
                Tutup
              </button>
            </div>
            <img
              src={photo}
              alt="Foto monitoring tersimpan"
              style={{ maxWidth: "100%" }}
            />
            <p className="muted small">
              Salinan foto terkompresi untuk penyimpanan.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
