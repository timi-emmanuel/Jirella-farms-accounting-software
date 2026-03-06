/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CatfishBatch } from '@/types';
import { CatfishFeedLogGrid } from './CatfishFeedLogGrid';
import { useUserRole } from '@/hooks/useUserRole';

type Props = {
  productionType?: 'Fingerlings' | 'Juvenile' | 'Grow-out (Adult)';
  stageLabel?: string;
};

export function CatfishBatchDetail({
  productionType = 'Fingerlings',
  stageLabel = 'Fingerlings'
}: Props) {
  const { role } = useUserRole();
  const canViewFinancials = role !== 'CATFISH_STAFF';
  const canViewSalesSummary = role !== 'CATFISH_STAFF';
  const params = useParams();
  const batchId = (params?.batchId as string) || (params?.id as string);
  const [batch, setBatch] = useState<CatfishBatch | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBatch = async () => {
    setLoading(true);
    const response = await fetch(`/api/catfish/batches?batchId=${batchId}&productionType=${encodeURIComponent(productionType)}`);
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
  }, [batchId, productionType]);

  const stats = useMemo(() => {
    if (!batch) return [];
    const mortalityTotal = Number(batch.mortalityTotal || 0);
    const totalSold = Number(batch.totalSold || 0);
    const currentPopulation = Number(batch.currentPopulation || 0);
    const rows = [
      { label: 'Type', value: batch.productionType || 'Fingerlings' },
      { label: 'Start Date', value: batch.startDate ? new Date(batch.startDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '' },
      { label: 'Expected Harvest', value: batch.expectedHarvestDate ? new Date(batch.expectedHarvestDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-' },
      { label: 'Initial Stock', value: Number(batch.initialStock || 0).toLocaleString() },
      { label: 'Current Population', value: currentPopulation.toLocaleString() },
      { label: 'Total Mortality', value: mortalityTotal.toLocaleString() },
      { label: 'Total Sold', value: totalSold.toLocaleString() },
      { label: 'Status', value: batch.status }
    ];

    if (!canViewSalesSummary) {
      const soldIndex = rows.findIndex((row) => row.label === 'Total Sold');
      if (soldIndex >= 0) rows.splice(soldIndex, 1);
    }

    if (canViewFinancials) {
      rows.splice(canViewSalesSummary ? 7 : 6, 0, {
        label: 'Initial Seed Cost',
        value: `N ${Number(batch.initialSeedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      });
    }

    return rows;
  }, [batch, canViewFinancials, canViewSalesSummary]);

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
          {stageLabel} Batch <span className="text-emerald-600">{batch.batchName}</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Track daily logs and {stageLabel.toLowerCase()} batch progress.</p>
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
        <h2 className="text-xl font-semibold text-slate-900">Daily Logs</h2>
        <CatfishFeedLogGrid batchId={batchId} hideBatchColumn={true} productionType={productionType} />
      </div>
    </div>
  );
}
