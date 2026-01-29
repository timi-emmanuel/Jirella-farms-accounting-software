"use client";

import { useEffect, useMemo, useState } from 'react';
import { Factory, Package, Scale, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Metrics = {
  totalProducedKg: number;
  totalBatches: number;
  averageCostPerKg: number;
  totalProductionCost: number;
  finishedGoodsOnHandKg: number;
  finishedGoodsValue: number;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
};

const emptyMetrics: Metrics = {
  totalProducedKg: 0,
  totalBatches: 0,
  averageCostPerKg: 0,
  totalProductionCost: 0,
  finishedGoodsOnHandKg: 0,
  finishedGoodsValue: 0,
  totalSales: 0,
  totalCogs: 0,
  grossProfit: 0
};

export function FeedMillDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadMetrics = async () => {
    setLoading(true);
    const response = await fetch(`/api/feed-mill/dashboard?from=${from}&to=${to}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Feed mill dashboard load error:', payload.error || response.statusText);
      setMetrics(emptyMetrics);
    } else {
      setMetrics(payload.metrics || emptyMetrics);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const cards = useMemo(() => ([
    {
      label: 'Production (kg)',
      value: metrics.totalProducedKg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: `${metrics.totalBatches.toLocaleString()} batches`,
      icon: Factory,
      accent: 'text-emerald-600'
    },
    {
      label: 'Avg Cost / kg',
      value: `₦ ${metrics.averageCostPerKg.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      hint: `₦ ${metrics.totalProductionCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} total`,
      icon: Scale,
      accent: 'text-blue-600'
    },
    {
      label: 'Finished Goods (kg)',
      value: metrics.finishedGoodsOnHandKg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: `₦ ${metrics.finishedGoodsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} value`,
      icon: Package,
      accent: 'text-amber-600'
    },
    {
      label: 'Sales Revenue',
      value: `₦ ${metrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      hint: `COGS ₦ ${metrics.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: Wallet,
      accent: 'text-emerald-700'
    }
  ]), [metrics]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-manrope">Feed Mill <span className='text-emerald-600'>Dashboard</span></h1>
          <p className="text-slate-500 text-sm font-medium">
            Production, inventory value, and sales performance at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 bg-white border rounded-xl p-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={loadMetrics} disabled={loading}>
            {loading ? 'Refreshing...' : 'Apply'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-2 font-manrope">{card.value}</p>
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
          <h2 className="text-lg font-semibold text-slate-900">Operations Snapshot</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Production Cost</p>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-manrope">
                ₦ {metrics.totalProductionCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total feed manufactured</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Cost per kg</p>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-manrope">
                ₦ {metrics.averageCostPerKg.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Weighted by output</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Feed Mill P&L</p>
              <p className="text-2xl font-black mt-1 font-manrope">
                ₦ {metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Total Sales</span>
              <span>₦ {metrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>COGS</span>
              <span>₦ {metrics.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
