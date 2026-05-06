// app/layout.tsx — root layout. Wraps every page on the site.
// Loads Newsreader via next/font (self-hosted, zero Google requests at runtime).
// Injects the font as a CSS variable so globals.css --font-serif fallback chain works.
// Renders Nav and Footer around {children} so they appear on every route.
// See docs/concepts.md#next-font and docs/concepts.md#server-components.

import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

const newsreader = Newsreader({
  subsets: ["latin"],
  // Weight 400 and 500 — the only two weights used in the design system.
  weight: ["400", "500"],
  // Italic style needed for deks, asides, and the wordmark.
  style: ["normal", "italic"],
  display: "swap",
  // Exposes the font as var(--font-newsreader), referenced in globals.css @theme.
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://willmaness.com"),
  title: "Will Maness",
  description:
    "Strategy and operating background, spending time in the trenches with the AI-and-data stack.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body className="bg-bg text-ink font-sans antialiased flex flex-col min-h-dvh">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
