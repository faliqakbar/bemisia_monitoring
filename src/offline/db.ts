import { openDB, type DBSchema } from "idb";
import type {
  AnalysisJob,
  Greenhouse,
  Trap,
  MonitoringSession,
} from "../types";
interface Database extends DBSchema {
  greenhouse: { key: string; value: Greenhouse };
  traps: { key: string; value: Trap };
  sessions: { key: string; value: MonitoringSession };
  images: { key: string; value: Blob };
  meta: { key: string; value: unknown };
  queue: {
    key: string;
    value: {
      id: string;
      owner_id: string | null;
      attempts: number;
      last_error?: string;
    };
  };
  jobs: { key: string; value: AnalysisJob };
  job_images: { key: string; value: Blob };
}
// Isolate local demo records from each Supabase project's cache and pending queue.
export const dbName = (() => {
  try {
    if (!import.meta.env.VITE_SUPABASE_ANON_KEY) return "bemisia-demo-v1";
    return `bemisia-cloud-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname}`;
  } catch {
    return "bemisia-demo-v1";
  }
})();
export const getDb = () =>
  openDB<Database>(dbName, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("greenhouse", { keyPath: "id" });
        db.createObjectStore("traps", { keyPath: "id" });
        db.createObjectStore("sessions", { keyPath: "id" });
        db.createObjectStore("images");
        db.createObjectStore("meta");
        db.createObjectStore("queue", { keyPath: "id" });
      }
      // v2: background analysis queue.
      if (oldVersion < 2) {
        db.createObjectStore("jobs", { keyPath: "id" });
        db.createObjectStore("job_images");
      }
    },
  });
