import { openDB, type DBSchema } from "idb";
import type { Greenhouse, Trap, MonitoringSession } from "../types";
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
  openDB<Database>(dbName, 1, {
    upgrade(db) {
      db.createObjectStore("greenhouse", { keyPath: "id" });
      db.createObjectStore("traps", { keyPath: "id" });
      db.createObjectStore("sessions", { keyPath: "id" });
      db.createObjectStore("images");
      db.createObjectStore("meta");
      db.createObjectStore("queue", { keyPath: "id" });
    },
  });
