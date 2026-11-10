import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScanLine, Plus, Warehouse } from "lucide-react";
import { useApp } from "../state";
import { TrapCard } from "../components/TrapCard";
import { QRScanner } from "../components/QRScanner";
import { AnalysisQueue } from "../components/AnalysisQueue";
import { isDemo } from "../database/supabase";
export function MonitoringPage() {
  const { greenhouses, traps, sessions } = useApp();
  const [selected, setSelected] = useState(""),
    [scan, setScan] = useState(false),
    [error, setError] = useState("");
  const navigate = useNavigate();
  const active = greenhouses.filter((g) => g.active),
    gid = selected || active[0]?.id;
  function read(text: string) {
    const parts = text.trim().split("|");
    if (parts.length !== 3 || parts[0] !== "BEMISIA") {
      setError("QR tidak valid. Gunakan format BEMISIA|GH12|T03.");
      setScan(false);
      return;
    }
    const gh = active.find((g) => g.code === parts[1]),
      trap = traps.find(
        (t) =>
          t.greenhouse_id === gh?.id && t.trap_code === parts[2] && t.active,
      );
    if (!trap) {
      setError("Trap tidak ditemukan atau sudah nonaktif.");
      setScan(false);
      return;
    }
    setScan(false);
    navigate(`/capture/${trap.id}`);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENGAMATAN BARU</div>
          <h1>Mulai dari greenhouse.</h1>
          <p>Pilih lokasi dan yellow trap yang akan diperiksa.</p>
        </div>
        <Link className="button" to="/traps">
          <Plus size={18} />
          Kelola Trap
        </Link>
      </div>
      <div className="step-bar">
        <span className="active">01 Pilih trap</span>
        <span>02 Ambil foto</span>
        <span>03 Hasil deteksi</span>
      </div>
      <AnalysisQueue />
      <section className="panel">
        <div className="section-head">
          <h2>1. Pilih greenhouse</h2>
          <button
            className="button"
            onClick={() => {
              setScan(true);
              setError("");
            }}
          >
            <ScanLine size={18} />
            Scan QR
          </button>
        </div>
        <div className="greenhouse-options">
          {active.map((g) => (
            <button
              className={`greenhouse-option ${gid === g.id ? "selected" : ""}`}
              key={g.id}
              onClick={() => setSelected(g.id)}
            >
              <Warehouse size={26} />
              <strong>{g.code}</strong>
              <small>{g.name}</small>
            </button>
          ))}
        </div>
        {!active.length && (
          <p>
            {isDemo ? (
              "Belum ada greenhouse. Tambahkan melalui Kelola Trap."
            ) : (
              <>
                Belum ada greenhouse. Belum login? Masuk dulu di{" "}
                <Link to="/settings">Settings</Link>. Sudah login? Tambahkan
                melalui Kelola Trap.
              </>
            )}
          </p>
        )}
      </section>
      <section className="panel">
        <h2>2. Pilih yellow trap</h2>
        <div className="trap-grid">
          {traps
            .filter((t) => t.greenhouse_id === gid && t.active)
            .map((t) => (
              <TrapCard
                key={t.id}
                trap={t}
                last={sessions.find((s) => s.trap_id === t.id)}
              />
            ))}
        </div>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {scan && <QRScanner onRead={read} onClose={() => setScan(false)} />}
    </>
  );
}
