export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="panel">
        <div className="spinner" />
        <h2>Sedang memproses</h2>
        <p>{message}</p>
        <small>Tetap buka halaman ini sampai proses selesai.</small>
      </div>
    </div>
  );
}
