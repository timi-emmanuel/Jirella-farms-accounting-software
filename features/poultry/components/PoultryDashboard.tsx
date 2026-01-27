"use client";

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Egg, Scale, TrendingUp, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Metrics = {
  totalEggs: number;
  totalDamaged: number;
  totalMortality: number;
  totalFeedKg: number;
  currentLiveBirds: number;
  henDayProduction: number;
  feedPerBirdG: number;
  fcrPerDozen: number;
  costPerCrate: number;
  totalSales: number;
  totalCogs: number;
  totalExpenses: number;
  profit: number;
};

const emptyMetrics: Metrics = {
  totalEggs: 0,
  totalDamaged: 0,
  totalMortality: 0,
  totalFeedKg: 0,
  currentLiveBirds: 0,
  henDayProduction: 0,
  feedPerBirdG: 0,
  fcrPerDozen: 0,
  costPerCrate: 0,
  totalSales: 0,
  totalCogs: 0,
  totalExpenses: 0,
  profit: 0
};

export function PoultryDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadMetrics = async () => {
    setLoading(true);
    const response = await fetch(`/api/poultry/dashboard?from=${from}&to=${to}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Dashboard load error:', payload.error || response.statusText);
      setMetrics(emptyMetrics);
    } else {
      setMetrics(payload.metrics || emptyMetrics);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const summaryCards = useMemo(() => ([
    {
      label: 'Eggs Collected',
      value: metrics.totalEggs.toLocaleString(),
      hint: `${metrics.totalDamaged.toLocaleString()} damaged`,
      icon: Egg,
      accent: 'text-amber-600'
    },
    {
      label: 'Live Birds',
      value: metrics.currentLiveBirds.toLocaleString(),
      hint: `${metrics.totalMortality.toLocaleString()} mortality`,
      icon: Users,
      accent: 'text-emerald-600'
    },
    {
      label: 'Feed Used (kg)',
      value: metrics.totalFeedKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      hint: `${metrics.feedPerBirdG.toLocaleString(undefined, { maximumFractionDigits: 1 })} g/bird`,
      icon: Scale,
      accent: 'text-slate-700'
    },
    {
      label: 'HDP',
      value: `${metrics.henDayProduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`,
      hint: `FCR ${metrics.fcrPerDozen.toLocaleString(undefined, { maximumFractionDigits: 2 })} /dozen`,
      icon: TrendingUp,
      accent: 'text-blue-600'
    }
  ]), [metrics]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Poultry Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium">
            Daily performance, feed efficiency, and profitability snapshot.
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
          <Button onClick={loadMetrics} disabled={loading}>
            {loading ? 'Refreshing...' : 'Apply'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-2">{card.value}</p>
                <p className="text-xs text-slate-500 mt-1">{card.hint}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center ${card.accent}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Efficiency Metrics</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Cost per Crate</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                ? {metrics.costPerCrate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Feed-driven cost only</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Feed Conversion</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {metrics.fcrPerDozen.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg/dozen
              </p>
              <p className="text-xs text-slate-500 mt-1">Lower is better</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Poultry P&L</p>
              <p className="text-2xl font-black mt-1">
                ? {metrics.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Total Sales</span>
              <span>? {metrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>COGS</span>
              <span>? {metrics.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Overheads</span>
              <span>? {metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

