import { NextResponse } from "next/server";
import { authClient } from "@/lib/server/supabase";
import { safeNext } from "@/lib/domain/safe-next";
export async function GET(r: Request) {
  const url = new URL(r.url);
  const base = process.env.APP_ORIGIN || url.origin;
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (
      await authClient()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeNext(url.searchParams.get("next")), base),
      );
  }
  return NextResponse.redirect(new URL("/auth?error=link", base));
}
