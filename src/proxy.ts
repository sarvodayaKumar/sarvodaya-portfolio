import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BLOG_HOST, isApexHost, isBlogHost } from "@/lib/site";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname.startsWith("/apple-icon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (isBlogHost(host)) {
    if (pathname === "/blog" || pathname.startsWith("/blog/")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/blog/, "") || "/";
      return NextResponse.redirect(url, 308);
    }

    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/blog" : `/blog${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isApexHost(host) && (pathname === "/blog" || pathname.startsWith("/blog/"))) {
    const destPath = pathname.replace(/^\/blog/, "") || "/";
    return NextResponse.redirect(new URL(`https://${BLOG_HOST}${destPath}${search}`), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
