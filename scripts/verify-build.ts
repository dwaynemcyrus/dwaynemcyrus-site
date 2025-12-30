/**
 * Verification script for the content build pipeline.
 * Loads generated JSON files and validates the build output.
 *
 * Run with: npx tsx scripts/verify-build.ts
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "src", "data");

interface Document {
  id: string;
  title: string;
  slug: string;
  content_type: string;
  collection: string;
  canonical: string;
  body_md: string;
}

interface BacklinkEntry {
  title: string;
  canonical: string;
  excerpt?: string;
}

type BacklinkMap = Record<string, BacklinkEntry[]>;
type LinkIndex = Record<string, string>;

function loadJson<T>(filename: string): T | null {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`✗ Missing: ${filename}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function verify() {
  console.log("=".repeat(60));
  console.log("BUILD VERIFICATION REPORT");
  console.log("=".repeat(60));
  console.log();

  // Load files
  const documents = loadJson<Document[]>("documents.json");
  const linkIndex = loadJson<LinkIndex>("link-index.json");
  const backlinks = loadJson<BacklinkMap>("backlinks.json");

  if (!documents || !linkIndex || !backlinks) {
    console.error("\n✗ Build verification failed: Missing JSON files");
    process.exit(1);
  }

  // Documents summary
  console.log("DOCUMENTS");
  console.log("-".repeat(40));
  console.log(`Total: ${documents.length} documents\n`);

  const byType: Record<string, number> = {};
  for (const doc of documents) {
    byType[doc.content_type] = (byType[doc.content_type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`);
  }

  // Link index summary
  console.log("\nLINK INDEX");
  console.log("-".repeat(40));
  const indexEntries = Object.keys(linkIndex).length;
  const uniqueCanonicals = new Set(Object.values(linkIndex)).size;
  console.log(`Total entries: ${indexEntries}`);
  console.log(`Unique canonicals: ${uniqueCanonicals}`);
  console.log(`Entries per document: ~${(indexEntries / uniqueCanonicals).toFixed(1)}`);

  // Backlinks summary
  console.log("\nBACKLINKS");
  console.log("-".repeat(40));
  const pagesWithBacklinks = Object.values(backlinks).filter((b) => b.length > 0).length;
  const totalBacklinks = Object.values(backlinks).reduce((sum, b) => sum + b.length, 0);
  console.log(`Pages with backlinks: ${pagesWithBacklinks}/${Object.keys(backlinks).length}`);
  console.log(`Total backlink entries: ${totalBacklinks}`);

  // Top linked pages
  console.log("\nMost linked pages:");
  const sorted = Object.entries(backlinks)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);
  for (const [canonical, links] of sorted) {
    if (links.length > 0) {
      console.log(`  ${canonical}: ${links.length} backlinks`);
    }
  }

  // Verify specific test cases
  console.log("\nTEST CASES");
  console.log("-".repeat(40));

  let passed = 0;
  let failed = 0;

  // Test 1: Emotional Sovereignty has backlinks
  const esBacklinks = backlinks["/library/principles/emotional-sovereignty"] || [];
  if (esBacklinks.length >= 2) {
    console.log("✓ Emotional Sovereignty has backlinks");
    passed++;
  } else {
    console.log("✗ Emotional Sovereignty missing backlinks");
    failed++;
  }

  // Test 2: The Practice of Becoming has backlinks
  const tpobBacklinks = backlinks["/library/principles/the-practice-of-becoming"] || [];
  if (tpobBacklinks.length >= 1) {
    console.log("✓ The Practice of Becoming has backlinks");
    passed++;
  } else {
    console.log("✗ The Practice of Becoming missing backlinks");
    failed++;
  }

  // Test 3: Link index has title keys
  if (linkIndex["emotional sovereignty"]) {
    console.log("✓ Link index contains title keys (lowercase)");
    passed++;
  } else {
    console.log("✗ Link index missing title keys");
    failed++;
  }

  // Test 4: Link index has slug keys
  if (linkIndex["emotional-sovereignty"]) {
    console.log("✓ Link index contains slug keys");
    passed++;
  } else {
    console.log("✗ Link index missing slug keys");
    failed++;
  }

  // Test 5: Canonicals are correct format
  const sampleDoc = documents.find((d) => d.slug === "emotional-sovereignty");
  if (sampleDoc?.canonical === "/library/principles/emotional-sovereignty") {
    console.log("✓ Canonicals are correctly computed");
    passed++;
  } else {
    console.log("✗ Canonicals are incorrect");
    failed++;
  }

  // Test 6: Bidirectional linking works
  const esLinksToTpob = esBacklinks.some(
    (b) => b.canonical === "/library/principles/the-practice-of-becoming"
  );
  const tpobLinksToEs = tpobBacklinks.some(
    (b) => b.canonical === "/library/principles/emotional-sovereignty"
  );
  if (esLinksToTpob && tpobLinksToEs) {
    console.log("✓ Bidirectional linking works");
    passed++;
  } else {
    console.log("✗ Bidirectional linking broken");
    failed++;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  if (failed === 0) {
    console.log(`✓ ALL TESTS PASSED (${passed}/${passed + failed})`);
  } else {
    console.log(`✗ SOME TESTS FAILED (${passed}/${passed + failed} passed)`);
    process.exit(1);
  }
  console.log("=".repeat(60));
}

verify();
