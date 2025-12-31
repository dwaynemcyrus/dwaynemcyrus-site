# Dwayne M. Cyrus - Digital Garden

A personal digital garden built with Astro, powered by Supabase for content management. Features wiki-style linking, backlinks, and interconnected content across multiple collections.

## Features

### Content & Navigation
- **Wiki-style linking** - `[[Page Title]]` or `[[Page Title|Display Text]]` syntax
- **Automatic backlinks** - See which pages link to the current page
- **Breadcrumb navigation** - "Back to Collection" links on article pages
- **Table of contents** - Auto-generated from headings
- **Full-text search** - Powered by Pagefind
- **Broken link detection** - Unresolved wiki-links styled distinctly

### Content Types
- **Library** - Principles, fragments, essays, books
- **Engineer** - Projects, technical notes
- **Artist** - Poetry, artwork
- **Mentor** - Broadcasts, letters
- **Now page** - Current focus snapshot

### Writing Features
- **Callout blocks** - `> [!tip]`, `> [!warning]`, `> [!note]`, etc.
- **Reading time** - Estimated reading time on articles
- **Publication dates** - Formatted dates with fallback logic
- **Summaries** - Optional article descriptions

### Site Features
- **Dark/light/system themes** - Persistent theme preference
- **RSS feed** - Subscribe to updates at `/rss.xml`
- **Sitemap** - Auto-generated for SEO
- **Comments** - Giscus integration for discussions
- **Responsive design** - Mobile-friendly layout
- **Page transitions** - Smooth animations between pages

### Infrastructure
- **Static site generation** - Fast, secure, CDN-friendly
- **Supabase backend** - Content stored in PostgreSQL
- **Automatic deploys** - Webhook triggers rebuild on publish
- **Type safety** - Full TypeScript throughout

## Tech Stack

- [Astro](https://astro.build) - Static site generator
- [Supabase](https://supabase.com) - Content database
- [TailwindCSS](https://tailwindcss.com) - Styling
- [Pagefind](https://pagefind.app) - Search
- [Giscus](https://giscus.app) - Comments
- [Vercel](https://vercel.com) - Hosting

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase credentials

# Start development server
npm run dev
```

## Build Process

The build process:
1. Fetches content from Supabase (`scripts/build-content.mjs`)
2. Generates link index and backlinks
3. Builds static site with Astro

```bash
# Full build (fetches content + builds site)
npm run build

# Preview production build
npm run preview
```

## Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Add environment variables** in Project Settings:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anon/public key
   - `PUBLIC_GISCUS_*` - Giscus configuration (optional)

3. **Deploy** - Vercel auto-detects Astro and uses `vercel.json` settings

### Triggering Rebuilds

When content changes in Supabase, trigger a rebuild:

1. **Create a Deploy Hook** in Vercel:
   - Project Settings → Git → Deploy Hooks
   - Name it "Supabase Rebuild"
   - Copy the URL

2. **Manual trigger**:
   ```bash
   curl -X POST https://api.vercel.com/v1/integrations/deploy/...
   ```

### Automatic Deploys from Supabase

To automatically rebuild when documents are published, set up a Supabase Edge Function with a database webhook. This ensures rebuilds only trigger for `visibility = 'public'` AND `status = 'published'` documents.

#### Step 1: Create the Edge Function

**Supabase Dashboard → Edge Functions → Create New Function**

Name: `trigger-deploy`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const VERCEL_DEPLOY_HOOK = Deno.env.get('VERCEL_DEPLOY_HOOK')

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, old_record } = payload

    // Get the relevant record (new for INSERT/UPDATE, old for DELETE)
    const doc = record || old_record

    // Only trigger if document is public and published
    const shouldDeploy =
      doc?.visibility === 'public' &&
      doc?.status === 'published'

    // Also trigger if a previously published doc was unpublished/hidden
    const wasPublished =
      old_record?.visibility === 'public' &&
      old_record?.status === 'published'

    if (shouldDeploy || wasPublished) {
      const response = await fetch(VERCEL_DEPLOY_HOOK!, {
        method: 'POST',
      })

      return new Response(
        JSON.stringify({ triggered: true, status: response.status }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ triggered: false, reason: 'Not public/published' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

#### Step 2: Add the Secret

**Supabase Dashboard → Edge Functions → trigger-deploy → Secrets**

| Name | Value |
|------|-------|
| `VERCEL_DEPLOY_HOOK` | Your Vercel deploy hook URL |

#### Step 3: Create the Database Webhook

**Supabase Dashboard → Database → Webhooks → Create**

| Setting | Value |
|---------|-------|
| Name | `deploy-on-publish` |
| Table | `documents` |
| Events | INSERT, UPDATE, DELETE |
| Type | Supabase Edge Function |
| Function | `trigger-deploy` |

#### How It Works

1. Any change to `documents` table triggers the webhook
2. Webhook calls the Edge Function
3. Edge Function checks if `visibility = 'public'` AND `status = 'published'`
4. Only then does it call your Vercel deploy hook
5. Also triggers if a published doc gets unpublished (to remove it from the site)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VERCEL_DEPLOY_HOOK` | No | Webhook URL to trigger rebuilds |
| `PUBLIC_GISCUS_REPO` | No | GitHub repo for comments |
| `PUBLIC_GISCUS_REPO_ID` | No | Giscus repo ID |
| `PUBLIC_GISCUS_CATEGORY` | No | Giscus category name |
| `PUBLIC_GISCUS_CATEGORY_ID` | No | Giscus category ID |

## Project Structure

```
src/
├── components/     # Reusable UI components
├── data/           # Generated JSON (documents, backlinks)
├── layouts/        # Page layouts (Layout, ArticleLayout)
├── lib/            # Utilities (documents, markdown, wiki-links)
├── models/         # TypeScript types
├── pages/          # Route pages
│   ├── library/    # Principles, fragments, essays, books
│   ├── engineer/   # Projects, notes
│   ├── artist/     # Poetry, artwork
│   ├── mentor/     # Broadcasts, letters
│   └── now/        # Now page
├── plugins/        # Remark plugins (wiki-links, callouts)
└── styles/         # Global styles
scripts/
└── build-content.mjs  # Supabase content fetcher
```

## Credits

Based on [Astro Micro](https://astro-micro.vercel.app/) by [trevortylerlee](https://github.com/trevortylerlee), a fork of [Astro Nano](https://astro-nano-demo.vercel.app/) by [Mark Horn](https://github.com/markhorn-dev).
