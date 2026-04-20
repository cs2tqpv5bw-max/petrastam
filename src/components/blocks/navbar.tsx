import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "About", href: "/about" },
  { label: "Courses", href: "/courses" },
  { label: "Consultations", href: "/consultations" },
  { label: "Quantum Hypnosis", href: "/quantum-hypnosis" },
  { label: "Egypt Trip", href: "/egypt-trip" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
];

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pathname, setPathname] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setPathname(window.location.pathname);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex justify-center px-4 transition-all duration-500",
        scrolled ? "pt-3" : "pt-5",
      )}
    >
      <nav
        className={cn(
          // liquid glass core
          "relative w-full max-w-6xl rounded-2xl border transition-all duration-500",
          "border-white/20 dark:border-white/10",
          // glass background + blur
          "bg-white/30 dark:bg-primary/10 backdrop-blur-2xl",
          // saturate for vivid glass
          "[backdrop-filter:blur(40px)_saturate(180%)]",
          // shadow
          scrolled
            ? "shadow-[0_8px_40px_rgba(82,68,151,0.18)] dark:shadow-[0_8px_40px_rgba(82,68,151,0.35)]"
            : "shadow-[0_4px_24px_rgba(82,68,151,0.10)]",
          // inner highlight
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/30 before:to-transparent before:dark:from-white/10",
        )}
      >
        <div className="relative flex items-center justify-between px-5 py-3">
          {/* Logo */}
          <a href="/" className="flex shrink-0 items-center gap-2">
            <img
              src="/logo.png"
              alt="Petra Stam"
              height={36}
              className="h-9 w-auto object-contain"
              onError={(e) => {
                // fallback to svg if png not found
                (e.target as HTMLImageElement).src = "/logo.svg";
              }}
            />
          </a>

          {/* Desktop Navigation */}
          <ul className="hidden items-center gap-0.5 xl:flex">
            {ITEMS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                    "text-foreground/80 hover:text-foreground hover:bg-white/40 dark:hover:bg-white/10",
                    pathname === link.href &&
                      "text-primary bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/shop" className="hidden xl:block">
              <Button
                size="sm"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                Shop
              </Button>
            </a>

            {/* Hamburger (mobile) */}
            <button
              className="text-foreground relative flex size-8 xl:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <div className="absolute top-1/2 left-1/2 block w-[18px] -translate-x-1/2 -translate-y-1/2">
                <span
                  aria-hidden="true"
                  className={`absolute block h-0.5 w-full rounded-full bg-current transition duration-500 ease-in-out ${isMenuOpen ? "rotate-45" : "-translate-y-1.5"}`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute block h-0.5 w-full rounded-full bg-current transition duration-500 ease-in-out ${isMenuOpen ? "opacity-0" : ""}`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute block h-0.5 w-full rounded-full bg-current transition duration-500 ease-in-out ${isMenuOpen ? "-rotate-45" : "translate-y-1.5"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out xl:hidden",
            isMenuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="border-t border-white/20 px-5 py-4">
            <nav className="divide-border/50 flex flex-col divide-y">
              {ITEMS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={cn(
                    "text-foreground/80 hover:text-foreground py-3 text-base font-medium transition-colors first:pt-0 last:pb-0",
                    pathname === link.href && "text-primary",
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/shop"
                className="pt-4"
                onClick={() => setIsMenuOpen(false)}
              >
                <Button className="w-full bg-primary text-primary-foreground">
                  Shop
                </Button>
              </a>
            </nav>
          </div>
        </div>
      </nav>
    </header>
  );
};
