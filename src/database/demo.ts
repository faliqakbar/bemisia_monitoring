import { getDb } from "../offline/db";
import { isDemo } from "./supabase";
import { calculateTrend } from "../utils/trend";
import { dateInput } from "../utils/date";
import type { MonitoringSession } from "../types";
export async function seedDemo() {
  if (!isDemo) return;
  const db = await getDb();
  if (await db.get("meta", "seeded")) return;
  const tx = db.transaction(
    ["greenhouse", "traps", "sessions", "meta"],
    "readwrite",
  );
  const now = new Date();
  for (const [g, code] of ["GH12", "GH15", "GH19"].entries()) {
    const gid = `00000000-0000-4000-8000-00000000000${g + 1}`;
    await tx
      .objectStore("greenhouse")
      .put({
        id: gid,
        code,
        name: ["Greenhouse Utara", "Greenhouse Timur", "Greenhouse Selatan"][g],
        location: "Kebun penelitian",
        active: true,
        created_at: now.toISOString(),
      });
    for (let t = 1; t <= [3, 2, 1][g]; t++) {
      const id = `00000000-0000-4000-8000-0000000000${g + 1}${t}`,
        trap_code = `T0${t}`;
      const installed = new Date(now);
      installed.setDate(installed.getDate() - 7);
      await tx
        .objectStore("traps")
        .put({
          id,
          greenhouse_id: gid,
          trap_code,
          qr_code: `BEMISIA|${code}|${trap_code}`,
          location_description: `Baris ${t} · Zona ${g + 1}`,
          installation_date: dateInput(installed),
          active: true,
          created_at: now.toISOString(),
        });
      let previous: MonitoringSession | undefined;
      for (let week = 3; week >= 0; week--) {
        const date = new Date(now);
        date.setDate(date.getDate() - week * 7);
        date.setHours(8 + t, 15, 0, 0);
        const count =
          g === 0 && t === 3
            ? [190, 240, 280, 448][3 - week]
            : g === 2
              ? [140, 160, 180, 239][3 - week]
              : 80 + g * 25 + t * 16 + (3 - week) * 9;
        const session: MonitoringSession = {
          id: `demo-${g}-${t}-${week}`,
          trap_id: id,
          captured_at: date.toISOString(),
          trap_installed_at: new Date(
            date.getTime() - 7 * 86400000,
          ).toISOString(),
          exposure_days: 7,
          bemisia_count: count,
          ...calculateTrend(count, 7, previous),
          image_quality_score: 92,
          image_quality_status: "GOOD",
          mean_confidence: 0.78,
          min_confidence: 0.26,
          max_confidence: 0.94,
          model_version: "mock-v1",
          original_image_url: null,
          detection_image_url: null,
          notes: "Data contoh — bukan pengamatan lapangan.",
          feedback_status: "unreviewed",
          image_width: 3024,
          image_height: 4032,
          tile_count: 221,
          inference_time_ms: 1200,
          total_processing_time_ms: 1500,
          created_at: date.toISOString(),
          sync_status: "local",
          detections: [],
        };
        await tx.objectStore("sessions").put(session);
        previous = session;
      }
    }
  }
  await tx.objectStore("meta").put(true, "seeded");
  await tx.done;
}
