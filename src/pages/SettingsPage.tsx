import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import { DEFAULT_SETTINGS, type Settings } from "../types";
import { currentUser, isDemo, signIn, signOut } from "../database/supabase";
import { loadModelInfo, type InstalledModel } from "../ai/modelInfo";
export function SettingsPage() {
  const { settings, saveSettings, sessions, sync, refresh } = useApp();
  const [value, setValue] = useState<Settings>(settings),
    [error, setError] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false);
  const [installedModel, setInstalledModel] = useState<InstalledModel | null>(
    null,
  );
  useEffect(() => {
    void currentUser().then((u) => setEmail(u?.email ?? ""));
    void loadModelInfo()
      .then(setInstalledModel)
      .catch(() => setInstalledModel(null));
  }, []);
  const fields: {
    key: keyof Settings;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    {
      key: "confidence",
      label: "Confidence threshold",
      min: 0.01,
      max: 0.95,
      step: 0.01,
    },
    { key: "nmsIou", label: "NMS IoU", min: 0.01, max: 0.95, step: 0.01 },
    { key: "tileSize", label: "Tile size (px)", min: 64, max: 1024, step: 1 },
    {
      key: "overlap",
      label: "Tile overlap (0.25 = 25%)",
      min: 0,
      max: 0.75,
      step: 0.01,
    },
    {
      key: "watchThreshold",
      label: "Watch mulai (%)",
      min: 0,
      max: 1000,
      step: 1,
    },
    {
      key: "highThreshold",
      label: "High di atas (%)",
      min: 1,
      max: 2000,
      step: 1,
    },
    {
      key: "minResolution",
      label: "Resolusi minimum setiap sisi (px)",
      min: 320,
      max: 4000,
      step: 1,
    },
    {
      key: "blurRetake",
      label: "Sharpness: retake di bawah",
      min: 0,
      max: 1000,
      step: 1,
    },
    {
      key: "blurWarning",
      label: "Sharpness: warning di bawah",
      min: 1,
      max: 2000,
      step: 1,
    },
  ];
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      value.highThreshold <= value.watchThreshold ||
      value.blurWarning <= value.blurRetake
    ) {
      setError(
        "Ambang High harus di atas Watch; blur Warning harus di atas Retake.",
      );
      return;
    }
    try {
      await saveSettings(value);
    } catch {
      setError("Pengaturan gagal disimpan.");
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
      setEmail((await currentUser())?.email ?? "");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREFERENSI APLIKASI</div>
          <h1>Settings</h1>
          <p>Konfigurasi deteksi, kualitas foto, dan penyimpanan.</p>
        </div>
        <Link className="button" to="/traps">
          Kelola Trap
        </Link>
      </div>
      <div className="dashboard-grid">
        <form className="panel" onSubmit={(e) => void save(e)}>
          <h2>Detection settings</h2>
          {installedModel && (
            <div className="simulation-notice">
              <strong>Model tersedia: {installedModel.version}</strong>
              <p>
                {installedModel.trial
                  ? "Model percobaan dari best.pt lama; akurasi lapangan belum divalidasi."
                  : "Model ONNX tersedia untuk analisis di perangkat."}
              </p>
              <p>
                Centang “Gunakan model ONNX jika tersedia”, lalu Simpan
                Pengaturan untuk memakai model ini.
              </p>
            </div>
          )}
          <div className="form-grid">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  required
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={String(value[f.key])}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={value.preferOnnx}
              onChange={(e) =>
                setValue({ ...value, preferOnnx: e.target.checked })
              }
            />
            Gunakan model ONNX jika tersedia
          </label>
          <p className="footnote">
            Threshold epidemiological/action level belum divalidasi dan hanya
            untuk prototype. Nilai kualitas foto perlu dikalibrasi pada
            perangkat lapangan.
          </p>
          <div className="button-row">
            <button className="button primary">Simpan Pengaturan</button>
            <button
              type="button"
              className="button"
              onClick={() => setValue({ ...DEFAULT_SETTINGS })}
            >
              Reset to Default
            </button>
          </div>
        </form>
        <div>
          <section className="panel">
            <h2>Penyimpanan & sinkronisasi</h2>
            <span className="badge demo">
              {isDemo ? "DEMO MODE" : "SUPABASE"}
            </span>
            <p>
              {isDemo
                ? "Data demo dan monitoring tersimpan lokal di browser ini. Data demo tidak dikirim ke cloud."
                : "Monitoring disimpan dahulu di perangkat, lalu dikirim ke Supabase saat Sync Data ditekan atau koneksi kembali."}
            </p>
            <p>
              <strong>
                {sessions.filter((s) => s.sync_status === "pending").length}
              </strong>{" "}
              data menunggu sinkronisasi
            </p>
            <button
              className="button primary"
              disabled={isDemo || busy}
              onClick={() => {
                setBusy(true);
                void sync().finally(() => setBusy(false));
              }}
            >
              Sync Data
            </button>
            <p className="small muted">
              Data lokal dapat hilang jika data situs dihapus. Ekspor cadangan
              untuk menyimpan catatan monitoring.
            </p>
            <button
              className="button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(sessions, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "bemisia-monitoring-backup.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Ekspor Catatan JSON
            </button>
          </section>
          <section className="panel">
            <h2>Akun Supabase</h2>
            {isDemo ? (
              <p>
                Konfigurasi environment untuk mengaktifkan cloud. Demo dapat
                digunakan tanpa login.
              </p>
            ) : email ? (
              <>
                <p>Masuk sebagai {email}</p>
                <button
                  className="button"
                  onClick={() => {
                    void signOut().then(async () => {
                      setEmail("");
                      await refresh();
                    });
                  }}
                >
                  Keluar
                </button>
              </>
            ) : (
              <form onSubmit={(e) => void login(e)}>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Masuk
                </button>
                <p className="small muted">
                  Gunakan akun yang disiapkan administrator proyek Supabase.
                </p>
              </form>
            )}
          </section>
          <section className="panel">
            <h2>Tentang prototype</h2>
            <p>Bemisia Monitoring v0.1</p>
            <p>
              Mock Detector menghasilkan simulasi. ONNX berjalan di browser
              tanpa GPU server. Pipeline: tile → inference → remap → global NMS.
            </p>
          </section>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
