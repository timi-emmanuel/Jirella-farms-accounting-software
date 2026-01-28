"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Factory, Fish, Egg, Bug, Wallet, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PoultryMetrics = {
  totalEggs: number;
  totalFeedKg: number;
  currentLiveBirds: number;
  totalSales: number;
  profit: number;
};

type CatfishMetrics = {
  totalFeedKg: number;
  totalHarvestKg: number;
  survivalRate: number;
  totalRevenue: number;
  activeBatches: number;
};

type BsfMetrics = {
  totalFeedKg: number;
  totalWetLarvaeKg: number;
  fcr: number;
  breedingEfficiency: number;
  oilExtractionRate: number;
};

type FeedMillStats = {
  stockItems: number;
  totalStockKg: number;
  salesRevenue: number;
};

const emptyPoultry: PoultryMetrics = {
  totalEggs: 0,
  totalFeedKg: 0,
  currentLiveBirds: 0,
  totalSales: 0,
  profit: 0,
};

const emptyCatfish: CatfishMetrics = {
  totalFeedKg: 0,
  totalHarvestKg: 0,
  survivalRate: 0,
  totalRevenue: 0,
  activeBatches: 0,
};

const emptyBsf: BsfMetrics = {
  totalFeedKg: 0,
  totalWetLarvaeKg: 0,
  fcr: 0,
  breedingEfficiency: 0,
  oilExtractionRate: 0,
};

const emptyFeedMill: FeedMillStats = {
  stockItems: 0,
  totalStockKg: 0,
  salesRevenue: 0,
};

const formatCurrency = (value: number) =>
  `₦ ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const formatKg = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MainDashboard() {
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [poultry, setPoultry] = useState<PoultryMetrics>(emptyPoultry);
  const [catfish, setCatfish] = useState<CatfishMetrics>(emptyCatfish);
  const [bsf, setBsf] = useState<BsfMetrics>(emptyBsf);
  const [feedMill, setFeedMill] = useState<FeedMillStats>(emptyFeedMill);

  const loadAll = async () => {
    setLoading(true);
    const [poultryRes, catfishRes, bsfRes, feedStockRes, feedSalesRes] = await Promise.all([
      fetch(`/api/poultry/dashboard?from=${from}&to=${to}`),
      fetch(`/api/catfish/dashboard?from=${from}&to=${to}`),
      fetch(`/api/bsf/dashboard?from=${from}&to=${to}`),
      fetch(`/api/finished-goods/location?code=FEED_MILL&module=FEED_MILL&onlyInStock=true`),
      fetch(`/api/sales?module=FEED_MILL`),
    ]);

    const poultryPayload = await poultryRes.json().catch(() => ({}));
    const catfishPayload = await catfishRes.json().catch(() => ({}));
    const bsfPayload = await bsfRes.json().catch(() => ({}));
    const feedStockPayload = await feedStockRes.json().catch(() => ({}));
    const feedSalesPayload = await feedSalesRes.json().catch(() => ({}));

    if (poultryRes.ok) setPoultry(poultryPayload.metrics || emptyPoultry);
    if (catfishRes.ok) setCatfish(catfishPayload.metrics || emptyCatfish);
    if (bsfRes.ok) setBsf(bsfPayload.metrics || emptyBsf);

    if (feedStockRes.ok) {
      const items = feedStockPayload.items || [];
      const totalStockKg = items.reduce((sum: number, item: any) => {
        const unitSize = Number(item.unitSizeKg || 0);
        const qty = Number(item.quantityOnHand || 0);
        if (item.unit === "BAG" && unitSize > 0) return sum + qty * unitSize;
        return sum + qty;
      }, 0);
      setFeedMill((prev) => ({
        ...prev,
        stockItems: items.length,
        totalStockKg,
      }));
    }

    if (feedSalesRes.ok) {
      const sales = feedSalesPayload.sales || [];
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T23:59:59`);
      const revenue = sales.reduce((sum: number, row: any) => {
        const soldAt = row.soldAt ? new Date(row.soldAt) : null;
        if (!soldAt || soldAt < fromDate || soldAt > toDate) return sum;
        return sum + Number(row.quantitySold || 0) * Number(row.unitSellingPrice || 0);
      }, 0);
      setFeedMill((prev) => ({ ...prev, salesRevenue: revenue }));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const poultryStats = useMemo(() => ([
    { label: "Eggs Collected", value: poultry.totalEggs.toLocaleString() },
    { label: "Live Birds", value: poultry.currentLiveBirds.toLocaleString() },
    { label: "Feed Used (kg)", value: formatKg(poultry.totalFeedKg) },
    { label: "Profit", value: formatCurrency(poultry.profit) },
  ]), [poultry]);

  const catfishStats = useMemo(() => ([
    { label: "Active Batches", value: catfish.activeBatches.toLocaleString() },
    { label: "Feed Used (kg)", value: formatKg(catfish.totalFeedKg) },
    { label: "Harvested (kg)", value: formatKg(catfish.totalHarvestKg) },
    { label: "Revenue", value: formatCurrency(catfish.totalRevenue) },
  ]), [catfish]);

  const bsfStats = useMemo(() => ([
    { label: "Feed Used (kg)", value: formatKg(bsf.totalFeedKg) },
    { label: "Harvested (kg)", value: formatKg(bsf.totalWetLarvaeKg) },
    { label: "FCR", value: bsf.fcr.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
    { label: "Breeding Eff.", value: bsf.breedingEfficiency.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
  ]), [bsf]);

  const feedMillStats = useMemo(() => ([
    { label: "Stock Items", value: feedMill.stockItems.toLocaleString() },
    { label: "Stock (kg)", value: formatKg(feedMill.totalStockKg) },
    { label: "Sales (range)", value: formatCurrency(feedMill.salesRevenue) },
    { label: "Quick Access", value: "Inventory & Production" },
  ]), [feedMill]);

  const panels = [
    {
      title: "Feed Mill",
      href: "/feed-mill/production",
      icon: Factory,
      accent: "text-emerald-600",
      stats: feedMillStats,
    },
    {
      title: "Poultry",
      href: "/poultry/dashboard",
      icon: Egg,
      accent: "text-amber-600",
      stats: poultryStats,
    },
    {
      title: "Catfish",
      href: "/catfish/dashboard",
      icon: Fish,
      accent: "text-blue-600",
      stats: catfishStats,
    },
    {
      title: "BSF",
      href: "/bsf/dashboard",
      icon: Bug,
      accent: "text-violet-600",
      stats: bsfStats,
    },
  ];

  return (
    <div className="flex flex-col gap-6 overflow-y-auto modal-scrollbar h-full pr-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-manrope">
            Farm Overview
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Cross-module KPIs for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 bg-white border rounded-xl p-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              From
            </span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              To
            </span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={loadAll} disabled={loading}>
            {loading ? "Refreshing..." : "Apply"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {panels.map((panel) => (
          <div key={panel.title} className="bg-white border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center ${panel.accent}`}>
                  <panel.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{panel.title}</h2>
                  <p className="text-xs text-slate-500">Summary KPIs</p>
                </div>
              </div>
              <Link className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" href={panel.href}>
                Open Module
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {panel.stats.map((stat) => (
                <div key={stat.label} className="border rounded-xl p-3 bg-slate-50">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{stat.label}</p>
                  <p className="text-lg font-black text-slate-900 mt-2 font-manrope">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Feed Mill Sales (range)</p>
              <p className="text-2xl font-black mt-1 font-manrope">{formatCurrency(feedMill.salesRevenue)}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Stock Items</span>
              <span>{feedMill.stockItems.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stock (kg)</span>
              <span>{formatKg(feedMill.totalStockKg)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Quick Links</p>
              <p className="text-lg font-semibold text-slate-900">Shortcuts</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Link className="block text-emerald-700 hover:text-emerald-800 font-semibold" href="/feed-mill/stock">
              Finished Stock
            </Link>
            <Link className="block text-emerald-700 hover:text-emerald-800 font-semibold" href="/poultry/inventory">
              Poultry Inventory
            </Link>
            <Link className="block text-emerald-700 hover:text-emerald-800 font-semibold" href="/catfish/inventory">
              Catfish Inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
