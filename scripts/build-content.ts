/**
 * Build script that fetches documents from Supabase and generates JSON files
 * for Astro to consume at build time.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { buildCanonical, contentTypeRoutes } from "../src/config/routes";
import {
  buildLinkIndex,
  wikiLinkIndexToJson,
} from "../src/lib/wiki-links";
import { buildBacklinks } from "../src/lib/backlinks";
import type { DocumentRow, Document } from "../src/models/documents";

const OUTPUT_DIR = path.join(process.cwd(), "src", "data");

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ============================================================================
// DOCUMENT TRANSFORMATION
// ============================================================================

function buildCollection(contentType: string): string {
  const basePath = contentTypeRoutes[contentType as keyof typeof contentTypeRoutes];
  if (!basePath) {
    return contentType;
  }
  // Remove leading slash: "/library/principles" -> "library/principles"
  return basePath.slice(1);
}

function transformDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content_type: row.content_type,
    collection: buildCollection(row.content_type),
    visibility: row.visibility,
    status: row.status,
    canonical: buildCanonical(row.content_type, row.slug),
    body_md: row.body_md ?? "",
    summary: row.summary,
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

// ============================================================================
// FILE I/O
// ============================================================================

async function writeJson(fileName: string, data: unknown): Promise<void> {
  const filePath = path.join(OUTPUT_DIR, fileName);
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${payload}\n`);
}

// ============================================================================
// SUPABASE FETCH
// ============================================================================

async function fetchDocuments(): Promise<DocumentRow[]> {
  const supabaseUrl = getEnvVar("SUPABASE_URL");
  const supabaseAnonKey = getEnvVar("SUPABASE_ANON_KEY");
  const siteOwnerId = getEnvVar("SITE_OWNER_ID");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", siteOwnerId)
    .eq("visibility", "public")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return data ?? [];
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("Fetching documents from Supabase...");

  const rawDocuments = await fetchDocuments();

  if (rawDocuments.length === 0) {
    console.warn("No documents found. Check your Supabase data and filters.");
    process.exit(0);
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Transform raw documents to add computed fields
  const documents = rawDocuments.map(transformDocument);

  // Build indexes
  const linkIndex = buildLinkIndex(documents);
  const backlinks = buildBacklinks(documents, linkIndex);

  // Write JSON files
  await writeJson("documents.json", documents);
  await writeJson("link-index.json", wikiLinkIndexToJson(linkIndex));
  await writeJson("backlinks.json", backlinks);

  console.log(`✓ Built content: ${documents.length} documents`);

  // Log breakdown by content type
  const byType: Record<string, number> = {};
  for (const doc of documents) {
    byType[doc.content_type] = (byType[doc.content_type] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  - ${type}: ${count}`);
  }
}

main().catch((error: Error) => {
  console.error("✗ Failed to build content:", error.message);
  process.exit(1);
});
