 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

const tabs = [
  { label: "Broodstock Logs", href: "/catfish/hatchery/broodstock" },
  { label: "Spawning Events", href: "/catfish/hatchery/spawning" },
  { label: "Fry Transfers", href: "/catfish/hatchery/transfers" },
  { label: "Hatchery Financials", href: "/catfish/hatchery/financials" },
];

export default function CatfishHatcheryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useUserRole();
  const visibleTabs = role === "CATFISH_STAFF"
    ? tabs.filter((tab) => !["/catfish/hatchery/financials", "/catfish/hatchery/transfers"].includes(tab.href))
    : tabs;

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto modal-scrollbar pr-2">
      <div className="flex flex-wrap items-center gap-2">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === tab.href
                ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                : "text-slate-700 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
