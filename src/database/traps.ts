import type { Trap } from "../types";
import { getDb } from "../offline/db";
import { supabase, requireCloudUser } from "./supabase";
export interface TrapRepository {
  list(): Promise<Trap[]>;
  save(value: Trap): Promise<void>;
}
export class LocalTrapRepository implements TrapRepository {
  async list() {
    return (await getDb()).getAll("traps");
  }
  async save(value: Trap) {
    const db = await getDb();
    if (
      (await db.getAll("traps")).some(
        (x) =>
          x.id !== value.id &&
          (x.qr_code === value.qr_code ||
            (x.greenhouse_id === value.greenhouse_id &&
              x.trap_code === value.trap_code)),
      )
    )
      throw new Error("Kode trap sudah digunakan.");
    await db.put("traps", value);
  }
}
export class SupabaseTrapRepository extends LocalTrapRepository {
  async list() {
    try {
      const { data, error } = await supabase!.from("yellow_traps").select("*");
      if (error) throw error;
      const db = await getDb();
      const tx = db.transaction("traps", "readwrite");
      await tx.store.clear();
      for (const row of data as Trap[]) await tx.store.put(row);
      await tx.done;
      return data as Trap[];
    } catch {
      return super.list();
    }
  }
  async save(value: Trap) {
    await requireCloudUser();
    const { error } = await supabase!.from("yellow_traps").upsert(value);
    if (error) throw error;
    await super.save(value);
  }
}
export const trapRepository = supabase
  ? new SupabaseTrapRepository()
  : new LocalTrapRepository();
