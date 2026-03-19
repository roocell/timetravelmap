import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./shared";

function createSupabaseBrowserClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: {
      schema: "timetravelmap"
    }
  });
}

type BrowserSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

let browserClient: BrowserSupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }

  return browserClient;
}
