import rss from "@astrojs/rss";
import { SITE } from "@consts";
import { getDocuments, getDocumentDate } from "@lib/documents";

export async function GET(context) {
  const items = getDocuments()
    .map((doc) => ({
      ...doc,
      date: getDocumentDate(doc),
    }))
    .filter((doc) => doc.date)
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());

  return rss({
    title: SITE.TITLE,
    description: SITE.DESCRIPTION,
    site: context.site,
    items: items.map((doc) => ({
      title: doc.title,
      description: doc.summary ?? SITE.DESCRIPTION,
      pubDate: doc.date,
      link: doc.canonical,
    })),
  });
}
