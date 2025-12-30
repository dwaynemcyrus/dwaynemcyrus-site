/**
 * Remark plugin for transforming Obsidian-style callout blocks into styled HTML.
 *
 * @example
 * // Input markdown:
 * > [!note]
 * > This is a note callout with important information.
 *
 * // Output HTML:
 * <div class="callout callout-note" data-callout-type="note" data-callout-title="note">
 *   <p>This is a note callout with important information.</p>
 * </div>
 *
 * @example
 * // Input with custom title:
 * > [!tip] Pro Tip
 * > You can add a custom title after the type.
 *
 * // Output HTML:
 * <div class="callout callout-tip" data-callout-type="tip" data-callout-title="Pro Tip">
 *   <p>You can add a custom title after the type.</p>
 * </div>
 *
 * Supported callout types: note, tip, warning, danger, quote, example
 */
import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const CALLOUT_TYPES = new Set([
  "note",
  "tip",
  "warning",
  "danger",
  "quote",
  "example",
]);

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, "blockquote", (node) => {
      const firstChild = node.children?.[0];
      if (!firstChild || firstChild.type !== "paragraph") {
        return;
      }

      const firstText = firstChild.children?.[0];
      if (!firstText || firstText.type !== "text") {
        return;
      }

      const match = firstText.value.match(/^\[!(\w+)\](?:\s+(.+))?/);
      if (!match) {
        return;
      }

      const [, rawType, customTitle] = match;
      const type = rawType.toLowerCase();
      if (!CALLOUT_TYPES.has(type)) {
        return;
      }

      firstText.value = firstText.value.replace(
        /^\[!\w+\](?:\s+.+)?\s*/,
        "",
      );

      if (!firstText.value) {
        firstChild.children.shift();
      }

      node.data = {
        hName: "div",
        hProperties: {
          className: ["callout", `callout-${type}`],
          "data-callout-type": type,
          "data-callout-title": customTitle || type,
        },
      };
    });
  };
}
