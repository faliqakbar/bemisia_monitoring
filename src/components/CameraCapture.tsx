import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
export function CameraCapture({
  onFile,
  onCapture,
}: {
  onFile: (file: File) => void;
  onCapture: (canvas: HTMLCanvasElement) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    native = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false),
    [error, setError] = useState("");
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
  };
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  useEffect(() => {
    if (active && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current
        .play()
        .catch(() =>
          setError("Kamera belum siap. Gunakan kamera perangkat atau galeri."),
        );
    }
  }, [active]);
  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        native.current?.click();
        return;
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 3024 },
          height: { ideal: 4032 },
        },
        audio: false,
      });
      setError("");
      setActive(true);
    } catch {
      setError(
        "Akses kamera ditolak atau tidak tersedia. Gunakan kamera perangkat atau upload dari galeri.",
      );
    }
  }
  function capture() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stop();
    onCapture(c);
  }
  return (
    <>
      <div className={`camera-frame ${active ? "camera-active" : ""}`}>
        {active ? (
          <>
            <video ref={video} playsInline muted />
            <div className="camera-guide" />
            <button
              className="camera-close icon-button"
              onClick={stop}
              aria-label="Tutup kamera"
            >
              <X />
            </button>
          </>
        ) : (
          <div>
            <Camera size={42} />
            <h2>Siapkan yellow trap</h2>
            <p>
              Posisikan seluruh yellow trap
              <br />
              di dalam bingkai
            </p>
          </div>
        )}
        <span className="camera-caption">Kamera 1× · tanpa digital zoom</span>
      </div>
      <p className="muted">
        Hindari pantulan cahaya. Pastikan foto tidak blur dan seluruh trap
        terlihat.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          className="button primary"
          onClick={active ? capture : () => void start()}
        >
          <Camera size={18} />
          {active ? "Ambil Foto" : "Buka Kamera"}
        </button>
        <button className="button" onClick={() => input.current?.click()}>
          <ImagePlus size={18} />
          Upload dari Galeri
        </button>
      </div>
      <button className="text-button" onClick={() => native.current?.click()}>
        Gunakan kamera perangkat
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={native}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
