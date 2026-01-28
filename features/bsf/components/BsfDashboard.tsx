"use client";

import { useEffect, useMemo, useState } from 'react';
import { Beaker, Bug, Droplets, Gauge, Leaf, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type YieldRow = { batchCode: string; wetLarvaeKg: number };

type Metrics = {
  totalFeedKg: number;
  totalWetLarvaeKg: number;
  fcr: number;
  breedingEfficiency: number;
  oilExtractionRate: number;
  survivalProxy: number;
  yieldByBatch: YieldRow[];
};

const emptyMetrics: Metrics = {
  totalFeedKg: 0,
  totalWetLarvaeKg: 0,
  fcr: 0,
  breedingEfficiency: 0,
  oilExtractionRate: 0,
  survivalProxy: 0,
  yieldByBatch: []
};

export function BsfDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadMetrics = async () => {
    setLoading(true);
    const response = await fetch(`/api/bsf/dashboard?from=${from}&to=${to}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('BSF dashboard load error:', payload.error || response.statusText);
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
      label: 'Feed Input (kg)',
      value: metrics.totalFeedKg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'PKC + waste',
      icon: Scale,
      accent: 'text-emerald-600'
    },
    {
      label: 'Wet Larvae (kg)',
      value: metrics.totalWetLarvaeKg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'Total harvested',
      icon: Bug,
      accent: 'text-amber-600'
    },
    {
      label: 'FCR',
      value: metrics.fcr.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'Wet larvae / feed',
      icon: Gauge,
      accent: 'text-blue-600'
    },
    {
      label: 'Breeding Efficiency',
      value: metrics.breedingEfficiency.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'Egg g / kg pupae',
      icon: Leaf,
      accent: 'text-emerald-700'
    }
  ]), [metrics]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-manrope">BSF Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium">
            Insectorium, larvarium, and processing performance at a glance.
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
          <h2 className="text-lg font-semibold text-slate-900">Extraction + Survival</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Oil Extraction</p>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-manrope">
                {metrics.oilExtractionRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Oil liters / dry larvae input</p>
            </div>
            <div className="border rounded-xl p-4 bg-slate-50">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Survival Proxy</p>
              <p className="text-2xl font-bold text-slate-900 mt-2 font-manrope">
                {metrics.survivalProxy.toLocaleString(undefined, { maximumFractionDigits: 2 })}x
              </p>
              <p className="text-xs text-slate-500 mt-1">Wet larvae / initial larvae</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Yield Snapshot</p>
              <p className="text-2xl font-black mt-1 font-manrope">
                {metrics.totalWetLarvaeKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            {metrics.yieldByBatch.length === 0 ? (
              <p className="text-slate-400">No batches harvested in this range.</p>
            ) : (
              metrics.yieldByBatch.map((row) => (
                <div key={row.batchCode} className="flex justify-between">
                  <span>{row.batchCode}</span>
                  <span>{row.wetLarvaeKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
