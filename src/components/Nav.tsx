"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./client";

const TABS = [
  { href: "/", label: "Today", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/train", label: "Train", icon: "M2 12h2m16 0h2M6 7v10M9 5v14m6-14v14m3-12v10M9 12h6" },
  { href: "/trends", label: "Trends", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/recipes", label: "Recipes", icon: "M6 3v8a3 3 0 006 0V3M9 3v18M17 3c-2 2-2 6 0 8v10" },
  { href: "/settings", label: "Goals", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3m0 14v3M2 12h3m14 0h3" },
];

export function Nav() {
  const path = usePathname();
  const [training, setTraining] = useState(false);
  useEffect(() => {
    api.get<{ id: number } | null>("/api/train/active").then((a) => setTraining(a !== null)).catch(() => setTraining(false));
  }, [path]);
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" || path === "/nutrients" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-accent" : "text-muted"}`}
              >
                {t.href === "/train" && training && (
                  <span className="absolute right-[calc(50%-16px)] top-1.5 h-2 w-2 animate-pulse rounded-full bg-burn" aria-label="Workout in progress" />
                )}
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
