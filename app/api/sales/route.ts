import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get('module');

  const admin = createAdminClient();
  let query = admin
   .from('Sale')
   .select('*, product:Product(name, module, unit)')
   .order('soldAt', { ascending: false });

  if (module && module !== 'ALL') {
   query = query.eq('module', module);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sales: data || [] });
 } catch (error: any) {
  console.error('Sales fetch error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'ACCOUNTANT'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
   productId,
   quantitySold,
   unitSellingPrice,
   soldAt,
   notes,
   batchId,
   customerName,
   customerContact,
   customerAddress
  } = await request.json();
  if (!productId || !quantitySold || Number(quantitySold) <= 0 || unitSellingPrice === undefined) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const normalizedCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
  const normalizedCustomerContact = typeof customerContact === 'string' && customerContact.trim()
   ? customerContact.replace(/\D/g, '')
   : null;
  const normalizedCustomerAddress = typeof customerAddress === 'string' && customerAddress.trim()
   ? customerAddress.trim()
   : null;

  if (!normalizedCustomerName) {
   return NextResponse.json({ error: 'Customer name is required for external sales' }, { status: 400 });
  }
  if (normalizedCustomerContact && !/^\d{11}$/.test(normalizedCustomerContact)) {
   return NextResponse.json({ error: 'Customer contact must be an 11 digit number' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: product, error: productError } = await admin
   .from('Product')
   .select('*')
   .eq('id', productId)
   .single();

  if (productError || !product) {
   return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { data: location, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id, code')
   .eq('code', product.module)
   .single();

  if (locationError || !location) {
   return NextResponse.json({ error: 'Location not found' }, { status: 400 });
  }

  const { data: stock } = await admin
   .from('FinishedGoodsInventory')
   .select('*')
   .eq('productId', productId)
   .eq('locationId', location.id)
   .single();

  const available = roundTo2(Number(stock?.quantityOnHand || 0));
  const qty = roundTo2(Number(quantitySold));
  if (available < qty) {
   return NextResponse.json({ error: 'Insufficient finished stock' }, { status: 400 });
  }

  const unitCostAtSale = roundTo2(Number(stock?.averageUnitCost || 0));

  const { data: sale, error: saleError } = await admin
   .from('Sale')
   .insert({
    productId,
    module: product.module,
    locationId: location.id,
    quantitySold: qty,
    unitSellingPrice: roundTo2(Number(unitSellingPrice)),
    unitCostAtSale,
    saleType: 'EXTERNAL',
    customerName: normalizedCustomerName,
    customerContact: normalizedCustomerContact,
    customerAddress: normalizedCustomerAddress,
    sourceUnit: product.module === 'BSF'
      ? (['BSF Eggs', 'Pupae Shells', 'Dead Fly'].includes(product.name) ? 'INSECTORIUM' : 'LARVARIUM')
      : null,
    productType: product.name,
    totalAmount: roundTo2(qty * Number(unitSellingPrice)),
    soldAt: soldAt ?? new Date().toISOString().split('T')[0],
    soldBy: auth.userId,
    notes: notes ?? null,
    batchId: batchId ?? null
   })
   .select('*')
   .single();

  if (saleError) {
   return NextResponse.json({ error: saleError.message }, { status: 400 });
  }

  const { error: ledgerError } = await admin
   .from('FinishedGoodsLedger')
   .insert({
    productId,
    locationId: location.id,
    type: 'SALE_OUT',
    quantity: qty,
    unitCostAtTime: unitCostAtSale,
    referenceType: 'SALE',
    referenceId: sale.id,
    createdBy: auth.userId
   });

  if (ledgerError) {
   return NextResponse.json({ error: ledgerError.message }, { status: 400 });
  }

  const { error: stockError } = await admin
   .from('FinishedGoodsInventory')
   .update({
    quantityOnHand: roundTo2(available - qty),
    updatedAt: new Date().toISOString()
   })
   .eq('productId', productId)
   .eq('locationId', location.id);

  if (stockError) {
   return NextResponse.json({ error: stockError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'SALE_LOGGED',
   entityType: 'Sale',
   entityId: sale.id,
   description: `Sale logged for ${product.name}`,
   metadata: { product: product.name, qty, unitPrice: unitSellingPrice },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ sale });
 } catch (error: any) {
  console.error('Sale create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
