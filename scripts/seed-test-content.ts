/**
 * Seed script to insert test documents into Supabase for testing the build pipeline.
 * Run with: npm run seed
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Simple ULID-like ID generator (timestamp + random)
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const testDocuments = [
  {
    id: generateId("01TEST"),
    title: "Emotional Sovereignty",
    slug: "emotional-sovereignty",
    content_type: "principles",
    summary: "A foundational principle on owning your emotional state regardless of external circumstances.",
    body_md: `# Emotional Sovereignty

Emotional sovereignty is the practice of owning your internal state regardless of external circumstances.

This builds on [[The Practice of Becoming]].

> [!note]
> This is a core principle that underpins much of the work in personal development.

## Core Ideas

When you are emotionally sovereign, you:
- Respond rather than react
- Choose your emotional state deliberately
- Maintain inner peace amid chaos

## Related Ideas

See also [[On Stillness]] for the balance between action and rest.
`,
    metadata: {},
    published_at: "2024-01-15T10:00:00Z",
  },
  {
    id: generateId("01TEST"),
    title: "The Practice of Becoming",
    slug: "the-practice-of-becoming",
    content_type: "principles",
    summary: "The continuous journey of intentional growth and self-development.",
    body_md: `# The Practice of Becoming

Becoming is not a destination but a practice—a daily commitment to intentional growth.

This practice builds on [[Emotional Sovereignty]] and expands through [[Anchored|the system I built]].

> [!tip] Pro Tip
> Start small. One intentional action per day compounds into transformation.

## The Framework

1. **Awareness** - Notice where you are
2. **Intention** - Decide where you want to go
3. **Action** - Take one step today
4. **Reflection** - Learn from the journey

## Daily Practice

Each morning, ask yourself: "Who am I becoming today?"
`,
    metadata: {},
    published_at: "2024-01-12T10:00:00Z",
  },
  {
    id: generateId("01TEST"),
    title: "On Stillness",
    slug: "on-stillness",
    content_type: "fragments",
    summary: "A short reflection on the power of stillness in a chaotic world.",
    body_md: `# On Stillness

A short fragment about balance and pace.

[[Emotional Sovereignty]] returns when the body quiets and the mind follows.

In stillness, we find:
- Clarity of thought
- Depth of feeling
- Space for wisdom

The world moves fast. You don't have to.
`,
    metadata: {},
    published_at: "2024-01-14T10:00:00Z",
  },
  {
    id: generateId("01TEST"),
    title: "Anchored",
    slug: "anchored",
    content_type: "projects",
    summary: "A personal operating system for intentional living.",
    body_md: `# Anchored

Anchored is my personal operating system—a suite of tools to manage time, build habits, and author content.

See also [[Emotional Sovereignty|the guiding principle]] that inspired this project.

> [!warning]
> This project is under active development. Features may change.

## Tech Stack

- **Frontend**: Next.js with TypeScript
- **Backend**: Supabase (Postgres + Auth)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel

## Features

- Document authoring with wiki-links
- Habit tracking and streaks
- Time blocking and review

This project practices what it preaches—built with [[The Practice of Becoming]] in mind.
`,
    metadata: {
      stack: ["Next.js", "Supabase", "Tailwind CSS", "Vercel"],
      repo_url: "https://github.com/example/anchored",
      live_url: "https://anchored.example.com",
    },
    published_at: "2024-01-10T10:00:00Z",
  },
  {
    id: generateId("01TEST"),
    title: "Morning Light",
    slug: "morning-light",
    content_type: "poetry",
    summary: "A poem about the quiet hours before dawn.",
    body_md: `# Morning Light

Before the world wakes,
there is a stillness—
not empty, but full
of unspoken potential.

The light creeps in
through half-drawn curtains,
painting shadows
that dance without music.

I sit with my coffee,
watching the steam rise,
a small ritual
in the temple of morning.

No notifications.
No demands.
Just breath,
and the slow bloom of day.
`,
    metadata: {
      form: "free verse",
      themes: ["morning", "stillness", "ritual"],
    },
    published_at: "2024-01-08T10:00:00Z",
  },
  {
    id: generateId("01TEST"),
    title: "Broken Link Test",
    slug: "broken-link-test",
    content_type: "fragments",
    summary: "A test document with a broken wiki-link.",
    body_md: `# Broken Link Test

This document tests the broken link styling.

Check out [[Non Existent Page]] to see how unresolved links appear.

Also try [[Another Missing Page|with display text]] for the aliased version.

This helps ensure the build pipeline handles missing links gracefully.
`,
    metadata: {},
    published_at: "2024-01-05T10:00:00Z",
  },
];

async function seed() {
  const supabaseUrl = getEnvVar("SUPABASE_URL");
  const siteOwnerId = getEnvVar("SITE_OWNER_ID");

  // Use service role key to bypass RLS for seeding
  // Falls back to anon key if service role not available
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || getEnvVar("SUPABASE_ANON_KEY");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "⚠ SUPABASE_SERVICE_ROLE_KEY not set. Using anon key (may fail due to RLS).\n",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Seeding test documents...\n");

  for (const doc of testDocuments) {
    const record = {
      ...doc,
      user_id: siteOwnerId,
      visibility: "public" as const,
      status: "published" as const,
      created_at: doc.published_at,
      updated_at: doc.published_at,
    };

    const { error } = await supabase.from("documents").upsert(record, {
      onConflict: "user_id,slug",
    });

    if (error) {
      console.error(`✗ Failed to insert "${doc.title}":`, error.message);
    } else {
      console.log(`✓ Inserted: ${doc.title} (${doc.content_type})`);
    }
  }

  console.log("\nSeed complete!");
  console.log("Run 'npm run content:build' to fetch and build the content.");
}

seed().catch((error: Error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
