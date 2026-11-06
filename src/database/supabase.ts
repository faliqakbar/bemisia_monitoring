import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const validUrl = (() => {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
})();
export const supabase = validUrl && key ? createClient(url, key) : null;
export const isDemo = !supabase;
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await supabase?.auth.signOut();
}
export async function currentUser() {
  return (await supabase?.auth.getSession())?.data.session?.user ?? null;
}
export async function requireCloudUser() {
  if (!(await currentUser())) {
    throw new Error(
      "Anda belum login atau sesi sudah berakhir. Buka Settings → Akun Supabase, lalu masuk sebelum menyimpan greenhouse atau trap.",
    );
  }
}
