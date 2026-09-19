import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "../lib/account.cjs";
import { adapt } from "./server/route-adapter";

const authenticate = adapt(async (req, res) => {
  try {
    const user = await currentUser(req, res);
    if (!user) {
      res.setHeader("Location", "/?next=%2Fapp");
      return res.status(303).end();
    }
    res.end();
  } catch {
    res
      .status(503)
      .end("We couldn’t open your dashboard. Please try again shortly.");
  }
});
export async function proxy(request: NextRequest) {
  const auth =
    request.nextUrl.pathname === "/app" ? await authenticate(request) : null;
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
  for (const cookie of auth?.headers.getSetCookie() || [])
    response.headers.append("Set-Cookie", cookie);
  return response;
}
export const config = { matcher: ["/", "/app"] };
