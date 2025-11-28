// lib/usernameLogin.ts
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_LOGIN_PATH } from "./config";

export type UsernameLoginResponse = {
  ok: boolean;
  role?: string;
  user?: any;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  error?: string;
};

export async function usernameLogin(username: string, password: string): Promise<UsernameLoginResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}${USERNAME_LOGIN_PATH}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error || "Login failed");
    }

    return data;
  } catch (error: any) {
    console.error("Login error:", error.message);
    return { ok: false, error: error.message };
  }
}
