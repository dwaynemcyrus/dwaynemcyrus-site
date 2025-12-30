/**
 * Route configuration for mapping content types to URL paths.
 * This determines how documents are organized into URL structures.
 */

export const contentTypeRoutes = {
  principles: "/library/principles",
  fragments: "/library/fragments",
  essays: "/library/essays",
  directives: "/library/directives",
  everyday: "/library/everyday",
  references: "/library/references",
  books: "/library/books",
  linked: "/library/linked",
  projects: "/engineer/projects",
  notes: "/engineer/notes",
  poetry: "/artist/poetry",
  artwork: "/artist/artwork",
  broadcasts: "/mentor/broadcasts",
  letters: "/mentor/letters",
  diary: "/private/diary",
} as const;

export type ContentType = keyof typeof contentTypeRoutes;

export const landingPages = [
  "/library",
  "/engineer",
  "/artist",
  "/mentor",
] as const;

export type LandingPage = (typeof landingPages)[number];

/**
 * Builds a canonical URL path for a document.
 */
export function buildCanonical(contentType: string, slug: string): string {
  const basePath = contentTypeRoutes[contentType as ContentType];
  if (!basePath) {
    throw new Error(`Unknown content type: ${contentType}`);
  }
  return `${basePath}/${slug}`;
}

/**
 * Returns the content types that belong to a landing page.
 */
export function getContentTypesForLanding(landingPath: string): ContentType[] {
  const prefix = landingPath.endsWith("/") ? landingPath.slice(0, -1) : landingPath;

  return (Object.entries(contentTypeRoutes) as [ContentType, string][])
    .filter(([_, path]) => path.startsWith(`${prefix}/`))
    .map(([contentType]) => contentType);
}

export type RouteConfig = {
  contentTypeRoutes: typeof contentTypeRoutes;
  landingPages: typeof landingPages;
};
