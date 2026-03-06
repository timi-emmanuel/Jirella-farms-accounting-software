/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: batches } = await admin
      .from('CatfishBatch')
      .select('id, batchName, productionType, status, startDate, initialSeedCost');

    const { data: feedLogs } = await admin
      .from('CatfishDailyLog')
      .select('batchId, dailyFeedCost');

    const { data: sales } = await admin
      .from('CatfishSale')
      .select('batchId, totalSaleValue');

    const feedByBatch = new Map<string, number>();
    (feedLogs || []).forEach((row: any) => {
      if (!row.batchId) return;
      feedByBatch.set(row.batchId, (feedByBatch.get(row.batchId) || 0) + Number(row.dailyFeedCost || 0));
    });

    const revenueByBatch = new Map<string, number>();
    (sales || []).forEach((row: any) => {
      if (!row.batchId) return;
      revenueByBatch.set(
        row.batchId,
        (revenueByBatch.get(row.batchId) || 0) + Number(row.totalSaleValue || 0)
      );
    });

    const rows = (batches || []).map((batch: any) => {
      const feedCost = roundTo2(feedByBatch.get(batch.id) || 0);
      const fingerlingCost = roundTo2(Number(batch.initialSeedCost || 0));
      const revenue = roundTo2(revenueByBatch.get(batch.id) || 0);
      const totalCogs = roundTo2(feedCost + fingerlingCost);
      const profit = roundTo2(revenue - totalCogs);
      return {
        batchId: batch.id,
        batchCode: batch.batchName,
        fishType: batch.productionType || 'Fingerlings',
        status: batch.status,
        startDate: batch.startDate,
        revenue,
        feedCost,
        fingerlingCost,
        totalCogs,
        profit
      };
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('Catfish batch P&L error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
