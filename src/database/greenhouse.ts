import type { Greenhouse } from "../types";
import { getDb } from "../offline/db";
import { supabase, requireCloudUser } from "./supabase";
export interface GreenhouseRepository {
  list(): Promise<Greenhouse[]>;
  save(value: Greenhouse): Promise<void>;
}
export class LocalGreenhouseRepository implements GreenhouseRepository {
  async list() {
    return (await getDb()).getAll("greenhouse");
  }
  async save(value: Greenhouse) {
    const db = await getDb();
    const existing = await db.getAll("greenhouse");
    if (existing.some((x) => x.code === value.code && x.id !== value.id))
      throw new Error("Kode greenhouse sudah digunakan.");
    await db.put("greenhouse", value);
  }
}
export class SupabaseGreenhouseRepository extends LocalGreenhouseRepository {
  async list() {
    try {
      const { data, error } = await supabase!.from("greenhouse").select("*");
      if (error) throw error;
      const db = await getDb();
      const tx = db.transaction("greenhouse", "readwrite");
      await tx.store.clear();
      for (const row of data as Greenhouse[]) await tx.store.put(row);
      await tx.done;
      return data as Greenhouse[];
    } catch {
      return super.list();
    }
  }
  async save(value: Greenhouse) {
    await requireCloudUser();
    const { error } = await supabase!.from("greenhouse").upsert(value);
    if (error) throw error;
    await super.save(value);
  }
}
export const greenhouseRepository = supabase
  ? new SupabaseGreenhouseRepository()
  : new LocalGreenhouseRepository();
