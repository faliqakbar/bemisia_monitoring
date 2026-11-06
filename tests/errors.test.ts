import { describe, it, expect, vi } from "vitest";
import { errorMessage } from "../src/utils/errors";
const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

describe("cloud save error messages", () => {
  it("explains a plain PostgREST RLS error instead of hiding it", () => {
    expect(
      errorMessage({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toContain("Akses database ditolak");
  });
  it("distinguishes missing migration and duplicate codes", () => {
    expect(
      errorMessage({ code: "PGRST205", message: "table missing" }),
    ).toContain("001_initial_schema.sql");
    expect(errorMessage({ code: "23505", message: "duplicate" })).toContain(
      "Kode sudah digunakan",
    );
  });
  it("preserves useful errors returned as plain objects", () => {
    expect(
      errorMessage({ code: "PGRST204", message: "Column not found" }),
    ).toBe("Column not found (PGRST204)");
    expect(errorMessage(new Error("Masuk dahulu"))).toBe("Masuk dahulu");
    expect(errorMessage(null)).toBe("Perubahan gagal disimpan.");
  });
  it("explains network and expired session errors", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toContain(
      "koneksi internet",
    );
    expect(
      errorMessage({ code: "PGRST301", message: "JWT expired" }),
    ).toContain("Sesi login berakhir");
  });
  it("blocks a cloud write before a request when no user is logged in", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "sb_publishable_test");
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    try {
      const { requireCloudUser } = await import("../src/database/supabase");
      await expect(requireCloudUser()).rejects.toThrow("Anda belum login");
      mocks.getSession.mockResolvedValue({
        data: { session: { user: { id: "staff" } } },
      });
      await expect(requireCloudUser()).resolves.toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
