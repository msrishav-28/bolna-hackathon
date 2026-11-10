"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const product =
    /^\/(dashboard|practice|history|report|account|preview)(\/|$)/.test(path);
  const live = /^\/practice\/session\/[^/]+$/.test(path);
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {!live && (
        <Header
          key={path}
          product={product}
          preview={path === "/preview"}
          path={path}
        />
      )}
      <div className="flex-1">{children}</div>
      {path !== "/" && !live && (
        <footer className="max-w-[1220px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-10 border-t border-stone flex flex-wrap items-center justify-between gap-4 text-xs text-graphite">
          <span>Samvaad · Practice the moment before you speak.</span>
          <Link href="/privacy" className="editorial-link">
            Your data & privacy
          </Link>
        </footer>
      )}
    </div>
  );
}
