"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  batchId: string;
  basePath?: string;
  tabs?: Array<{ label: string; suffix: string }>;
  hideFinanceTab?: boolean;
  hideSalesTab?: boolean;
};

const defaultTabs = [
  { label: "Overview", suffix: "" },
  { label: "Daily Logs", suffix: "/logs" },
  { label: "Sales", suffix: "/sales" },
  { label: "Finances", suffix: "/finance" },
];

export function CatfishBatchTabs({
  batchId,
  basePath = "/catfish/fingerlings",
  tabs = defaultTabs,
  hideFinanceTab = false,
  hideSalesTab = false
}: Props) {
  const pathname = usePathname();
  const base = `${basePath}/${batchId}`;
  const visibleTabs = tabs.filter((tab) => {
    if (hideFinanceTab && tab.suffix === "/finance") return false;
    if (hideSalesTab && tab.suffix === "/sales") return false;
    return true;
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleTabs.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                : "text-slate-700 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
