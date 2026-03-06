import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const moduleFilter = searchParams.get('module');

  const admin = createAdminClient();
  let query = admin
   .from('Sale')
   .select('*, product:Product(name, module, unit)')
   .order('soldAt', { ascending: false });

  if (moduleFilter && moduleFilter !== 'ALL') {
   query = query.eq('module', moduleFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sales: data || [] });
 } catch (error: unknown) {
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
 } catch (error: unknown) {
  console.error('Sale create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function PATCH(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'ACCOUNTANT'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing sale id' }, { status: 400 });

  const {
   soldAt,
   unitSellingPrice,
   notes,
   customerName,
   customerContact,
   customerAddress
  } = await request.json();

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
  if (unitSellingPrice === undefined || Number(unitSellingPrice) < 0) {
   return NextResponse.json({ error: 'Unit selling price is required and cannot be negative' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
   .from('Sale')
   .select('id, quantitySold, unitSellingPrice, productId')
   .eq('id', id)
   .single();

  if (existingError || !existing) {
   return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  const newUnitPrice = roundTo2(Number(unitSellingPrice));
  const qty = roundTo2(Number(existing.quantitySold || 0));
  const totalAmount = roundTo2(qty * newUnitPrice);

  const { data: updated, error: updateError } = await admin
   .from('Sale')
   .update({
    soldAt: soldAt ?? undefined,
    unitSellingPrice: newUnitPrice,
    totalAmount,
    customerName: normalizedCustomerName,
    customerContact: normalizedCustomerContact,
    customerAddress: normalizedCustomerAddress,
    notes: notes ?? null
   })
   .eq('id', id)
   .select('*')
   .single();

  if (updateError) {
   return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'SALE_UPDATED',
   entityType: 'Sale',
   entityId: updated.id,
   description: `Sale updated`,
   metadata: {
    unitSellingPrice: newUnitPrice,
    soldAt: soldAt ?? null,
    customerName: normalizedCustomerName
   },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ sale: updated });
 } catch (error: unknown) {
  console.error('Sale update error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function DELETE(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'ACCOUNTANT'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing sale id' }, { status: 400 });

  const admin = createAdminClient();
  const { data: sale, error: saleError } = await admin
   .from('Sale')
   .select('id, module, productId, locationId, quantitySold, unitCostAtSale, productType')
   .eq('id', id)
   .single();

  if (saleError || !sale) {
   return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  if (sale.module !== 'FEED_MILL') {
   return NextResponse.json(
    { error: 'Undo sale is currently supported for Feed Mill sales only' },
    { status: 400 }
   );
  }

  const qty = roundTo2(Number(sale.quantitySold || 0));
  if (qty <= 0) {
   return NextResponse.json({ error: 'Invalid sale quantity' }, { status: 400 });
  }

  const { data: stock, error: stockError } = await admin
   .from('FinishedGoodsInventory')
   .select('quantityOnHand, averageUnitCost')
   .eq('productId', sale.productId)
   .eq('locationId', sale.locationId)
   .single();

  if (stockError || !stock) {
   return NextResponse.json({ error: 'Finished stock record not found' }, { status: 400 });
  }

  const nextQty = roundTo2(Number(stock.quantityOnHand || 0) + qty);
  const { error: restoreError } = await admin
   .from('FinishedGoodsInventory')
   .update({
    quantityOnHand: nextQty,
    updatedAt: new Date().toISOString()
   })
   .eq('productId', sale.productId)
   .eq('locationId', sale.locationId);

  if (restoreError) {
   return NextResponse.json({ error: restoreError.message }, { status: 400 });
  }

  const unitCostAtTime = roundTo2(Number(sale.unitCostAtSale || stock.averageUnitCost || 0));
  const { error: ledgerError } = await admin
   .from('FinishedGoodsLedger')
   .insert({
    productId: sale.productId,
    locationId: sale.locationId,
    type: 'ADJUSTMENT',
    quantity: qty,
    unitCostAtTime,
    referenceType: 'SALE_UNDO',
    referenceId: sale.id,
    createdBy: auth.userId
   });

  if (ledgerError) {
   return NextResponse.json({ error: ledgerError.message }, { status: 400 });
  }

  const { error: deleteError } = await admin
   .from('Sale')
   .delete()
   .eq('id', id);

  if (deleteError) {
   return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'SALE_UNDONE',
   entityType: 'Sale',
   entityId: sale.id,
   description: `Sale undone for ${sale.productType || 'product'}`,
   metadata: {
    module: sale.module,
    quantityRestored: qty
   },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: unknown) {
  console.error('Sale undo error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
