import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const EDGE_BASE = `${supabaseUrl}/functions/v1/ingest-emissions`;

export const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
export const DEMO_ANALYST = "Neelima Bonangi";

export async function callEdge(path: string, options?: RequestInit) {
  const res = await fetch(`${EDGE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}
