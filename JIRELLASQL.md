-- sql/00_core.sql
-- Core/shared schema and auth (idempotent)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM (
      'ADMIN',
      'MANAGER',
      'STAFF',
      'FEED_MILL_STAFF',
      'BSF_STAFF',
      'POULTRY_STAFF',
      'ACCOUNTANT',
      'PROCUREMENT_MANAGER',
      'STORE_KEEPER'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UnitOfMeasure') THEN
    CREATE TYPE "UnitOfMeasure" AS ENUM ('KG', 'TON', 'LITER', 'BAG', 'CRATE');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'ADJUSTMENT', 'RETURN');
  END IF;
END$$;

-- Add missing enum values (additive only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'FEED_MILL_STAFF'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'FEED_MILL_STAFF';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'BSF_STAFF'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'BSF_STAFF';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'POULTRY_STAFF'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'POULTRY_STAFF';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'ACCOUNTANT'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'ACCOUNTANT';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'PROCUREMENT_MANAGER'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'PROCUREMENT_MANAGER';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'STORE_KEEPER'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'STORE_KEEPER';
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UnitOfMeasure') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UnitOfMeasure' AND e.enumlabel = 'CRATE'
    ) THEN
      ALTER TYPE "UnitOfMeasure" ADD VALUE 'CRATE';
    END IF;
  END IF;
END$$;

-- Core tables
CREATE TABLE IF NOT EXISTS "InventoryLocation" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Product" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "module" TEXT NOT NULL CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF')),
  "unit" TEXT NOT NULL,
  "unitSizeKg" NUMERIC,
  "active" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FinishedGoodsInventory" (
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "locationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "quantityOnHand" NUMERIC NOT NULL DEFAULT 0,
  "averageUnitCost" NUMERIC NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("productId", "locationId")
);

CREATE TABLE IF NOT EXISTS "FinishedGoodsLedger" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "locationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "type" TEXT NOT NULL CHECK ("type" IN (
    'PRODUCTION_IN',
    'SALE_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'USAGE',
    'ADJUSTMENT',
    'INTERNAL_SALE_OUT',
    'INTERNAL_PURCHASE_IN'
  )),
  "quantity" NUMERIC NOT NULL,
  "unitCostAtTime" NUMERIC,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Sale" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "module" TEXT NOT NULL CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF')),
  "locationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "quantitySold" NUMERIC NOT NULL,
  "unitSellingPrice" NUMERIC NOT NULL,
  "unitCostAtSale" NUMERIC NOT NULL DEFAULT 0,
  "soldAt" DATE NOT NULL DEFAULT CURRENT_DATE,
  "soldBy" UUID REFERENCES auth.users(id),
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "userId" UUID REFERENCES auth.users(id),
  "userRole" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users profile table and auth trigger
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role "UserRole" NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- Additive column safety for older schemas
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "unitSizeKg" NUMERIC;

ALTER TABLE "FinishedGoodsInventory"
  ADD COLUMN IF NOT EXISTS "locationId" UUID REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT;
ALTER TABLE "FinishedGoodsLedger"
  ADD COLUMN IF NOT EXISTS "locationId" UUID REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT;
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "locationId" UUID REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT;

-- Backfill location for finished goods and sales (idempotent)
UPDATE "FinishedGoodsInventory" fgi
SET "locationId" = loc.id
FROM "Product" p
JOIN "InventoryLocation" loc ON loc."code" = p."module"
WHERE fgi."productId" = p.id AND fgi."locationId" IS NULL;

UPDATE "FinishedGoodsLedger" fgl
SET "locationId" = loc.id
FROM "Product" p
JOIN "InventoryLocation" loc ON loc."code" = p."module"
WHERE fgl."productId" = p.id AND fgl."locationId" IS NULL;

UPDATE "Sale" s
SET "locationId" = loc.id
FROM "Product" p
JOIN "InventoryLocation" loc ON loc."code" = p."module"
WHERE s."productId" = p.id AND s."locationId" IS NULL;

-- Ensure FinishedGoodsLedger check constraint covers new types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinishedGoodsLedger_type_check'
  ) THEN
    ALTER TABLE "FinishedGoodsLedger" DROP CONSTRAINT "FinishedGoodsLedger_type_check";
  END IF;
END$$;

ALTER TABLE "FinishedGoodsLedger"
  ADD CONSTRAINT "FinishedGoodsLedger_type_check"
  CHECK ("type" IN (
    'PRODUCTION_IN',
    'SALE_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'USAGE',
    'ADJUSTMENT',
    'INTERNAL_SALE_OUT',
    'INTERNAL_PURCHASE_IN'
  ));

-- Ensure Product/Sale module checks include BSF
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_module_check'
  ) THEN
    ALTER TABLE "Product" DROP CONSTRAINT "Product_module_check";
  END IF;
END$$;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_module_check"
  CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Sale_module_check'
  ) THEN
    ALTER TABLE "Sale" DROP CONSTRAINT "Sale_module_check";
  END IF;
END$$;

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_module_check"
  CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF'));

-- Ensure FinishedGoodsInventory has a composite PK for upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinishedGoodsInventory_pkey'
  ) THEN
    ALTER TABLE "FinishedGoodsInventory"
      ADD CONSTRAINT "FinishedGoodsInventory_pkey" PRIMARY KEY ("productId", "locationId");
  END IF;
END$$;

-- Backfill any missing profiles (idempotent)
INSERT INTO public.users (id, email, role)
SELECT id, email, 'ADMIN' FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);

-- RLS
ALTER TABLE "InventoryLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinishedGoodsInventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinishedGoodsLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'InventoryLocation'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "InventoryLocation"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Product'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "Product"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsInventory'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "FinishedGoodsInventory"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsLedger'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "FinishedGoodsLedger"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Sale'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "Sale"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ActivityLog'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "ActivityLog"
    FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ActivityLog'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "ActivityLog"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = "userId");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'Users can read their own profile'
  ) THEN
    CREATE POLICY "Users can read their own profile"
    ON public.users
    FOR SELECT USING (auth.uid() = id);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "FinishedGoodsLedger_productId_idx"
  ON "FinishedGoodsLedger" ("productId");
CREATE INDEX IF NOT EXISTS "Sale_soldAt_idx"
  ON "Sale" ("soldAt");
CREATE INDEX IF NOT EXISTS "Sale_module_idx"
  ON "Sale" ("module");


-- ==================== STORE / PROCUREMENT ====================

-- sql/10_store.sql
-- Store/inventory/procurement module (idempotent)

CREATE TABLE IF NOT EXISTS "Ingredient" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "unit" "UnitOfMeasure" DEFAULT 'KG',
  "trackInFeedMill" BOOLEAN DEFAULT TRUE,
  "currentStock" FLOAT DEFAULT 0,
  "averageCost" FLOAT DEFAULT 0,
  "lastPurchasedPrice" FLOAT DEFAULT 0,
  "openingStock" FLOAT DEFAULT 0,
  "purchasedQuantity" FLOAT DEFAULT 0,
  "usedInProduction" FLOAT DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ingredientId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT,
  "type" "TransactionType" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "totalValue" DOUBLE PRECISION NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "date" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "InventoryLedger" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "itemId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT,
  "locationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "type" TEXT NOT NULL CHECK ("type" IN ('RECEIPT', 'TRANSFER_IN', 'TRANSFER_OUT', 'USAGE', 'ADJUSTMENT')),
  "quantity" NUMERIC NOT NULL,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('IN', 'OUT')),
  "unitCost" NUMERIC,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "notes" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "InventoryBalance" (
  "itemId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE CASCADE,
  "locationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE CASCADE,
  "quantityOnHand" NUMERIC NOT NULL DEFAULT 0,
  "averageUnitCost" NUMERIC NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("itemId", "locationId")
);

CREATE TABLE IF NOT EXISTS "TransferRequest" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "fromLocationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "toLocationId" UUID NOT NULL REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  "requestedBy" UUID REFERENCES auth.users(id),
  "approvedBy" UUID REFERENCES auth.users(id),
  "completedBy" UUID REFERENCES auth.users(id),
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TransferRequestLine" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "transferRequestId" UUID NOT NULL REFERENCES "TransferRequest"("id") ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT,
  "quantityRequested" NUMERIC NOT NULL,
  "quantityTransferred" NUMERIC
);

CREATE TABLE IF NOT EXISTS "ProcurementRequest" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED')),
  "createdBy" UUID REFERENCES auth.users(id),
  "approvedBy" UUID REFERENCES auth.users(id),
  "receivedBy" UUID REFERENCES auth.users(id),
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ProcurementRequestLine" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "procurementRequestId" UUID NOT NULL REFERENCES "ProcurementRequest"("id") ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT,
  "quantityRequested" NUMERIC NOT NULL,
  "quantityReceived" NUMERIC,
  "unitCostAtReceipt" NUMERIC
);

CREATE TABLE IF NOT EXISTS "StoreRequest" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" NUMERIC NOT NULL,
  "unit" TEXT NOT NULL,
  "purpose" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED')),
  "requestedBy" UUID REFERENCES auth.users(id),
  "approvedBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "IssueRequest" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "itemId" UUID REFERENCES "Ingredient"("id") ON DELETE SET NULL,
  "itemName" TEXT NOT NULL,
  "quantity" NUMERIC NOT NULL,
  "unit" TEXT NOT NULL,
  "requestingModule" TEXT NOT NULL CHECK ("requestingModule" IN ('FEED_MILL', 'POULTRY')),
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'APPROVED', 'ISSUED', 'REJECTED', 'CANCELLED')),
  "requestedBy" UUID REFERENCES auth.users(id),
  "approvedBy" UUID REFERENCES auth.users(id),
  "issuedBy" UUID REFERENCES auth.users(id),
  "issuedQuantity" NUMERIC,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Additive column safety
ALTER TABLE "Ingredient"
  ADD COLUMN IF NOT EXISTS "currentStock" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "averageCost" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPurchasedPrice" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "openingStock" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "purchasedQuantity" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usedInProduction" FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "trackInFeedMill" BOOLEAN DEFAULT TRUE;

-- Apply inventory movement with balance update
CREATE OR REPLACE FUNCTION apply_inventory_movement(
  p_item_id UUID,
  p_location_id UUID,
  p_type TEXT,
  p_direction TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_reference_type TEXT,
  p_reference_id TEXT,
  p_notes TEXT,
  p_created_by UUID
) RETURNS void AS $$
DECLARE
  v_qty NUMERIC;
  v_avg NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  p_quantity := ROUND(p_quantity::numeric, 2);
  IF p_unit_cost IS NOT NULL THEN
    p_unit_cost := ROUND(p_unit_cost::numeric, 2);
  END IF;

  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  SELECT "quantityOnHand", "averageUnitCost"
  INTO v_qty, v_avg
  FROM "InventoryBalance"
  WHERE "itemId" = p_item_id AND "locationId" = p_location_id
  FOR UPDATE;

  IF v_qty IS NULL THEN
    v_qty := 0;
    v_avg := 0;
    INSERT INTO "InventoryBalance" ("itemId", "locationId", "quantityOnHand", "averageUnitCost")
    VALUES (p_item_id, p_location_id, 0, 0)
    ON CONFLICT ("itemId", "locationId") DO NOTHING;
  END IF;

  IF p_direction = 'OUT' THEN
    IF v_qty < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock';
    END IF;
    v_next_qty := v_qty - p_quantity;
    v_next_avg := v_avg;
  ELSE
    v_next_qty := v_qty + p_quantity;
    IF p_unit_cost IS NOT NULL THEN
      v_next_avg := ((v_qty * v_avg) + (p_quantity * p_unit_cost)) / NULLIF(v_next_qty, 0);
    ELSE
      v_next_avg := v_avg;
    END IF;
  END IF;

  v_next_qty := ROUND(v_next_qty::numeric, 2);
  v_next_avg := ROUND(v_next_avg::numeric, 2);

  UPDATE "InventoryBalance"
  SET "quantityOnHand" = v_next_qty,
      "averageUnitCost" = v_next_avg,
      "updatedAt" = NOW()
  WHERE "itemId" = p_item_id AND "locationId" = p_location_id;

  INSERT INTO "InventoryLedger" (
    "itemId",
    "locationId",
    "type",
    "quantity",
    "direction",
    "unitCost",
    "referenceType",
    "referenceId",
    "notes",
    "createdBy"
  ) VALUES (
    p_item_id,
    p_location_id,
    p_type,
    p_quantity,
    p_direction,
    p_unit_cost,
    p_reference_type,
    p_reference_id,
    p_notes,
    p_created_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete transfer request (atomic)
CREATE OR REPLACE FUNCTION complete_transfer_request(
  p_request_id UUID,
  p_completed_by UUID
) RETURNS void AS $$
DECLARE
  v_request RECORD;
  v_line RECORD;
BEGIN
  SELECT * INTO v_request
  FROM "TransferRequest"
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;
  IF v_request.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Transfer request must be APPROVED';
  END IF;

  FOR v_line IN
    SELECT * FROM "TransferRequestLine"
    WHERE "transferRequestId" = p_request_id
  LOOP
    PERFORM apply_inventory_movement(
      v_line."itemId",
      v_request."fromLocationId",
      'TRANSFER_OUT',
      'OUT',
      v_line."quantityRequested",
      NULL,
      'TRANSFER_REQUEST',
      p_request_id::text,
      v_request.notes,
      p_completed_by
    );

    PERFORM apply_inventory_movement(
      v_line."itemId",
      v_request."toLocationId",
      'TRANSFER_IN',
      'IN',
      v_line."quantityRequested",
      NULL,
      'TRANSFER_REQUEST',
      p_request_id::text,
      v_request.notes,
      p_completed_by
    );

    UPDATE "TransferRequestLine"
    SET "quantityTransferred" = v_line."quantityRequested"
    WHERE id = v_line.id;
  END LOOP;

  UPDATE "TransferRequest"
  SET status = 'COMPLETED',
      "completedBy" = p_completed_by,
      "updatedAt" = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Receive procurement request (atomic)
CREATE OR REPLACE FUNCTION receive_procurement_request(
  p_request_id UUID,
  p_received_by UUID
) RETURNS void AS $$
DECLARE
  v_request RECORD;
  v_line RECORD;
  v_store UUID;
BEGIN
  SELECT id INTO v_store FROM "InventoryLocation" WHERE "code" = 'STORE';

  SELECT * INTO v_request
  FROM "ProcurementRequest"
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Procurement request not found';
  END IF;
  IF v_request.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Procurement request must be APPROVED';
  END IF;

  FOR v_line IN
    SELECT * FROM "ProcurementRequestLine"
    WHERE "procurementRequestId" = p_request_id
  LOOP
    PERFORM apply_inventory_movement(
      v_line."itemId",
      v_store,
      'RECEIPT',
      'IN',
      COALESCE(v_line."quantityReceived", v_line."quantityRequested"),
      v_line."unitCostAtReceipt",
      'PROCUREMENT_REQUEST',
      p_request_id::text,
      v_request.notes,
      p_received_by
    );
  END LOOP;

  UPDATE "ProcurementRequest"
  SET status = 'RECEIVED',
      "receivedBy" = p_received_by,
      "updatedAt" = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE "Ingredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransferRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransferRequestLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcurementRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcurementRequestLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssueRequest" ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Ingredient'
      AND policyname = 'Enable all for authenticated users'
  ) THEN
    CREATE POLICY "Enable all for authenticated users"
    ON "Ingredient"
    FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'InventoryLedger'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "InventoryLedger"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'InventoryBalance'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "InventoryBalance"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'InventoryTransaction'
      AND policyname = 'Enable all for authenticated users'
  ) THEN
    CREATE POLICY "Enable all for authenticated users"
    ON "InventoryTransaction"
    FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'TransferRequest'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "TransferRequest"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'TransferRequestLine'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "TransferRequestLine"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ProcurementRequest'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "ProcurementRequest"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ProcurementRequestLine'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "ProcurementRequestLine"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'StoreRequest'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "StoreRequest"
    FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'StoreRequest'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "StoreRequest"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = "requestedBy");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'StoreRequest'
      AND policyname = 'Enable update for authenticated users'
  ) THEN
    CREATE POLICY "Enable update for authenticated users"
    ON "StoreRequest"
    FOR UPDATE TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'IssueRequest'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "IssueRequest"
    FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'IssueRequest'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "IssueRequest"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = "requestedBy");
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "InventoryTransaction_ingredientId_idx"
  ON "InventoryTransaction" ("ingredientId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_createdAt_idx"
  ON "InventoryTransaction" ("createdAt");
CREATE INDEX IF NOT EXISTS "StoreRequest_status_idx"
  ON "StoreRequest" ("status");
CREATE INDEX IF NOT EXISTS "StoreRequest_createdAt_idx"
  ON "StoreRequest" ("createdAt");
CREATE INDEX IF NOT EXISTS "IssueRequest_status_idx"
  ON "IssueRequest" ("status");
CREATE INDEX IF NOT EXISTS "IssueRequest_createdAt_idx"
  ON "IssueRequest" ("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryLedger_item_location_idx"
  ON "InventoryLedger" ("itemId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryLedger_createdAt_idx"
  ON "InventoryLedger" ("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryBalance_location_idx"
  ON "InventoryBalance" ("locationId");
CREATE INDEX IF NOT EXISTS "TransferRequest_status_idx"
  ON "TransferRequest" ("status");
CREATE INDEX IF NOT EXISTS "TransferRequestLine_request_idx"
  ON "TransferRequestLine" ("transferRequestId");
CREATE INDEX IF NOT EXISTS "ProcurementRequest_status_idx"
  ON "ProcurementRequest" ("status");
CREATE INDEX IF NOT EXISTS "ProcurementRequestLine_request_idx"
  ON "ProcurementRequestLine" ("procurementRequestId");

