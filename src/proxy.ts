import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  // Reject before streaming begins; page-level notFound can otherwise return 200.
  if (
    request.nextUrl.pathname === "/preview" &&
    process.env.UI_PREVIEW_ENABLED !== "true"
  ) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  let response = NextResponse.next({ request });
  if (
    ["/api/health", "/api/internal/reconcile"].includes(
      request.nextUrl.pathname,
    )
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
