// lib/auth.ts
import { supabase } from "./supabase";
import { SUPABASE_ANON_KEY } from "./config";

export type UsernameLoginResponse = {
  ok: boolean;
  role?: "admin" | "agent" | "member" | null;
  user?: any;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  error?: string;
};

const FUNC_NAME = "username-login";

// Safety timeout so the button won't spin forever if the function hangs
function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Server took too long (timeout)")), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

/**
 * Login using username + password via Supabase Edge Function.
 * NOTE: supabase.functions.invoke does NOT send Authorization when there's no session,
 * so we explicitly attach the anon key as Bearer (and apikey) to avoid 401.
 */
export async function loginByUsername(username: string, password: string): Promise<UsernameLoginResponse> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(FUNC_NAME, {
        body: { username, password },
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`, // required when no session yet
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
      })
    );

    if (error) throw new Error(error.message || "Login failed");
    if (!data?.ok) throw new Error(data?.error || "Login failed");

    return data as UsernameLoginResponse;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
