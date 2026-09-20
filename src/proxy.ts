import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "../lib/account.cjs";
import { workspaceRoute } from "../lib/authorization.cjs";
import { adapt } from "./server/route-adapter";

const authenticate = (path: string) => adapt(async (req, res) => {
  try {
    const user = await currentUser(req, res);
    if (!user) {
      res.setHeader("Location", "/?next=" + encodeURIComponent(path));
      return res.status(303).end();
    }
    const access = workspaceRoute(user, path);
    if (access.location) res.setHeader("Location", access.location);
    res.status(access.status).end(access.error);
  } catch {
    res
      .status(503)
      .end("We couldn’t open your dashboard. Please try again shortly.");
  }
});
export async function proxy(request: NextRequest) {
  const auth =
    request.nextUrl.pathname === "/app" || request.nextUrl.pathname.startsWith("/app/")
      ? await authenticate(request.nextUrl.pathname)(request) : null;
  if (auth && auth.status !== 200) {
    if (auth.headers.has("Location"))
      auth.headers.set(
        "Location",
        new URL(auth.headers.get("Location")!, request.url).href,
      );
    return auth;
  }
  const nonce = btoa(crypto.randomUUID());
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://turncal.com; object-src 'none'; base-uri 'none'; form-action 'self'${process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : ""}`;
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  if (request.nextUrl.pathname === "/" && ['join', 't', 'reset', 'next'].some(key => request.nextUrl.searchParams.has(key))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  }
  for (const cookie of auth?.headers.getSetCookie() || [])
    response.headers.append("Set-Cookie", cookie);
  return response;
}
export const config = { matcher: ["/", "/quote", "/login", "/register", "/app/:path*", "/airbnb-cleaning/:path*", "/software/airbnb-cleaning", "/cleaners/airbnb-cleaning-jobs"] };
