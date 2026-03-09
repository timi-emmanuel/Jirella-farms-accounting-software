"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

type HatcheryMetrics = {
  totalBroodstockFeedCost: number;
  totalHormoneCost: number;
  totalMaleFishCost: number;
  otherExpenses: number;
  totalFryProduced: number;
  totalTransferValue: number;
};

const empty: HatcheryMetrics = {
  totalBroodstockFeedCost: 0,
  totalHormoneCost: 0,
  totalMaleFishCost: 0,
  otherExpenses: 0,
  totalFryProduced: 0,
  totalTransferValue: 0,
};

export function CatfishHatcheryFinancials() {
  const [metrics, setMetrics] = useState<HatcheryMetrics>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const response = await fetch("/api/catfish/hatchery/financials");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ title: "Error", description: payload.error || "Failed to load hatchery financials", variant: "destructive" });
        setMetrics(empty);
      } else {
        setMetrics(payload.metrics || empty);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const cards = [
    { label: "Total Broodstock Feed Cost", value: `N ${metrics.totalBroodstockFeedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Total Hormone Cost", value: `N ${metrics.totalHormoneCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Total Male Fish Cost", value: `N ${metrics.totalMaleFishCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Other Hatchery Expenses", value: `N ${metrics.otherExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Total Fry Produced", value: metrics.totalFryProduced.toLocaleString() },
    { label: "Total Transfer Value", value: `N ${metrics.totalTransferValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
