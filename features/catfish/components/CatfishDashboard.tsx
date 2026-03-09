"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fish, Scale, Skull, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserRole } from '@/hooks/useUserRole';

type YieldRow = { batchCode: string; quantityKg: number };
type BatchStatRow = {
  status?: string;
  mortalityTotal?: number;
  currentPopulation?: number;
};
type BatchAnalytics = {
  total: number;
  active: number;
  avgMortality: number;
  avgCurrentStock: number;
};

type Metrics = {
  totalFeedKg: number;
  totalWeightGainedKg: number;
  fcr: number;
  totalFeedCost?: number;
  totalSold?: number;
  totalMortality: number;
  survivalRate: number;
  averageAbwGrams: number;
  totalRevenue: number;
  activeBatches: number;
  yieldByBatch: YieldRow[];
};

const emptyMetrics: Metrics = {
  totalFeedKg: 0,
  totalWeightGainedKg: 0,
  fcr: 0,
  totalFeedCost: 0,
  totalSold: 0,
  totalMortality: 0,
  survivalRate: 0,
  averageAbwGrams: 0,
  totalRevenue: 0,
  activeBatches: 0,
  yieldByBatch: []
};

export function CatfishDashboard() {
  const { role } = useUserRole();
  const canViewFinancials = role !== 'CATFISH_STAFF';
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [fingerlingsAnalytics, setFingerlingsAnalytics] = useState<BatchAnalytics>({
    total: 0,
    active: 0,
    avgMortality: 0,
    avgCurrentStock: 0
  });
  const [juvenileAnalytics, setJuvenileAnalytics] = useState<BatchAnalytics>({
    total: 0,
    active: 0,
    avgMortality: 0,
    avgCurrentStock: 0
  });
  const [growoutAnalytics, setGrowoutAnalytics] = useState<BatchAnalytics>({
    total: 0,
    active: 0,
    avgMortality: 0,
    avgCurrentStock: 0
  });
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const [metricsRes, fingerlingsRes, juvenileRes, growoutRes] = await Promise.all([
      fetch(`/api/catfish/dashboard?from=${from}&to=${to}`),
      fetch('/api/catfish/batches?productionType=Fingerlings'),
      fetch('/api/catfish/batches?productionType=Juvenile'),
      fetch('/api/catfish/batches?productionType=Grow-out%20(Adult)')
    ]);

    const metricsPayload = await metricsRes.json().catch(() => ({}));
    if (!metricsRes.ok) {
      console.error('Catfish dashboard load error:', metricsPayload.error || metricsRes.statusText);
      setMetrics(emptyMetrics);
    } else {
      setMetrics(metricsPayload.metrics || emptyMetrics);
    }

    const calc = (rows: BatchStatRow[]): BatchAnalytics => {
      const total = rows.length;
      const active = rows.filter((b) => b.status === 'Active').length;
      const avgMortality = total > 0
        ? rows.reduce((sum: number, b) => sum + Number(b.mortalityTotal || 0), 0) / total
        : 0;
      const avgCurrentStock = total > 0
        ? rows.reduce((sum: number, b) => sum + Number(b.currentPopulation || 0), 0) / total
        : 0;
      return { total, active, avgMortality, avgCurrentStock };
    };

    const fingerlingsPayload = await fingerlingsRes.json().catch(() => ({}));
    if (fingerlingsRes.ok) {
      setFingerlingsAnalytics(calc(fingerlingsPayload.batches || []));
    }

    const juvenilePayload = await juvenileRes.json().catch(() => ({}));
    if (juvenileRes.ok) {
      setJuvenileAnalytics(calc(juvenilePayload.batches || []));
    }

    const growoutPayload = await growoutRes.json().catch(() => ({}));
    if (growoutRes.ok) {
      setGrowoutAnalytics(calc(growoutPayload.batches || []));
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMetrics();
    });
  }, [loadMetrics]);

  const cards = useMemo(() => {
    const baseCards = [
      {
        label: 'Feed Used (kg)',
        value: metrics.totalFeedKg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        hint: 'Feed log total',
        icon: Scale,
        accent: 'text-emerald-600'
      },
      {
        label: 'FCR',
        value: metrics.fcr.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        hint: `Feed / Weight gain (${metrics.totalWeightGainedKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg gained)`,
        icon: Scale,
        accent: 'text-violet-600'
      }
    ];

    if (!canViewFinancials) {
      return baseCards;
    }

    return [
      baseCards[0],
      {
        label: 'Feed Cost',
        value: `₦ ${Number(metrics.totalFeedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        hint: 'Daily log feed cost',
        icon: Fish,
        accent: 'text-blue-600'
      },
      baseCards[1],
      {
        label: 'Revenue',
        value: `₦ ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        hint: 'Sales in range',
        icon: Wallet,
        accent: 'text-emerald-700'
      }
    ];
  }, [metrics, canViewFinancials]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
                <p className="text-xl font-black text-slate-900 mt-2 font-manrope">{card.value}</p>
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
          <h2 className="text-lg font-semibold text-slate-900">Batch Health</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Mortality Count</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {metrics.totalMortality.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Logged in range</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Harvest Weight</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {metrics.averageAbwGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
              </p>
              <p className="text-xs text-slate-500 mt-1">Average body weight</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Active Batches</p>
              <p className="text-2xl font-black mt-1 font-manrope">
                {metrics.activeBatches.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            {metrics.yieldByBatch.length === 0 ? (
              <p className="text-slate-400">No harvests logged in this range.</p>
            ) : (
              metrics.yieldByBatch.map((row) => (
                <div key={row.batchCode} className="flex justify-between">
                  <span>{row.batchCode}</span>
                  <span>{row.quantityKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} sold</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fingerlings Analytics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{fingerlingsAnalytics.total.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Active Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{fingerlingsAnalytics.active.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Mortality / Batch</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{fingerlingsAnalytics.avgMortality.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Current Stock</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{fingerlingsAnalytics.avgCurrentStock.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Juvenile Analytics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{juvenileAnalytics.total.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Active Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{juvenileAnalytics.active.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Mortality / Batch</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{juvenileAnalytics.avgMortality.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Current Stock</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{juvenileAnalytics.avgCurrentStock.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Grow-out Analytics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{growoutAnalytics.total.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Active Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{growoutAnalytics.active.toLocaleString()}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Mortality / Batch</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{growoutAnalytics.avgMortality.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Avg Current Stock</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{growoutAnalytics.avgCurrentStock.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
