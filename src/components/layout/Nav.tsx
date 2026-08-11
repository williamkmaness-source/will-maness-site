// Nav.tsx — site-wide top navigation. Wordmark on left, four links on right.
// "Say hi" scrolls to the about page contact section; on other pages it links to /about#say-hi.
// Active link highlighting is handled by next/navigation's usePathname (client-side hook),
// which is why this component is marked "use client". Everything else on the site is server.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "./Container";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navLinks = [
  { href: "/work", label: "Work" },
  { href: "/writing", label: "Writing" },
  { href: "/about", label: "About" },
  { href: "/about#say-hi", label: "Say hi" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header>
      <Container>
        <nav
          className="flex items-center justify-between pt-[32px] mb-[80px]"
          aria-label="Site navigation"
        >
          <Link
            href="/"
            className="font-serif italic text-[21px] font-medium text-ink no-underline tracking-[-0.01em] transition-colors duration-[120ms] hover:text-accent"
          >
            Will Maness
          </Link>

          <div className="flex items-center gap-[32px]">
            <ul className="flex gap-[32px] list-none m-0 p-0" role="list">
              {navLinks.map(({ href, label }) => {
                const isActive =
                  href === "/about#say-hi"
                    ? false
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "font-sans text-[14px] font-normal no-underline transition-colors duration-[120ms]",
                        isActive ? "text-accent" : "text-ink hover:text-accent"
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ThemeToggle />
          </div>
        </nav>
      </Container>
    </header>
  );
}
