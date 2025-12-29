export type DocumentVisibility = "public" | "supporter" | "1v1" | "private";
export type DocumentStatus = "draft" | "published" | "archived";

// Raw document from Supabase (content_type based)
export type DocumentRow = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  content_type: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  body_md: string | null;
  summary: string | null;
  order: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

// Document with computed canonical URL and collection path
export type Document = {
  id: string;
  title: string;
  slug: string;
  content_type: string;
  collection: string;  // computed from content_type (e.g., "library/principles")
  visibility: DocumentVisibility;
  status: DocumentStatus;
  canonical: string;   // computed from content_type + slug
  body_md: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

export type BacklinkEntry = {
  title: string;
  canonical: string;
  excerpt?: string;
};

export type BacklinkMap = Record<string, BacklinkEntry[]>;
