import type { ReactNode } from "react";
import Link from "next/link";
import { Film, FolderKanban, LibraryBig, Settings } from "lucide-react";

const nav = [
  { href: "/", label: "Bibliothèque", icon: LibraryBig },
  { href: "/groups", label: "Sources", icon: FolderKanban },
  { href: "/settings", label: "Compte", icon: Settings },
];

export function AppShell({ children, active }: { children: ReactNode; active: "library" | "groups" | "settings" }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08090a] text-[#f7f8f8] antialiased">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col md:flex-row">
        <aside className="w-full overflow-x-hidden border-b border-white/[0.06] bg-[#0b0c0d]/95 px-3 py-3 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r md:px-4 md:py-5">
          <div className="flex items-center justify-between md:block">
            <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5e6ad2] text-white"><Film className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-medium tracking-[-0.01em]">Telegram Vault</span>
                <span className="hidden text-xs text-[#8a8f98] md:block">Media library</span>
              </span>
            </Link>
          </div>
          <nav className="mt-3 grid grid-cols-3 gap-1 md:mt-8 md:flex md:flex-col">
            {nav.map((item) => {
              const Icon = item.icon;
              const selected = (active === "library" && item.href === "/") || (active === "groups" && item.href === "/groups") || (active === "settings" && item.href === "/settings");
              return (
                <Link key={item.href} href={item.href} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition md:justify-start md:px-3 ${selected ? "bg-white/[0.07] text-[#f7f8f8]" : "text-[#8a8f98] hover:bg-white/[0.04] hover:text-[#d0d6e0]"}`}>
                  <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}
