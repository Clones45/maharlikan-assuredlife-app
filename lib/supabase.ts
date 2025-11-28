// lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/* ============================================================
   1️⃣  SAFELY LOAD CREDENTIALS (works in Expo Go + APK)
   ============================================================ */
const isWeb = typeof window !== "undefined";

// In a standalone build, Expo puts extras under `manifestExtra`
const manifest =
  (Constants.expoConfig?.extra ??
    (Constants as any).manifestExtra ??
    {}) as Record<string, string>;

const SUPABASE_URL = manifest.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = manifest.SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[Supabase] Missing URL or ANON_KEY. Check app.json → extra."
  );
}

/* ============================================================
   2️⃣  STORAGE HELPERS (SecureStore → AsyncStorage → localStorage)
   ============================================================ */
let SS: any = null;
try {
  SS = require("expo-secure-store");
} catch {}
let AS: any = null;
try {
  AS = require("@react-native-async-storage/async-storage").default;
} catch {}

async function saveItem(key: string, val: string) {
  if (SS?.setItemAsync) return SS.setItemAsync(key, val);
  if (AS?.setItem) return AS.setItem(key, val);
  if (isWeb && window?.localStorage)
    return window.localStorage.setItem(key, val);
}
async function getItem(key: string) {
  if (SS?.getItemAsync) return SS.getItemAsync(key);
  if (AS?.getItem) return AS.getItem(key);
  if (isWeb && window?.localStorage)
    return window.localStorage.getItem(key);
  return null;
}
async function deleteItem(key: string) {
  if (SS?.deleteItemAsync) return SS.deleteItemAsync(key);
  if (AS?.removeItem) return AS.removeItem(key);
  if (isWeb && window?.localStorage)
    return window.localStorage.removeItem(key);
}

/* ============================================================
   3️⃣  MAIN SUPABASE CLIENT
   ============================================================ */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/* ============================================================
   4️⃣  CUSTOM USERNAME-LOGIN SUPPORT (unchanged)
   ============================================================ */
const TOKEN_KEY = "maharlikan.jwt";
const USER_KEY = "maharlikan.user";

export type BasicUser = {
  user_id: string;
  username: string;
  role: "admin" | "agent" | string;
  agent_id: number | null;
};

export async function getUserClient(): Promise<SupabaseClient | null> {
  const token = await getItem(TOKEN_KEY);
  if (!token) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function currentUser(): Promise<BasicUser | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BasicUser;
  } catch {
    return null;
  }
}

export async function signOutUsername() {
  try {
    await Promise.all([
      deleteItem(TOKEN_KEY),
      deleteItem(USER_KEY),
      supabase.auth.signOut(),
    ]);
    if (isWeb) {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage?.clear?.();
      } catch {}
    }
  } catch (e) {
    console.warn("[logout]", e);
  }
}

export async function ensureAuthConsistency(strict: boolean = false) {
  try {
    const [uToken, { data }] = await Promise.all([
      getItem(TOKEN_KEY),
      supabase.auth.getSession(),
    ]);
    const hasSB = !!data?.session;
    if (strict && !uToken && hasSB) await supabase.auth.signOut();
  } catch (err) {
    console.warn("[Auth] ensureAuthConsistency error:", err);
  }
}

export async function loginWithUsername(username: string, password: string) {
  const { data, error } = await supabase.functions.invoke("username-login", {
    body: { username, password },
  });

  if (error) throw new Error(error.message || "Login failed");
  if (!data?.ok) throw new Error((data as any)?.error || "Login failed");

  const { token, user } = data as { token: string; user: BasicUser };
  await saveItem(TOKEN_KEY, token);
  await saveItem(USER_KEY, JSON.stringify(user));

  const SBUser = await getUserClient();
  return { SBUser, user };
}

export const AuthStorage = {
  saveItem,
  getItem,
  deleteItem,
  TOKEN_KEY,
  USER_KEY,
  isWeb,
};
