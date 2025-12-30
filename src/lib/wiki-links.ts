/**
 * Wiki-link resolution utilities.
 * Builds an index mapping document titles and slugs to their canonical URLs.
 */
import type { Document } from "@models/documents";
import { buildCanonical } from "@config/routes";

/**
 * A map from lowercase lookup keys (title, slug) to canonical URLs.
 */
export type WikiLinkIndex = Map<string, string>;

/**
 * Serializable version of WikiLinkIndex for JSON storage.
 */
export type WikiLinkIndexJson = Record<string, string>;

/**
 * Normalizes a string for case-insensitive lookup.
 */
export function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Builds a link index from documents for wiki-link resolution.
 * Maps titles and slugs (lowercase) to their canonical URLs.
 */
export function buildLinkIndex(documents: Document[]): WikiLinkIndex {
  const index: WikiLinkIndex = new Map();

  for (const doc of documents) {
    // Use pre-computed canonical if available, otherwise compute it
    const canonical = doc.canonical ?? buildCanonical(doc.content_type, doc.slug);
    if (!canonical) continue;

    // Index by title (case-insensitive)
    if (doc.title) {
      index.set(normalizeKey(doc.title), canonical);
    }

    // Index by slug
    if (doc.slug) {
      index.set(normalizeKey(doc.slug), canonical);
    }

    // Index by ID for direct references
    if (doc.id) {
      index.set(normalizeKey(doc.id), canonical);
    }
  }

  return index;
}

/**
 * Resolves a wiki-link target to a canonical URL.
 * @param target - The link target (title or slug from [[target]] or [[target|display]])
 * @param index - The wiki-link index
 * @returns The canonical URL or null if not found
 */
export function resolveWikiLink(
  target: string,
  index: WikiLinkIndex,
): string | null {
  const normalized = normalizeKey(target);
  return index.get(normalized) ?? null;
}

/**
 * Converts a WikiLinkIndex Map to a plain object for JSON serialization.
 */
export function wikiLinkIndexToJson(index: WikiLinkIndex): WikiLinkIndexJson {
  return Object.fromEntries(index);
}

/**
 * Converts a JSON object back to a WikiLinkIndex Map.
 */
export function wikiLinkIndexFromJson(json: WikiLinkIndexJson): WikiLinkIndex {
  return new Map(Object.entries(json));
}
