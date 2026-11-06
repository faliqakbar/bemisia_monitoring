import { getDb } from "./db";
import { currentUser, supabase } from "../database/supabase";
let running = false;
export async function syncQueue() {
  if (running) return { synced: 0, failed: 0 };
  if (!supabase) return { synced: 0, failed: 0 };
  const user = await currentUser();
  if (!user) throw new Error("Masuk di Pengaturan untuk sinkronisasi.");
  running = true;
  let synced = 0,
    failed = 0;
  try {
    const db = await getDb();
    for (const item of await db.getAll("queue")) {
      if (item.owner_id !== user.id) continue;
      try {
        const session = await db.get("sessions", item.id);
        if (!session) continue;
        const image = await db.get("images", item.id);
        let path = session.original_image_url;
        if (image) {
          const trap = await db.get("traps", session.trap_id),
            gh = trap
              ? await db.get("greenhouse", trap.greenhouse_id)
              : undefined;
          const extension = image.type === "image/webp" ? "webp" : "png";
          path = `${gh?.code ?? "GH"}/${trap?.trap_code ?? "TRAP"}/${session.id}.${extension}`;
          const { error } = await supabase.storage
            .from("monitoring")
            .upload(path, image, { upsert: true, contentType: image.type });
          if (error) throw error;
        }
        const { sync_status: _sync, detections, ...row } = session;
        const { error } = await supabase
          .from("monitoring_sessions")
          .upsert({ ...row, original_image_url: path });
        if (error) throw error;
        // Deterministic detection indices make retries idempotent after partial network failures.
        if (detections.length) {
          const normalized = detections.map((d, index) => ({
            monitoring_session_id: session.id,
            detection_index: index,
            confidence: d.confidence,
            x: d.x1 / session.image_width,
            y: d.y1 / session.image_height,
            width: (d.x2 - d.x1) / session.image_width,
            height: (d.y2 - d.y1) / session.image_height,
          }));
          const { error: boxError } = await supabase
            .from("detections")
            .upsert(normalized, {
              onConflict: "monitoring_session_id,detection_index",
            });
          if (boxError) throw boxError;
        }
        const tx = db.transaction(["sessions", "queue"], "readwrite");
        await tx
          .objectStore("sessions")
          .put({ ...session, original_image_url: path, sync_status: "synced" });
        await tx.objectStore("queue").delete(item.id);
        await tx.done;
        synced++;
      } catch (error) {
        failed++;
        await db.put("queue", {
          ...item,
          attempts: item.attempts + 1,
          last_error: error instanceof Error ? error.message : "Sync gagal",
        });
      }
    }
    return { synced, failed };
  } finally {
    running = false;
  }
}
