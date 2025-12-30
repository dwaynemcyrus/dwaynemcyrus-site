/**
 * Content fetching functions for build-time data retrieval from Supabase.
 * These functions are used by the build script, not at runtime.
 */
import { supabase, SITE_OWNER_ID } from "./supabase";
import type { DocumentRow } from "@models/documents";

/**
 * Fetches all public, published documents for the site owner.
 * Used at build time to generate static content.
 */
export async function getPublishedDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", SITE_OWNER_ID)
    .eq("visibility", "public")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data ?? [];
}
