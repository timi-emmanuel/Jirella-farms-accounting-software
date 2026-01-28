"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CatfishBatch } from '@/types';
import { CatfishFeedLogGrid } from './CatfishFeedLogGrid';
import { CatfishMortalityGrid } from './CatfishMortalityGrid';
import { CatfishHarvestGrid } from './CatfishHarvestGrid';
import { formatCatfishStage, getCatfishAgeWeeks, getCatfishStage } from '@/lib/catfish';

export function CatfishBatchDetail() {
  const params = useParams();
  const batchId = params?.id as string;
  const [batch, setBatch] = useState<CatfishBatch | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBatch = async () => {
    setLoading(true);
    const response = await fetch(`/api/catfish/batches?batchId=${batchId}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Catfish batch fetch error:', payload.error || response.statusText);
      setBatch(null);
    } else {
      setBatch(payload.batches?.[0] || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (batchId) loadBatch();
  }, [batchId]);

  const stats = useMemo(() => {
    if (!batch) return [];
    const mortalityTotal = Number((batch as any).mortalityTotal || 0);
    const harvestedCount = Number((batch as any).harvestedCount || 0);
    const fishesLeft = batch.status === 'CLOSED'
      ? 0
      : Math.max(
          0,
          Number(batch.initialFingerlingsCount || 0) - mortalityTotal - harvestedCount
        );
    return [
      { label: 'Pond', value: batch.pond?.name || 'Unknown' },
      { label: 'Start Date', value: batch.startDate },
      { label: 'Age (wks)', value: getCatfishAgeWeeks(batch.startDate).toString() },
      { label: 'Stage', value: formatCatfishStage(getCatfishStage(batch.startDate)) },
      { label: 'Fishes', value: batch.initialFingerlingsCount.toLocaleString() },
      { label: 'Fishes Left', value: fishesLeft.toLocaleString() },
      { label: 'Total Mortality', value: mortalityTotal.toLocaleString() },
      { label: 'Harvested (count)', value: harvestedCount.toLocaleString() },
      { label: 'Status', value: batch.status }
    ];
  }, [batch]);

  if (loading) {
    return <div className="text-slate-500">Loading batch...</div>;
  }

  if (!batch) {
    return <div className="text-slate-500">Batch not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish Batch <span className="text-emerald-600">{batch.batchCode}</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Track feeding, mortality, and harvest progress.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{stat.label}</p>
            <p className="text-lg font-bold text-slate-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Feed Logs</h2>
        <CatfishFeedLogGrid batchId={batchId} hideBatchColumn={true} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Mortality</h2>
        <CatfishMortalityGrid batchId={batchId} hideBatchColumn={true} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Harvests</h2>
        <CatfishHarvestGrid batchId={batchId} hideBatchColumn={true} />
      </div>
    </div>
  );
}
