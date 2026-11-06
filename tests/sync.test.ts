import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  upload: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("../src/database/supabase", () => ({
  isDemo: true,
  currentUser: mocks.currentUser,
  supabase: {
    from: () => ({ upsert: mocks.upsert }),
    storage: { from: () => ({ upload: mocks.upload }) },
  },
}));
import { getDb } from "../src/offline/db";
import { seedDemo } from "../src/database/demo";
import { syncQueue } from "../src/offline/syncQueue";
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "user-a" });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  const db = await getDb();
  await db.clear("queue");
  await seedDemo();
  const sample = (await db.getAll("sessions"))[0];
  await db.put("sessions", {
    ...sample,
    id: "queued-session",
    owner_id: "user-a",
    sync_status: "pending",
    detections: [
      {
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 50,
        confidence: 0.8,
        classId: 0,
        className: "Bemisia",
      },
    ],
  });
  await db.put("queue", {
    id: "queued-session",
    owner_id: "user-a",
    attempts: 0,
  });
  await db.put(
    "images",
    new Blob(["photo"], { type: "image/webp" }),
    "queued-session",
  );
});
describe("offline queue", () => {
  it("retains result and image after cloud failure and retries the same ID", async () => {
    mocks.upsert.mockResolvedValueOnce({
      error: new Error("Network unavailable"),
    });
    expect(await syncQueue()).toEqual({ synced: 0, failed: 1 });
    const db = await getDb();
    expect((await db.get("queue", "queued-session"))?.attempts).toBe(1);
    expect(await db.get("images", "queued-session")).toBeDefined();
    expect((await db.get("sessions", "queued-session"))?.sync_status).toBe(
      "pending",
    );
    expect(await syncQueue()).toEqual({ synced: 1, failed: 0 });
    expect(await db.get("queue", "queued-session")).toBeUndefined();
    expect((await db.get("sessions", "queued-session"))?.sync_status).toBe(
      "synced",
    );
    expect(mocks.upsert.mock.calls[0][0].id).toBe("queued-session");
    expect(mocks.upsert.mock.calls[1][0].id).toBe("queued-session");
  });
  it("does not sync another account pending data", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-b" });
    expect(await syncQueue()).toEqual({ synced: 0, failed: 0 });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(await (await getDb()).get("queue", "queued-session")).toBeDefined();
  });
  it("keeps pending when image upload fails before the row is sent", async () => {
    mocks.upload.mockResolvedValue({ error: new Error("Quota exceeded") });
    expect(await syncQueue()).toEqual({ synced: 0, failed: 1 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("requires an authenticated session", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(syncQueue()).rejects.toThrow("Masuk");
  });
  it("writes normalized boxes with stable conflict keys", async () => {
    await syncQueue();
    const [rows, options] = mocks.upsert.mock.calls[1];
    expect(rows[0].x).toBeGreaterThan(0);
    expect(rows[0].width).toBeLessThan(1);
    expect(rows[0].detection_index).toBe(0);
    expect(options).toEqual({
      onConflict: "monitoring_session_id,detection_index",
    });
  });
});
