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
// Two-person team: open the app without a login screen. A device with no session
// gets an anonymous Supabase user (needs "Allow anonymous sign-ins" in the dashboard);
// email login in Settings still works.
export async function ensureSession() {
  if (!supabase || (await currentUser())) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) console.warn("Anonymous sign-in unavailable:", error.message);
}
export async function requireCloudUser() {
  if (!(await currentUser())) {
    throw new Error(
      "Anda belum login atau sesi sudah berakhir. Buka Settings → Akun Supabase, lalu masuk sebelum menyimpan greenhouse atau trap.",
    );
  }
}
