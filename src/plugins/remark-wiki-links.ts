/**
 * Remark plugin for resolving wiki-links to proper URLs.
 * Transforms [[Page Title]] and [[slug|Display Text]] to anchor tags.
 *
 * @example
 * // Input markdown:
 * "Check out [[Emotional Sovereignty]] for more."
 *
 * // Output (resolved - target exists in index):
 * "Check out <a href="/library/principles/emotional-sovereignty" class="wiki-link">Emotional Sovereignty</a> for more."
 *
 * // Input with display text:
 * "See [[emotional-sovereignty|my sovereignty essay]] here."
 *
 * // Output (resolved):
 * "See <a href="/library/principles/emotional-sovereignty" class="wiki-link">my sovereignty essay</a> here."
 *
 * // Output (unresolved - target not in index):
 * "Check out <span class="wiki-link-broken" title="Page not found">Unknown Page</span> for more."
 */
import { visit } from "unist-util-visit";
import type { Parent, PhrasingContent, Root } from "mdast";
import type { WikiLinkIndex, WikiLinkIndexJson } from "@lib/wiki-links";

type Options = {
  /**
   * The link index as a Map. Takes precedence over indexJson.
   */
  index?: WikiLinkIndex;
  /**
   * The link index as a plain object (from JSON).
   * Will be converted to a Map internally.
   */
  indexJson?: WikiLinkIndexJson;
};

/**
 * Creates a remark plugin that transforms wiki-links to anchor tags.
 *
 * Usage in astro.config.mjs:
 * ```js
 * import linkIndex from './src/data/link-index.json';
 * import { remarkWikiLinks } from './src/plugins/remark-wiki-links';
 *
 * export default defineConfig({
 *   markdown: {
 *     remarkPlugins: [
 *       [remarkWikiLinks, { indexJson: linkIndex }]
 *     ]
 *   }
 * });
 * ```
 */
export function remarkWikiLinks(options: Options = {}) {
  // Build the index Map from either source
  let index: WikiLinkIndex;

  if (options.index) {
    index = options.index;
  } else if (options.indexJson) {
    index = new Map(Object.entries(options.indexJson));
  } else {
    // Empty index - all links will be broken
    index = new Map();
  }

  return (tree: Root) => {
    visit(tree, "text", (node, nodeIndex, parent) => {
      if (!parent || typeof nodeIndex !== "number") {
        return;
      }

      const parentNode = parent as Parent;
      if (!Array.isArray(parentNode.children)) {
        return;
      }

      const value = node.value;
      const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

      // Quick check before doing full regex work
      if (!value.includes("[[")) {
        return;
      }

      const newChildren: PhrasingContent[] = [];
      let lastIndex = 0;
      let match;

      while ((match = wikiLinkRegex.exec(value)) !== null) {
        const [full, target, display] = match;
        const normalizedTarget = target.toLowerCase().trim();
        const resolved = index.get(normalizedTarget);

        // Add text before the link
        if (match.index > lastIndex) {
          newChildren.push({
            type: "text",
            value: value.slice(lastIndex, match.index),
          });
        }

        if (resolved) {
          // Resolved wiki-link → anchor tag
          newChildren.push({
            type: "link",
            url: resolved,
            children: [{ type: "text", value: display || target }],
            data: {
              hProperties: {
                className: ["wiki-link"],
              },
            },
          });
        } else {
          // Unresolved wiki-link → styled span
          newChildren.push({
            type: "html",
            value: `<span class="wiki-link-broken" title="Page not found">${display || target}</span>`,
          });
        }

        lastIndex = match.index + full.length;
      }

      // Add remaining text after last link
      if (lastIndex < value.length) {
        newChildren.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      // Replace the text node with new children
      if (newChildren.length > 0) {
        parentNode.children.splice(
          nodeIndex,
          1,
          ...(newChildren as Parent["children"]),
        );
        // Return new index to continue visiting correctly
        return nodeIndex + newChildren.length;
      }
    });
  };
}
