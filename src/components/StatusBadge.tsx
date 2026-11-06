export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    HIGH: "High increase",
    WATCH: "Watch",
    NORMAL: "Normal",
    UNKNOWN: "Belum sebanding",
    GOOD: "Good",
    WARNING: "Warning",
    RETAKE: "Foto ulang",
    pending: "PENDING SYNC",
    local: "LOCAL",
    synced: "SYNCED",
  };
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      {labels[status] ?? status}
    </span>
  );
}
