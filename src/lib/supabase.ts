/**
 * Supabase client for server-side use only.
 * This client is used during the build process to fetch content from Supabase.
 * It should NOT be used in client-side code or exposed to the browser.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SITE_OWNER_ID = process.env.SITE_OWNER_ID;

if (!SITE_OWNER_ID) {
  throw new Error(
    "Missing SITE_OWNER_ID environment variable. This is required to fetch the site owner's documents.",
  );
}
