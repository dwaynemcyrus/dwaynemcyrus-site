import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "src", "data");

// ============================================================================
// ROUTE CONFIGURATION
// Maps content_type to URL paths
// ============================================================================

const ROUTE_CONFIG = {
  // Content type → collection path and URL base
  principles: { collection: "library/principles", urlBase: "/library/principles" },
  fragments: { collection: "library/fragments", urlBase: "/library/fragments" },
  essays: { collection: "library/essays", urlBase: "/library/essays" },
  projects: { collection: "engineer/projects", urlBase: "/engineer/projects" },
  notes: { collection: "engineer/notes", urlBase: "/engineer/notes" },
  poetry: { collection: "artist/poetry", urlBase: "/artist/poetry" },
  artwork: { collection: "artist/artwork", urlBase: "/artist/artwork" },
  broadcasts: { collection: "mentor/broadcasts", urlBase: "/mentor/broadcasts" },
  letters: { collection: "mentor/letters", urlBase: "/mentor/letters" },
  books: { collection: "library/books", urlBase: "/library/books" },
  // Fallback for unknown types
};

function getRouteForContentType(contentType) {
  return ROUTE_CONFIG[contentType] || {
    collection: contentType,
    urlBase: `/${contentType}`,
  };
}

function buildCanonical(contentType, slug) {
  const route = getRouteForContentType(contentType);
  return `${route.urlBase}/${slug}`;
}

function buildCollection(contentType) {
  const route = getRouteForContentType(contentType);
  return route.collection;
}

// ============================================================================
// TRANSFORM DOCUMENTS
// Add computed fields (canonical, collection) to raw Supabase data
// ============================================================================

function transformDocument(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content_type: row.content_type,
    collection: buildCollection(row.content_type),
    visibility: row.visibility,
    status: row.status,
    canonical: buildCanonical(row.content_type, row.slug),
    body_md: row.body_md || "",
    summary: row.summary,
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

// ============================================================================
// LINK INDEX & BACKLINKS
// ============================================================================

function normalizeKey(value) {
  return value.toLowerCase().trim();
}

function buildLinkIndex(documents) {
  const index = new Map();

  for (const doc of documents) {
    if (!doc?.canonical) {
      continue;
    }

    if (doc.title) {
      index.set(normalizeKey(doc.title), doc.canonical);
    }

    if (doc.slug) {
      index.set(normalizeKey(doc.slug), doc.canonical);
    }

    if (doc.id) {
      index.set(normalizeKey(doc.id), doc.canonical);
    }
  }

  return index;
}

function extractExcerptAroundLink(body, linkIndex) {
  const start = Math.max(0, linkIndex - 50);
  const end = Math.min(body.length, linkIndex + 50);
  let excerpt = body.slice(start, end);

  if (start > 0) {
    excerpt = `...${excerpt}`;
  }
  if (end < body.length) {
    excerpt = `${excerpt}...`;
  }

  return excerpt.replace(/\[\[|\]\]/g, "").trim();
}

function buildBacklinks(documents, linkIndex) {
  const backlinks = {};

  for (const doc of documents) {
    if (doc?.canonical) {
      backlinks[doc.canonical] = [];
    }
  }

  for (const doc of documents) {
    if (!doc?.body_md || !doc?.canonical) {
      continue;
    }

    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(doc.body_md)) !== null) {
      const target = normalizeKey(match[1]);
      const resolvedCanonical = linkIndex.get(target);

      if (resolvedCanonical && resolvedCanonical !== doc.canonical) {
        backlinks[resolvedCanonical] = backlinks[resolvedCanonical] || [];
        backlinks[resolvedCanonical].push({
          title: doc.title,
          canonical: doc.canonical,
          excerpt: extractExcerptAroundLink(doc.body_md, match.index),
        });
      }
    }
  }

  return backlinks;
}

// ============================================================================
// FILE I/O
// ============================================================================

async function writeJson(fileName, data) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${payload}\n`);
}

// ============================================================================
// SUPABASE FETCH
// ============================================================================

async function fetchDocuments() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "Skipping content fetch: SUPABASE_URL or SUPABASE_ANON_KEY is missing.",
    );
    return null;
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("visibility", "public")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.warn("Skipping content fetch: Supabase query failed.", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.warn("Skipping content fetch: No documents returned.");
    return null;
  }

  return data;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const rawDocuments = await fetchDocuments();

  if (!rawDocuments) {
    console.log("No documents fetched. Using existing data files if available.");
    return;
  }

  // Transform raw documents to add computed fields
  const documents = rawDocuments.map(transformDocument);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const linkIndex = buildLinkIndex(documents);
  const backlinks = buildBacklinks(documents, linkIndex);

  await writeJson("documents.json", documents);
  await writeJson("link-index.json", Object.fromEntries(linkIndex));
  await writeJson("backlinks.json", backlinks);

  console.log(`Built content: ${documents.length} documents`);

  // Log by content type
  const byType = {};
  for (const doc of documents) {
    byType[doc.content_type] = (byType[doc.content_type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  - ${type}: ${count}`);
  }
}

main().catch((error) => {
  console.error("Failed to build content.", error);
  process.exitCode = 1;
});
