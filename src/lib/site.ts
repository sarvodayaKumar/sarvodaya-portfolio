export const SITE_HOST = process.env.NEXT_PUBLIC_SITE_HOST ?? "sarvodaya.dev";
export const BLOG_HOST = process.env.NEXT_PUBLIC_BLOG_HOST ?? "blog.sarvodaya.dev";

export function hostname(hostHeader: string) {
  return hostHeader.split(":")[0]?.toLowerCase() ?? "";
}

export function isBlogHost(hostHeader: string) {
  const host = hostname(hostHeader);
  return host === BLOG_HOST || host.startsWith("blog.");
}

export function isApexHost(hostHeader: string) {
  const host = hostname(hostHeader);
  return host === SITE_HOST || host === `www.${SITE_HOST}`;
}

export function navUrls(hostHeader: string) {
  if (isBlogHost(hostHeader)) {
    return {
      homeHref: `https://${SITE_HOST}`,
      blogHref: "/",
    };
  }

  if (isApexHost(hostHeader)) {
    return {
      homeHref: "/",
      blogHref: `https://${BLOG_HOST}`,
    };
  }

  return {
    homeHref: "/",
    blogHref: "/blog",
  };
}

export function postsIndexHref(hostHeader: string) {
  if (isBlogHost(hostHeader)) return "/";
  if (isApexHost(hostHeader)) return `https://${BLOG_HOST}`;
  return "/blog";
}

export function postHref(hostHeader: string, slug: string) {
  if (isBlogHost(hostHeader)) return `/${slug}`;
  if (isApexHost(hostHeader)) return `https://${BLOG_HOST}/${slug}`;
  return `/blog/${slug}`;
}
