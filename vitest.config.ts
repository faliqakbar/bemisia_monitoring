import { defineConfig } from "vitest/config";

// Unit tests must never depend on or connect to the user's configured cloud project.
export default defineConfig({
  test: {
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
});
