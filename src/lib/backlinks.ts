/**
 * Backlinks extraction utilities.
 * Builds a map of which documents link to each document.
 */
import type { Document, BacklinkEntry, BacklinkMap } from "@models/documents";
import { normalizeKey, type WikiLinkIndex } from "./wiki-links";

/**
 * Regex pattern for matching wiki-links in markdown content.
 * Matches [[target]] and [[target|display text]] formats.
 */
const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Extracts a text excerpt around a wiki-link for context.
 * @param body - The full markdown body
 * @param linkPosition - The character position of the link
 * @param contextChars - Number of characters to include before/after (default 50)
 */
export function extractExcerptAroundLink(
  body: string,
  linkPosition: number,
  contextChars = 50,
): string {
  const start = Math.max(0, linkPosition - contextChars);
  const end = Math.min(body.length, linkPosition + contextChars);
  let excerpt = body.slice(start, end);

  if (start > 0) excerpt = `...${excerpt}`;
  if (end < body.length) excerpt = `${excerpt}...`;

  // Remove wiki-link brackets from excerpt
  return excerpt.replace(/\[\[|\]\]/g, "").trim();
}

/**
 * Extracts all wiki-links from a document's markdown body.
 * @param body - The markdown content
 * @returns Array of { target, position } for each link found
 */
export function extractWikiLinks(
  body: string,
): Array<{ target: string; position: number }> {
  const links: Array<{ target: string; position: number }> = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKI_LINK_REGEX.lastIndex = 0;

  while ((match = WIKI_LINK_REGEX.exec(body)) !== null) {
    links.push({
      target: match[1],
      position: match.index,
    });
  }

  return links;
}

/**
 * Builds a backlinks map from documents and a link index.
 * For each document, finds all other documents that link to it.
 *
 * @param documents - Array of documents with body_md content
 * @param linkIndex - The wiki-link index for resolving targets to canonicals
 * @returns Map of canonical URLs to arrays of backlink entries
 */
export function buildBacklinks(
  documents: Document[],
  linkIndex: WikiLinkIndex,
): BacklinkMap {
  const backlinks: BacklinkMap = {};

  // Initialize empty arrays for all documents
  for (const doc of documents) {
    if (doc.canonical) {
      backlinks[doc.canonical] = [];
    }
  }

  // Extract wiki-links from each document and record backlinks
  for (const doc of documents) {
    if (!doc.body_md || !doc.canonical) continue;

    const links = extractWikiLinks(doc.body_md);

    for (const link of links) {
      const normalizedTarget = normalizeKey(link.target);
      const resolvedCanonical = linkIndex.get(normalizedTarget);

      // Skip self-links and unresolved links
      if (!resolvedCanonical || resolvedCanonical === doc.canonical) continue;

      const entry: BacklinkEntry = {
        title: doc.title,
        canonical: doc.canonical,
        excerpt: extractExcerptAroundLink(doc.body_md, link.position),
      };

      backlinks[resolvedCanonical] = backlinks[resolvedCanonical] ?? [];
      backlinks[resolvedCanonical].push(entry);
    }
  }

  return backlinks;
}

/**
 * Gets the backlinks for a specific document.
 * @param canonical - The canonical URL of the document
 * @param backlinksMap - The full backlinks map
 * @returns Array of backlink entries, or empty array if none
 */
export function getBacklinksFor(
  canonical: string,
  backlinksMap: BacklinkMap,
): BacklinkEntry[] {
  return backlinksMap[canonical] ?? [];
}
