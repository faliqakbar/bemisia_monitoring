import type { MonitoringSession } from "../types";
import { getDb } from "../offline/db";
import { currentUser, supabase } from "./supabase";
export interface MonitoringRepository {
  list(): Promise<MonitoringSession[]>;
  save(session: MonitoringSession, image?: Blob): Promise<void>;
  image(id: string): Promise<Blob | undefined>;
}
export class LocalMonitoringRepository implements MonitoringRepository {
  async list() {
    return (await (await getDb()).getAll("sessions")).sort((a, b) =>
      b.captured_at.localeCompare(a.captured_at),
    );
  }
  async image(id: string) {
    return (await getDb()).get("images", id);
  }
  async save(session: MonitoringSession, image?: Blob) {
    const db = await getDb();
    const tx = db.transaction(["sessions", "images"], "readwrite");
    await tx.objectStore("sessions").put({ ...session, sync_status: "local" });
    if (image) await tx.objectStore("images").put(image, session.id);
    await tx.done;
  }
}
export class SupabaseMonitoringRepository extends LocalMonitoringRepository {
  async list() {
    const user = await currentUser();
    if (!user) return [];
    const db = await getDb();
    try {
      const { data, error } = await supabase!
        .from("monitoring_sessions")
        .select("*");
      if (error) throw error;
      for (const row of data as MonitoringSession[]) {
        const local = await db.get("sessions", row.id);
        if (local?.sync_status !== "pending")
          await db.put("sessions", {
            ...row,
            detections: local?.detections ?? [],
            sync_status: "synced",
          });
      }
    } catch {
      /* Cached records remain available offline. */
    }
    // The whole team sees every record (supabase/migrations/002_team_access.sql).
    return super.list();
  }
  async save(session: MonitoringSession, image?: Blob) {
    const user = await currentUser();
    if (!user)
      throw new Error(
        "Masuk terlebih dahulu agar hasil dapat disimpan ke akun Anda.",
      );
    const db = await getDb();
    const tx = db.transaction(["sessions", "images", "queue"], "readwrite");
    await tx
      .objectStore("sessions")
      .put({ ...session, owner_id: user.id, sync_status: "pending" });
    if (image) await tx.objectStore("images").put(image, session.id);
    await tx
      .objectStore("queue")
      .put({ id: session.id, owner_id: user.id, attempts: 0 });
    await tx.done;
  }
  async image(id: string) {
    const local = await super.image(id);
    if (local) return local;
    const db = await getDb();
    const session = await db.get("sessions", id);
    if (!session?.original_image_url) return;
    const { data, error } = await supabase!.storage
      .from("monitoring")
      .download(session.original_image_url);
    if (error) throw error;
    await db.put("images", data, id);
    return data;
  }
}
export const monitoringRepository = supabase
  ? new SupabaseMonitoringRepository()
  : new LocalMonitoringRepository();
