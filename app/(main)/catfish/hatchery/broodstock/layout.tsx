"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { Egg, Truck, TrendingUp, DollarSign, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const tabs = [
  { label: "Broodstock Logs", href: "/catfish/hatchery/broodstock", icon: Egg },
  { label: "Spawning Events", href: "/catfish/hatchery/spawning", icon: Truck },
  { label: "Fry Transfers", href: "/catfish/hatchery/transfers", icon: TrendingUp },
  { label: "Hatchery Financials", href: "/catfish/hatchery/financials", icon: DollarSign },
];

export default function CatfishHatcheryBroodstockLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useUserRole();
  
  // Hide financials and transfers for staff
  const visibleTabs = role === "CATFISH_STAFF"
    ? tabs.filter((tab) => !["/catfish/hatchery/financials", "/catfish/hatchery/transfers"].includes(tab.href))
    : tabs;

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto modal-scrollbar">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Catfish <span className="text-emerald-600">Broodstock Operations</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Detailed tracking of broodstock care, spawning events, and fry transfers.
          </p>
        </div>
        <Link href="/catfish/hatchery/dashboard">
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200",
                isActive
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
