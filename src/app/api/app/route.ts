import { NextResponse } from "next/server";
// Compatibility for old dashboard links. Rendering lives only at /app.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/app", request.url), 303);
}
