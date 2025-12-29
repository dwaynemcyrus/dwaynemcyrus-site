import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import linkIndexRaw from "@data/link-index.json";
import { remarkCallouts } from "@plugins/remark-callouts";
import { remarkWikiLinks } from "@plugins/remark-wiki-links";

const linkIndex = new Map<string, string>(Object.entries(linkIndexRaw));

const processorPromise = createMarkdownProcessor({
  remarkPlugins: [[remarkWikiLinks, { index: linkIndex }], remarkCallouts],
  gfm: true,
  shikiConfig: {
    theme: "css-variables",
  },
});

export async function renderMarkdown(content: string) {
  const processor = await processorPromise;
  return processor.render(content);
}
