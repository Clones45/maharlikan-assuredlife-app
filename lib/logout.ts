// logout.ts
import { router } from "expo-router";
import { supabase, signOutUsername } from "./supabase";

/**
 * Logs the user out safely without forcing a reload.
 * - Clears Maharlikan tokens and Supabase session
 * - Redirects to /login cleanly
 */
export async function hardLogout() {
  try {
    // clear session & custom tokens
    await signOutUsername();

    // clean up web local/session storage if running on web
    if (typeof window !== "undefined") {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));

        localStorage.removeItem("maharlikan.jwt");
        localStorage.removeItem("maharlikan.user");
        sessionStorage.clear?.();
      } catch {
        /* ignore */
      }
    }

    // ✅ simple redirect back to login (no reload)
    router.replace("/login");
  } catch (e) {
    console.warn("[hardLogout]", e);
    router.replace("/login");
  }
}
