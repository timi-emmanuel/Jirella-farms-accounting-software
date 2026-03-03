"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type FinanceData = {
  batchId: string;
  batchName: string;
  status: string;
  startDate: string;
  initialStock: number;
  currentStock: number;
  totalSold: number;
  totalMortality: number;
  latestAbwGrams: number;
  totalBiomassKg: number;
  totalFeedKg: number;
  totalFeedCost: number;
  seedCost: number;
  otherExpenses: number;
  totalOperationalCost: number;
  totalExpenses: number;
  totalExternalRevenue: number;
  transferRevenue: number;
  totalRevenue: number;
  grossProfit: number;
  profitMargin: number | null;
  costPerFish: number | null;
  costPerKg: number | null;
  feedCostSharePercent: number | null;
};

const money = (value: number | null | undefined) =>
  `N${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const metric = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined
    ? "-"
    : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;

type Props = {
  stage?: 'fingerlings' | 'juvenile' | 'melange';
  stageLabel?: string;
};

export function CatfishBatchFinance({ stage = 'fingerlings', stageLabel = 'Fingerlings' }: Props) {
  const params = useParams();
  const batchId = (params?.batchId as string) || (params?.id as string);
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!batchId) return;
      setLoading(true);
      const response = await fetch(`/api/catfish/${stage}/${batchId}/finance`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Catfish batch finance fetch error:", payload.error || response.statusText);
        setData(null);
      } else {
        setData(payload.finance || null);
      }
      setLoading(false);
    };

    loadData();
  }, [batchId, stage]);

  const profitState = useMemo(() => {
    const value = Number(data?.grossProfit || 0);
    if (value > 0) return { label: "Profitable", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (value < 0) return { label: "Loss", className: "bg-rose-100 text-rose-800 border-rose-200" };
    return { label: "Break-even", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }, [data?.grossProfit]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-emerald-600" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-slate-500">Unable to load financial data for this batch.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {stageLabel} <span className="text-emerald-600">Finances</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Batch-level revenue, costs, and profitability snapshot.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Cost</p>
          <p className="text-lg font-bold text-slate-900 mt-2">{money(data.totalExpenses)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Feed Cost</p>
          <p className="text-lg font-bold text-slate-900 mt-2">{money(data.totalFeedCost)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Revenue</p>
          <p className="text-lg font-bold text-slate-900 mt-2">{money(data.totalRevenue)}</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Gross Profit</p>
          <p className="text-lg font-bold text-slate-900 mt-2">{money(data.grossProfit)}</p>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Profitability</h2>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${profitState.className}`}>
            {profitState.label}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Margin</p>
            <p className="text-base font-bold text-slate-900 mt-1">{metric(data.profitMargin, "%")}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Cost per Fish</p>
            <p className="text-base font-bold text-slate-900 mt-1">{data.costPerFish === null ? "-" : money(data.costPerFish)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Cost per Kg</p>
            <p className="text-base font-bold text-slate-900 mt-1">{data.costPerKg === null ? "-" : money(data.costPerKg)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Current Stock</p>
            <p className="text-base font-bold text-slate-900 mt-1">{Number(data.currentStock || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Cost Breakdown</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Feed share of total cost</span>
            <span className="font-semibold text-slate-900">
              {data.feedCostSharePercent === null ? "-" : `${metric(data.feedCostSharePercent)}%`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.max(0, Math.min(100, Number(data.feedCostSharePercent || 0)))}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Seed Cost (Capital)</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.seedCost)}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Feed Cost (Operational)</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.totalFeedCost)}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Other Expenses</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.otherExpenses)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Sources</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">External Sales</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.totalExternalRevenue)}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Transfer Valuation</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.transferRevenue)}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Revenue</p>
            <p className="text-base font-bold text-slate-900 mt-1">{money(data.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Biomass (Kg)</p>
            <p className="text-base font-bold text-slate-900 mt-1">{metric(data.totalBiomassKg)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
