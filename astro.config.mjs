import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";

import { remarkWikiLinks } from "./src/plugins/remark-wiki-links";
import { remarkCallouts } from "./src/plugins/remark-callouts";
import linkIndex from "./src/data/link-index.json";

// https://astro.build/config
export default defineConfig({
  output: "static",
  site: "https://dwaynemcyrus.com",
  integrations: [sitemap(), mdx(), pagefind()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    remarkPlugins: [
      [remarkWikiLinks, { indexJson: linkIndex }],
      remarkCallouts,
    ],
    shikiConfig: {
      theme: "css-variables",
    },
  },
});
