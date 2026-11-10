import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./product.css";
import { SiteChrome } from "@/components/product/chrome";

const displayFont = localFont({
  src: [
    {
      path: "../../public/fonts/source-serif-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/source-serif-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/source-serif-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/source-serif-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/source-serif-600-italic.woff2",
      weight: "600",
      style: "italic",
    },
  ],
  variable: "--font-source-serif",
  display: "swap",
});
const bodyFont = localFont({
  src: [
    { path: "../../public/fonts/inter-400-normal.woff2", weight: "400" },
    { path: "../../public/fonts/inter-500-normal.woff2", weight: "500" },
    { path: "../../public/fonts/inter-600-normal.woff2", weight: "600" },
    { path: "../../public/fonts/inter-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: {
    default: "Samvaad — Practice the Moment Before You Speak",
    template: "%s · Samvaad",
  },
  description:
    "A focused voice practice room for students. Prepare your ideas, respond to questions, and build on transcript-based feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="font-sans antialiased">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
