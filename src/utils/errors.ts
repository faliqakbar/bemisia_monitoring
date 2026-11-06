// PostgREST returns plain objects, not always Error instances.
export function errorMessage(
  error: unknown,
  fallback = "Perubahan gagal disimpan.",
): string {
  if (!error || typeof error !== "object") return fallback;
  const value = error as { code?: unknown; message?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (code === "42501" || /row-level security|permission denied/i.test(message))
    return "Akses database ditolak. Pastikan sudah login di Settings. Jika sudah, periksa policy RLS dari file 001_initial_schema.sql di Supabase. Jangan menonaktifkan RLS.";
  if (["PGRST205", "42P01"].includes(code))
    return "Tabel aplikasi belum tersedia di proyek Supabase ini. Jalankan file supabase/migrations/001_initial_schema.sql melalui SQL Editor pada proyek yang sesuai.";
  if (code === "23505")
    return "Kode sudah digunakan. Muat ulang daftar dan gunakan kode greenhouse atau trap yang berbeda.";
  if (["PGRST301", "PGRST303"].includes(code) || /jwt expired/i.test(message))
    return "Sesi login berakhir. Buka Settings, keluar lalu masuk kembali.";
  if (
    /failed to fetch|fetch failed|networkerror|network request failed/i.test(
      message,
    )
  )
    return "Tidak dapat menghubungi Supabase. Periksa koneksi internet dan coba kembali. Isian Anda tetap tersedia.";
  if (/invalid api key/i.test(message))
    return "API key Supabase tidak valid. Periksa URL dan publishable key dari proyek yang sama, lalu restart aplikasi.";
  return message ? `${message}${code ? ` (${code})` : ""}` : fallback;
}
