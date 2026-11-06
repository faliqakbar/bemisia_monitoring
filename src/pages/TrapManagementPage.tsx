import { useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { useApp } from "../state";
import { greenhouseRepository } from "../database/greenhouse";
import { trapRepository } from "../database/traps";
import type { Trap } from "../types";
import { dateInput } from "../utils/date";
import { errorMessage } from "../utils/errors";
import { Link } from "react-router-dom";
import { isDemo } from "../database/supabase";
export function TrapManagementPage() {
  const { greenhouses, traps, refresh, notify } = useApp();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Trap | null>(null),
    [qr, setQr] = useState<{ url: string; payload: string } | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      notify("Perubahan tersimpan.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function addGreenhouse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    void run(async () => {
      await greenhouseRepository.save({
        id: crypto.randomUUID(),
        code: String(data.get("code")).trim().toUpperCase(),
        name: String(data.get("name")).trim(),
        location: String(data.get("location")).trim() || null,
        active: true,
        created_at: new Date().toISOString(),
      });
      form.reset();
    });
  }
  function saveTrap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form),
      gid = String(data.get("greenhouse")),
      code = String(data.get("code")).trim().toUpperCase(),
      gh = greenhouses.find((g) => g.id === gid);
    if (!gh) return;
    void run(async () => {
      await trapRepository.save({
        id: editing?.id ?? crypto.randomUUID(),
        greenhouse_id: gid,
        trap_code: code,
        qr_code: `BEMISIA|${gh.code}|${code}`,
        location_description: String(data.get("location")).trim() || null,
        installation_date: String(data.get("installed")) || null,
        active: editing?.active ?? true,
        created_at: editing?.created_at ?? new Date().toISOString(),
      });
      setEditing(null);
      form.reset();
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MASTER DATA</div>
          <h1>Greenhouse & yellow trap</h1>
          <p>Kelola lokasi, tanggal pemasangan, dan identitas QR.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <form className="panel" onSubmit={addGreenhouse}>
          <h2>Tambah greenhouse</h2>
          <label>
            Kode
            <input
              name="code"
              placeholder="GH12"
              required
              pattern="[A-Za-z0-9_-]+"
              maxLength={30}
            />
          </label>
          <label>
            Nama
            <input
              name="name"
              required
              placeholder="Greenhouse Utara"
              maxLength={100}
            />
          </label>
          <label>
            Lokasi
            <input
              name="location"
              placeholder="Kebun penelitian"
              maxLength={200}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Tambah Greenhouse
          </button>
        </form>
        <form key={editing?.id ?? "new"} className="panel" onSubmit={saveTrap}>
          <h2>{editing ? "Edit trap" : "Tambah trap"}</h2>
          <label>
            Greenhouse
            <select
              name="greenhouse"
              required
              defaultValue={editing?.greenhouse_id}
            >
              <option value="">Pilih greenhouse</option>
              {greenhouses
                .filter((g) => g.active)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Kode trap
            <input
              name="code"
              required
              pattern="[A-Za-z0-9_-]+"
              maxLength={30}
              defaultValue={editing?.trap_code}
              placeholder="T01"
            />
          </label>
          <label>
            Posisi
            <input
              name="location"
              defaultValue={editing?.location_description ?? ""}
              placeholder="Baris 1, dekat pintu"
              maxLength={200}
            />
          </label>
          <label>
            Tanggal pemasangan / penggantian
            <input
              name="installed"
              type="date"
              max={dateInput()}
              defaultValue={editing?.installation_date ?? dateInput()}
            />
          </label>
          <div className="button-row">
            <button className="button primary" disabled={busy}>
              {editing ? "Simpan Perubahan" : "Tambah Trap"}
            </button>
            {editing && (
              <button
                type="button"
                className="button"
                onClick={() => setEditing(null)}
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          {!isDemo && (
            <div>
              <Link className="text-link" to="/settings">
                Buka Settings / Login
              </Link>
            </div>
          )}
        </div>
      )}
      <section className="panel">
        <h2>Daftar yellow trap</h2>
        {traps.map((t) => (
          <div className="management-row" key={t.id}>
            <div>
              <h3>
                {greenhouses.find((g) => g.id === t.greenhouse_id)?.code} /{" "}
                {t.trap_code}
              </h3>
              <small>
                {t.location_description} · {t.active ? "Aktif" : "Nonaktif"}
              </small>
            </div>
            <div className="button-row">
              <button className="button" onClick={() => setEditing(t)}>
                Edit
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    trapRepository.save({ ...t, active: !t.active }),
                  )
                }
              >
                {t.active ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button
                className="button"
                onClick={() => {
                  void QRCode.toDataURL(t.qr_code, {
                    width: 600,
                    margin: 3,
                    errorCorrectionLevel: "M",
                  })
                    .then((url) => setQr({ url, payload: t.qr_code }))
                    .catch(() => setError("QR gagal dibuat."));
                }}
              >
                Generate QR
              </button>
            </div>
          </div>
        ))}
      </section>
      {qr && (
        <div className="modal-backdrop">
          <section className="panel modal">
            <div className="section-head">
              <h2>QR yellow trap</h2>
              <button className="button" onClick={() => setQr(null)}>
                Tutup
              </button>
            </div>
            <img className="qr-image" src={qr.url} alt={`QR ${qr.payload}`} />
            <p>{qr.payload}</p>
            <a
              className="button primary"
              href={qr.url}
              download={`${qr.payload.replaceAll("|", "-")}.png`}
            >
              Download PNG
            </a>
          </section>
        </div>
      )}
    </>
  );
}
