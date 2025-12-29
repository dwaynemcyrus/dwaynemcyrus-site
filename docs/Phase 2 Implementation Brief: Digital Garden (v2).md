# Phase 2 Implementation Brief: Digital Garden (v2)
**Timeline:** Weeks 5-6 **Goal:** Public website live with digital garden features — wiki-links, backlinks, and callouts.

## 1\. WHAT WE'RE BUILDING
A static digital garden at dwaynemcyrus.com with:
* Markdown rendering from Supabase
* Wiki-link resolution ([[Internal Link]] → proper URLs)
* Backlinks ("pages that link here")
* Callout blocks (> [!note], > [!warning])
* Core collection pages
* Simple navigation

⠀**What we're NOT building yet:**
* Full sitemap (all 50+ routes)
* Search
* Tags system
* Comments
* Newsletter signup integration
* Store pages

⠀
## 2\. TECH STACK
| **Layer** | **Choice** | **Notes** |
|:-:|:-:|:-:|
| Framework | Astro 4+ | Static-first, content-focused |
| Styling | Tailwind CSS | Consistent with Anchored |
| Content Source | Supabase | Fetch at build time |
| Markdown | MDX + remark/rehype plugins | For wiki-links, callouts |
| Hosting | Vercel | Auto-deploy on build trigger |
### Why Astro?
* **Static by default** — No JS shipped unless needed
* **Content collections** — Built-in content management
* **Island architecture** — Add interactivity only where needed
* **Fast builds** — Incremental builds for large sites
* **MDX support** — Custom components in markdown

⠀
## 3\. CONTENT MODEL
### 3.1 Documents Table Schema
The documents table stores all written content. Content types are differentiated by the content_type column, with type-specific fields stored in the metadata jsonb column.
documents
- id: text (ULID, primary key)
- user_id: uuid (FK to auth.users, NOT NULL)
- title: text (NOT NULL)
- slug: text (NOT NULL)
- content_type: text (NOT NULL) -- e.g., 'principles', 'essays', 'fragments', 'projects'
- visibility: text (NOT NULL, DEFAULT 'private') -- 'public' | 'supporter' | '1v1' | 'private'
- status: text (NOT NULL, DEFAULT 'draft') -- 'draft' | 'published' | 'archived'
- body_md: text (markdown content)
- summary: text (optional excerpt/description)
- "order": integer (for manual sorting within series)
- metadata: jsonb (DEFAULT '{}', type-specific fields)
- created_at: timestamptz (DEFAULT now())
- updated_at: timestamptz (DEFAULT now())
- published_at: timestamptz (nullable, set when published)
**Current Content Types:** projects, poetry, everyday, directives, principles, fragments, essays, broadcasts, notes, references, books, linked, letters, artwork, diary
**Note:** content_type is open text (not constrained) to allow for future additions without schema changes.
**Type-Specific Metadata Examples:**
* Artwork: { "medium": "oil on canvas", "dimensions": "24x36", "year": 2024 }
* Books: { "author": "Name", "isbn": "...", "rating": 5 }
* Projects: { "stack": ["Next.js", "Supabase"], "repo_url": "...", "live_url": "..." }

⠀**Indexes:**
* slug
* content_type
* visibility
* status
* published_at DESC
* Composite: (content_type, status, visibility)
* Composite: (user_id, content_type)

⠀**Constraints:**
* Unique: (user_id, slug) — slugs unique per user
* Check: visibility IN ('public', 'supporter', '1v1', 'private')
* Check: status IN ('draft', 'published', 'archived')

⠀**RLS Policies:** Users can only read/write their own documents.
### 3.2 URL Routing Configuration
The mapping from content_type to URL paths is defined in a configuration file, NOT stored in the database. This allows flexible URL structures without schema changes.
// src/config/routes.ts

export const ROUTE_CONFIG = {
  // Content type → URL path mapping
  contentTypeRoutes: {
    principles: '/library/principles',
    fragments: '/library/fragments',
    essays: '/library/essays',
    projects: '/engineer/projects',
    notes: '/engineer/notes',
    poetry: '/artist/poetry',
    artwork: '/artist/artwork',
    broadcasts: '/mentor/broadcasts',
    letters: '/mentor/letters',
    // Add more as needed
  },
  
  // Landing pages (not content types)
  landingPages: ['/library', '/engineer', '/artist', '/mentor'],
} as const;

// Build canonical URL from content type and slug
export function buildCanonical(contentType: string, slug: string): string {
  const basePath = ROUTE_CONFIG.contentTypeRoutes[contentType];
  if (!basePath) {
    console.warn(`No route configured for content type: ${contentType}`);
    return `/${contentType}/${slug}`;
  }
  return `${basePath}/${slug}`;
}
### 3.3 Build-Time Query
// Fetch all public, published documents for the site owner
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('user_id', SITE_OWNER_ID) // Your user ID
  .eq('visibility', 'public')
  .eq('status', 'published')
  .order('published_at', { ascending: false });
**Note:** SITE_OWNER_ID is an environment variable containing your Supabase user ID. This ensures the public site only builds YOUR content, even though the database supports multiple users.
### 3.4 Collection Mapping
| **Content Type** | **URL Pattern** | **Example** |
|:-:|:-:|:-:|
| principles | /library/principles/[slug] | /library/principles/emotional-sovereignty |
| fragments | /library/fragments/[slug] | /library/fragments/on-stillness |
| projects | /engineer/projects/[slug] | /engineer/projects/anchored |
| poetry | /artist/poetry/[slug] | /artist/poetry/morning-light |
| artwork | /artist/artwork/[slug] | /artist/artwork/series-one |

## 4\. WIKI-LINK IMPLEMENTATION
### 4.1 Syntax
Check out [[Emotional Sovereignty]] for more on this topic.

You might also like [[emotional-sovereignty|my essay on sovereignty]].
**Formats:**
* [[Page Title]] — Links using title, displays title
* [[slug|Display Text]] — Links using slug, displays custom text

⠀4.2 Resolution Logic
The canonical URL is computed at build time using the route configuration, NOT stored in the database.
// lib/wiki-links.ts

interface WikiLink {
  raw: string;        // "[[Emotional Sovereignty]]"
  target: string;     // "Emotional Sovereignty" or "emotional-sovereignty"
  display: string;    // "Emotional Sovereignty" or "my essay on sovereignty"
  resolved?: string;  // "/library/principles/emotional-sovereignty"
}

interface DocumentInfo {
  title: string;
  slug: string;
  content_type: string;
}

// Build a lookup index at build time
function buildLinkIndex(documents: DocumentInfo[]): Map<string, string> {
  const index = new Map<string, string>();
  
  for (const doc of documents) {
    // Compute canonical from content_type + slug
    const canonical = buildCanonical(doc.content_type, doc.slug);
    
    // Index by title (case-insensitive)
    index.set(doc.title.toLowerCase(), canonical);
    
    // Index by slug
    index.set(doc.slug.toLowerCase(), canonical);
  }
  
  return index;
}

// Resolve a wiki-link to a URL
function resolveWikiLink(target: string, index: Map<string, string>): string | null {
  const normalized = target.toLowerCase().trim();
  return index.get(normalized) || null;
}
### 4.3 Remark Plugin
// plugins/remark-wiki-links.ts

import { visit } from 'unist-util-visit';

export function remarkWikiLinks(options: { index: Map<string, string> }) {
  return (tree: any) => {
    visit(tree, 'text', (node, index, parent) => {
      const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let match;
      const newChildren = [];
      let lastIndex = 0;
      
      while ((match = wikiLinkRegex.exec(node.value)) !== null) {
        const [full, target, display] = match;
        const resolved = options.index.get(target.toLowerCase().trim());
        
        // Text before the link
        if (match.index > lastIndex) {
          newChildren.push({
            type: 'text',
            value: node.value.slice(lastIndex, match.index)
          });
        }
        
        if (resolved) {
          // Resolved link
          newChildren.push({
            type: 'link',
            url: resolved,
            children: [{ type: 'text', value: display || target }],
            data: { wikiLink: true }
          });
        } else {
          // Unresolved — render as broken link
          newChildren.push({
            type: 'html',
            value: `<span class="wiki-link-broken" title="Page not found">${display || target}</span>`
          });
        }
        
        lastIndex = match.index + full.length;
      }
      
      // Remaining text
      if (lastIndex < node.value.length) {
        newChildren.push({
          type: 'text',
          value: node.value.slice(lastIndex)
        });
      }
      
      if (newChildren.length > 0) {
        parent.children.splice(index, 1, ...newChildren);
      }
    });
  };
}

## 5\. BACKLINKS IMPLEMENTATION
### 5.1 Concept
Each page shows a "Linked from" section listing pages that link to it.
─────────────────────────────────────────
Linked from

* The Practice of Becoming
* On Stillness and Motion
* Weekly Review: Jan 15
─────────────────────────────────────────
### 5.2 Build-Time Extraction
// lib/backlinks.ts

interface BacklinkMap {
  [targetCanonical: string]: Array<{
    title: string;
    canonical: string;
    excerpt?: string;
  }>;
}

function buildBacklinks(documents: Document[], linkIndex: Map<string, string>): BacklinkMap {
  const backlinks: BacklinkMap = {};
  
  // Initialize empty arrays for all documents
  for (const doc of documents) {
    const canonical = buildCanonical(doc.content_type, doc.slug);
    backlinks[canonical] = [];
  }
  
  // Extract wiki-links from each document
  for (const doc of documents) {
    const docCanonical = buildCanonical(doc.content_type, doc.slug);
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    
    while ((match = wikiLinkRegex.exec(doc.body_md)) !== null) {
      const target = match[1].toLowerCase().trim();
      const resolvedCanonical = linkIndex.get(target);
      
      if (resolvedCanonical && resolvedCanonical !== docCanonical) {
        // Add this document as a backlink to the target
        backlinks[resolvedCanonical].push({
          title: doc.title,
          canonical: docCanonical,
          excerpt: extractExcerptAroundLink(doc.body_md, match.index)
        });
      }
    }
  }
  
  return backlinks;
}

function extractExcerptAroundLink(body: string, linkIndex: number): string {
  // Get ~50 chars before and after the link
  const start = Math.max(0, linkIndex - 50);
  const end = Math.min(body.length, linkIndex + 50);
  let excerpt = body.slice(start, end);
  
  // Clean up
  if (start > 0) excerpt = '...' + excerpt;
  if (end < body.length) excerpt = excerpt + '...';
  
  return excerpt.replace(/\[\[|\]\]/g, '').trim();
}
### 5.3 Backlinks Component
---
// components/Backlinks.astro
interface Props {
  backlinks: Array<{ title: string; canonical: string; excerpt?: string }>;
}

const { backlinks } = Astro.props;
---

{backlinks.length > 0 && (
  <aside class="backlinks mt-12 pt-8 border-t border-gray-200">
    <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
      Linked from
    </h2>
    <ul class="space-y-3">
      {backlinks.map((link) => (
        <li>
          <a 
            href={link.canonical} 
            class="text-gray-900 hover:text-blue-600 font-medium"
          >
            {link.title}
          </a>
          {link.excerpt && (
            <p class="text-sm text-gray-500 mt-1">{link.excerpt}</p>
          )}
        </li>
      ))}
    </ul>
  </aside>
)}

## 6\. CALLOUT BLOCKS
### 6.1 Syntax (Obsidian-compatible)
> [!note]
> This is a note callout with important information.

> [!warning]
> Be careful with this approach.

> [!tip] Pro Tip
> You can add a custom title after the type.

> [!quote]
> "The only way out is through." — Robert Frost
### 6.2 Callout Types
| **Type** | **Icon** | **Color** |
|:-:|:-:|:-:|
| note | 📝 | Blue |
| tip | 💡 | Green |
| warning | ⚠️ | Yellow |
| danger | 🚨 | Red |
| quote | 💬 | Gray |
| example | 📋 | Purple |
### 6.3 Remark Plugin
// plugins/remark-callouts.ts

import { visit } from 'unist-util-visit';

const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger', 'quote', 'example'];

export function remarkCallouts() {
  return (tree: any) => {
    visit(tree, 'blockquote', (node, index, parent) => {
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;
      
      const firstText = firstChild.children[0];
      if (!firstText || firstText.type !== 'text') return;
      
      // Match [!type] or [!type] Title
      const match = firstText.value.match(/^\[!(\w+)\](?:\s+(.+))?$/);
      if (!match) return;
      
      const [, type, customTitle] = match;
      if (!CALLOUT_TYPES.includes(type.toLowerCase())) return;
      
      // Remove the callout marker from content
      firstText.value = firstText.value.replace(/^\[!\w+\](?:\s+.+)?[\n\r]*/, '');
      if (!firstText.value) {
        firstChild.children.shift();
      }
      
      // Transform to custom callout node
      node.data = {
        hName: 'div',
        hProperties: {
          className: [`callout`, `callout-${type.toLowerCase()}`],
          'data-callout-type': type.toLowerCase(),
          'data-callout-title': customTitle || type
        }
      };
    });
  };
}
### 6.4 Callout Styles
/* styles/callouts.css */

.callout {
  @apply my-6 p-4 rounded-lg border-l-4;
}

.callout-note {
  @apply bg-blue-50 border-blue-500;
}

.callout-tip {
  @apply bg-green-50 border-green-500;
}

.callout-warning {
  @apply bg-yellow-50 border-yellow-500;
}

.callout-danger {
  @apply bg-red-50 border-red-500;
}

.callout-quote {
  @apply bg-gray-50 border-gray-400 italic;
}

.callout-example {
  @apply bg-purple-50 border-purple-500;
}

.callout::before {
  @apply block font-semibold mb-2;
  content: attr(data-callout-title);
}

## 7\. APPLICATION STRUCTURE
dwaynemcyrus-site/
├── src/
│   ├── components/
│   │   ├── Head.astro
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Nav.astro
│   │   ├── Backlinks.astro
│   │   ├── Callout.astro
│   │   ├── ArticleLayout.astro
│   │   └── CollectionLayout.astro
│   ├── config/
│   │   └── routes.ts          # Content type → URL mapping
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── ArticleLayout.astro
│   │   └── CollectionLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── library/
│   │   │   ├── index.astro
│   │   │   ├── principles/
│   │   │   │   ├── index.astro
│   │   │   │   └── [...slug].astro
│   │   │   └── fragments/
│   │   │       ├── index.astro
│   │   │       └── [...slug].astro
│   │   ├── mentor/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   ├── engineer/
│   │   │   ├── index.astro
│   │   │   └── projects/
│   │   │       ├── index.astro
│   │   │       └── [...slug].astro
│   │   ├── artist/
│   │   │   ├── index.astro
│   │   │   └── work/
│   │   │       └── [...slug].astro
│   │   └── now.astro
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── content.ts
│   │   ├── wiki-links.ts
│   │   └── backlinks.ts
│   ├── plugins/
│   │   ├── remark-wiki-links.ts
│   │   └── remark-callouts.ts
│   ├── data/                   # Generated at build time
│   │   ├── documents.json
│   │   ├── link-index.json
│   │   └── backlinks.json
│   └── styles/
│       ├── global.css
│       └── callouts.css
├── scripts/
│   └── build-content.ts        # Pre-build script to fetch from Supabase
├── public/
│   ├── images/
│   └── fonts/
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json

## 8\. KEY PAGES
### 8.1 Home Page
┌─────────────────────────────────────────────────────────────────────────┐
│  DWAYNE M. CYRUS                                                        │
│  Engineer · Mentor · Artist                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Welcome. I build software, guide men through emotional mastery,        │
│  and make art. This is my digital garden — a living collection of       │
│  ideas, projects, and explorations.                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  RECENTLY UPDATED                                                       │
│                                                                         │
│  • Emotional Sovereignty                           Jan 15               │
│  • The Practice of Becoming                        Jan 12               │
│  • Anchored: Building a Personal OS               Jan 10               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  EXPLORE                                                                │
│                                                                         │
│  [Library]     Essays, principles, and fragments                        │
│  [Engineer]    Software projects and technical writing                  │
│  [Mentor]      The Voyagers program and philosophy                      │
│  [Artist]      Visual work and poetry                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
### 8.2 Article Page
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Library / Principles                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EMOTIONAL SOVEREIGNTY                                                  │
│  Published Jan 15, 2024 · 8 min read                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  [Article content with rendered markdown, wiki-links, callouts...]      │
│                                                                         │
│  > [!note]                                                              │
│  > This principle builds on [[The Practice of Becoming]].              │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  LINKED FROM                                                            │
│                                                                         │
│  • The Practice of Becoming                                             │
│    "...as I discussed in [[Emotional Sovereignty]], the key is..."     │
│                                                                         │
│  • Weekly Review: Jan 15                                                │
│    "...revisiting [[Emotional Sovereignty]] helped me..."              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
### 8.3 Collection Index
┌─────────────────────────────────────────────────────────────────────────┐
│  LIBRARY                                                                │
│  Essays, principles, and collected fragments                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRINCIPLES (5)                                                         │
│  Core ideas that guide my work and life                                 │
│                                                                         │
│  • Emotional Sovereignty                                    Jan 15      │
│  • The Practice of Becoming                                 Jan 12      │
│  • Radical Acceptance                                       Dec 28      │
│  • Stillness as Strategy                                    Dec 15      │
│  • The Examined Life                                        Nov 30      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  FRAGMENTS (12)                                                         │
│  Shorter thoughts and observations                                      │
│                                                                         │
│  • On Stillness and Motion                                  Jan 14      │
│  • Morning Light                                            Jan 10      │
│  • The Weight of Words                                      Jan 8       │
│  [View all →]                                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

## 9\. BUILD PROCESS
### 9.1 Astro Configuration
// astro.config.mjs

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import { remarkWikiLinks } from './src/plugins/remark-wiki-links';
import { remarkCallouts } from './src/plugins/remark-callouts';

export default defineConfig({
  site: 'https://dwaynemcyrus.com',
  integrations: [tailwind(), mdx()],
  markdown: {
    remarkPlugins: [
      // Wiki-links and callouts added dynamically with index
    ],
    shikiConfig: {
      theme: 'github-light'
    }
  }
});
### 9.2 Build Script
// scripts/build-content.ts

import { createClient } from '@supabase/supabase-js';
import { buildLinkIndex } from '../src/lib/wiki-links';
import { buildBacklinks } from '../src/lib/backlinks';
import fs from 'fs/promises';

async function buildContent() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  
  // Fetch all public, published documents for site owner
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', process.env.SITE_OWNER_ID!)
    .eq('visibility', 'public')
    .eq('status', 'published');
  
  if (!documents) {
    console.error('No documents found');
    return;
  }
  
  // Build indexes
  const linkIndex = buildLinkIndex(documents);
  const backlinks = buildBacklinks(documents, linkIndex);
  
  // Write to JSON for Astro to consume
  await fs.writeFile(
    './src/data/documents.json',
    JSON.stringify(documents, null, 2)
  );
  
  await fs.writeFile(
    './src/data/link-index.json',
    JSON.stringify(Object.fromEntries(linkIndex), null, 2)
  );
  
  await fs.writeFile(
    './src/data/backlinks.json',
    JSON.stringify(backlinks, null, 2)
  );
  
  console.log(`Built content: ${documents.length} documents`);
}

buildContent();
### 9.3 Deploy Trigger
**Option A: Manual from Anchored**
* "Publish Site" button in Anchored
* Calls Vercel Deploy Hook

⠀**Option B: Scheduled**
* Vercel Cron job runs daily
* Rebuilds site with latest content

⠀// In Anchored: trigger rebuild
async function publishSite() {
  await fetch(process.env.VERCEL_DEPLOY_HOOK!, {
    method: 'POST'
  });
}

## 10\. ACCEPTANCE CRITERIA
Phase 2 is complete when:
### Content Fetching
* [ ] Astro fetches documents from Supabase at build time
* [ ] Only public + published documents are included
* [ ] Build fails gracefully if Supabase is unavailable

⠀Wiki-Links
* [ ] [[Page Title]] resolves to correct URL
* [ ] [[slug|Display Text]] shows custom text
* [ ] Unresolved links show as broken (styled differently)
* [ ] Links work across collections

⠀Backlinks
* [ ] Each article shows "Linked from" section
* [ ] Backlinks include title and excerpt
* [ ] Clicking backlink navigates to source page

⠀Callouts
* [ ] > [!note] renders as styled block
* [ ] All 6 callout types work
* [ ] Custom titles work (> [!tip] Pro Tip)

⠀Pages
* [ ] Home page shows recent updates
* [ ] Collection indexes list articles
* [ ] Article pages render markdown correctly
* [ ] /now page works

⠀Navigation
* [ ] Header with main sections
* [ ] Breadcrumbs on article pages
* [ ] Footer with links

⠀Responsive
* [ ] Desktop: comfortable reading width
* [ ] Mobile: full-width, readable typography

⠀Deploy
* [ ] Site deploys to Vercel
* [ ] Manual deploy trigger works from Anchored (or API)

⠀
## 11\. DEVELOPMENT ORDER
### Week 5: Foundation + Content Pipeline
1 Create documents table in Supabase with schema, indexes, RLS
2 Set up Astro project with Tailwind
3 Configure Supabase client for build-time fetching
4 Create route configuration file (content_type → URL mapping)
5 Build content fetching script
6 Create link index and backlinks builders
7 Implement remark plugins (wiki-links, callouts)
8 Test with sample content

⠀Week 6: Pages + Polish
1 Build layouts (Base, Article, Collection)
2 Create home page
3 Build collection index pages
4 Build article pages with backlinks
5 Add navigation (header, footer, breadcrumbs)
6 Responsive pass
7 Set up Vercel deploy
8 Test deploy trigger

⠀
## 12\. SAMPLE CONTENT FOR TESTING
Create 5-10 test documents in Supabase to verify:
{
  "id": "01HQXYZ...",
  "user_id": "your-uuid-here",
  "title": "Emotional Sovereignty",
  "slug": "emotional-sovereignty",
  "content_type": "principles",
  "visibility": "public",
  "status": "published",
  "body_md": "# Emotional Sovereignty\n\nThis builds on [[The Practice of Becoming]].\n\n> [!note]\n> This is a core principle.\n\nMore content here...",
  "summary": "A foundational principle on owning your emotional state.",
  "order": null,
  "metadata": {},
  "published_at": "2024-01-15T00:00:00Z"
}
Create documents that:
* Link to each other (test wiki-links)
* Use callouts (test rendering)
* Span multiple content types (test routing)
* Have varying lengths (test layout)

⠀
## 13\. SUCCESS METRICS
After Week 6, you should have:
1 A live site at dwaynemcyrus.com
2 At least 5 articles rendering correctly
3 Wiki-links connecting related content
4 Backlinks showing on each page
5 Callouts rendering with proper styling
6 Ability to trigger rebuild from Anchored

⠀The site should feel like a living digital garden — interconnected, explorable, and distinctly yours.
