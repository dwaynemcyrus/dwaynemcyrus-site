import documentsRaw from "@data/documents.json";
import backlinksRaw from "@data/backlinks.json";
import type { BacklinkEntry, BacklinkMap, Document } from "@models/documents";

const documents = documentsRaw as Document[];
const publicDocuments = documents.filter(
  (doc) => doc.visibility === "public" && doc.status === "published",
);
const backlinks = backlinksRaw as BacklinkMap;

export function getDocuments() {
  return publicDocuments;
}

export function getDocumentByCanonical(canonical: string) {
  return publicDocuments.find((doc) => doc.canonical === canonical);
}

export function getDocumentsByCollection(collection: string) {
  return publicDocuments.filter((doc) => doc.collection === collection);
}

export function getDocumentsByCollectionPrefix(prefix: string) {
  return publicDocuments.filter((doc) => doc.collection.startsWith(prefix));
}

export function getDocumentDate(doc: Document) {
  const date =
    doc.published_at || doc.updated_at || doc.created_at || undefined;
  return date ? new Date(date) : null;
}

export function sortDocumentsByDate(
  docs: Document[],
  descending = true,
) {
  return [...docs].sort((a, b) => {
    const dateA = getDocumentDate(a)?.valueOf() ?? 0;
    const dateB = getDocumentDate(b)?.valueOf() ?? 0;
    return descending ? dateB - dateA : dateA - dateB;
  });
}

export function getRecentDocuments(limit: number) {
  return sortDocumentsByDate(publicDocuments).slice(0, limit);
}

export function getBacklinksFor(canonical: string): BacklinkEntry[] {
  return backlinks[canonical] ?? [];
}

export function getDocumentsByContentType(contentType: string) {
  return publicDocuments.filter((doc) => doc.content_type === contentType);
}

export function getDocumentsGroupedByContentType(contentTypes: string[]) {
  const grouped: Record<string, Document[]> = {};
  for (const type of contentTypes) {
    const docs = sortDocumentsByDate(getDocumentsByContentType(type));
    if (docs.length > 0) {
      grouped[type] = docs;
    }
  }
  return grouped;
}
