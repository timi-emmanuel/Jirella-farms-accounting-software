import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to') ?? new Date().toISOString().split('T')[0];
    const fromDefault = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const from = searchParams.get('from') ?? fromDefault;

    const admin = createAdminClient();

    const { data: productionLogs, error: productionError } = await admin
      .from('ProductionLog')
      .select('quantityProduced, costPerKg, date')
      .gte('date', from)
      .lte('date', to);

    if (productionError) {
      return NextResponse.json({ error: productionError.message }, { status: 400 });
    }

    let totalProducedKg = 0;
    let totalProductionCost = 0;
    (productionLogs || []).forEach((row: any) => {
      const qty = Number(row.quantityProduced || 0);
      const cost = Number(row.costPerKg || 0);
      totalProducedKg += qty;
      totalProductionCost += qty * cost;
    });

    const totalBatches = (productionLogs || []).length;
    const averageCostPerKg = totalProducedKg > 0 ? totalProductionCost / totalProducedKg : 0;

    const { data: feedMillLocation } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'FEED_MILL')
      .single();

    let finishedGoodsOnHandKg = 0;
    let finishedGoodsValue = 0;
    if (feedMillLocation?.id) {
      const { data: finishedGoods } = await admin
        .from('FinishedGoodsInventory')
        .select('quantityOnHand, averageUnitCost')
        .eq('locationId', feedMillLocation.id);

      (finishedGoods || []).forEach((row: any) => {
        const qty = Number(row.quantityOnHand || 0);
        const cost = Number(row.averageUnitCost || 0);
        finishedGoodsOnHandKg += qty;
        finishedGoodsValue += qty * cost;
      });
    }

    const { data: sales } = await admin
      .from('Sale')
      .select('quantitySold, unitSellingPrice, unitCostAtSale, soldAt')
      .eq('module', 'FEED_MILL')
      .gte('soldAt', from)
      .lte('soldAt', to);

    let totalSales = 0;
    let totalCogs = 0;
    (sales || []).forEach((sale: any) => {
      totalSales += Number(sale.quantitySold || 0) * Number(sale.unitSellingPrice || 0);
      totalCogs += Number(sale.quantitySold || 0) * Number(sale.unitCostAtSale || 0);
    });

    const grossProfit = totalSales - totalCogs;

    return NextResponse.json({
      metrics: {
        totalProducedKg: roundTo2(totalProducedKg),
        totalBatches,
        averageCostPerKg: roundTo2(averageCostPerKg),
        totalProductionCost: roundTo2(totalProductionCost),
        finishedGoodsOnHandKg: roundTo2(finishedGoodsOnHandKg),
        finishedGoodsValue: roundTo2(finishedGoodsValue),
        totalSales: roundTo2(totalSales),
        totalCogs: roundTo2(totalCogs),
        grossProfit: roundTo2(grossProfit)
      }
    });
  } catch (error: any) {
    console.error('Feed mill dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
