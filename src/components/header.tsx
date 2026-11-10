"use client";
import Link from "next/link";
import { useState } from "react";
export function Header({
  product = false,
  preview = false,
  path = "/",
}: {
  product?: boolean;
  preview?: boolean;
  path?: string;
}) {
  const [open, setOpen] = useState(false);
  const links = product
    ? [
        {
          href: preview ? "/preview?screen=setup" : "/practice",
          label: "Practice Studio",
        },
        {
          href: preview ? "/preview?screen=history" : "/history",
          label: "Past Sessions & Progress",
        },
      ]
    : [
        { href: "/#how-it-works", label: "How It Works" },
        { href: "/#topics-catalogue", label: "Practice Prompts" },
        { href: "/#scorecard-specimen", label: "Sample Scorecard" },
        { href: "/#faq", label: "FAQ" },
      ];
  return (
    <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur-sm border-b border-stone">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/"
            aria-label="Samvaad home"
            className="font-sans text-[10px] sm:text-sm font-bold uppercase tracking-[0.14em] text-ink flex items-center gap-2 shrink-0"
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-clay"
              aria-hidden="true"
            />
            Samvaad
          </Link>
          <nav
            aria-label="Primary navigation"
            className={
              product
                ? "hidden lg:flex items-center gap-1.5 bg-oat p-1 rounded-xl border border-stone"
                : "hidden lg:flex items-center gap-6"
            }
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={path === link.href ? "page" : undefined}
                className={
                  product
                    ? `px-3 py-1.5 rounded-lg text-xs ${path === link.href ? "bg-paper font-semibold shadow-xs" : "text-graphite hover:text-ink"}`
                    : "text-sm font-medium text-graphite hover:text-ink whitespace-nowrap"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {product ? (
            <Link
              className="btn-ivory-tab px-3 py-2 text-xs font-medium"
              href={preview ? "/preview?screen=account" : "/account"}
            >
              Account
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="hidden sm:inline-flex text-sm font-medium text-graphite"
              >
                Sign in
              </Link>
              <Link
                href="/practice"
                className="btn-clay-tab px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap"
              >
                <span className="hidden sm:inline">Start Practicing</span>
                <span className="sm:hidden">Practice</span>
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="lg:hidden px-3 py-2 rounded-xl border border-stone bg-paper text-xs font-mono"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (
                e.currentTarget.previousElementSibling?.querySelector(
                  '[aria-controls="mobile-navigation"]',
                ) as HTMLButtonElement
              )?.focus();
            }
          }}
          className="lg:hidden border-t border-stone px-4 py-4 flex flex-wrap gap-3 bg-paper"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm rounded-lg border border-stone"
            >
              {link.label}
            </Link>
          ))}
          {!product && (
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
