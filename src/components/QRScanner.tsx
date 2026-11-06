import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
export function QRScanner({
  onRead,
  onClose,
}: {
  onRead: (text: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onRead);
  callback.current = onRead;
  const [error, setError] = useState(""),
    [text, setText] = useState("");
  useEffect(() => {
    let controls: IScannerControls | undefined,
      disposed = false;
    const reader = new BrowserQRCodeReader();
    if (video.current)
      void reader
        .decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          video.current,
          (result) => {
            if (result && !disposed) callback.current(result.getText());
          },
        )
        .then((c) => {
          if (disposed) c.stop();
          else controls = c;
        })
        .catch(() => {
          if (!disposed)
            setError(
              "Kamera tidak tersedia atau izin ditolak. Masukkan kode QR di bawah.",
            );
        });
    return () => {
      disposed = true;
      controls?.stop();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="panel modal"
        role="dialog"
        aria-modal="true"
        aria-label="Scan QR trap"
      >
        <div className="section-head">
          <h2>Scan QR trap</h2>
          <button className="button" onClick={onClose}>
            Tutup
          </button>
        </div>
        <video ref={video} className="qr-video" muted playsInline />
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRead(text);
          }}
        >
          <label>
            Kode QR
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="BEMISIA|GH12|T03"
              required
            />
          </label>
          <button className="button primary">Pilih Trap</button>
        </form>
      </section>
    </div>
  );
}
