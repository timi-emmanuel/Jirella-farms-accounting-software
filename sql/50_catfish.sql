-- sql/50_catfish.sql
-- Catfish module (idempotent). Depends on sql/00_core.sql and sql/10_store.sql

-- Ensure CATFISH role exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'CATFISH_STAFF'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'CATFISH_STAFF';
    END IF;
  END IF;
END$$;

-- Ensure Product/Sale module checks include CATFISH
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
  CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF', 'CATFISH'));

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
  CHECK ("module" IN ('FEED_MILL', 'POULTRY', 'BSF', 'CATFISH'));

-- Allow Sale.batchId to reference any module batch (remove BSF-only FK)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Sale_batchId_fkey'
  ) THEN
    ALTER TABLE "Sale" DROP CONSTRAINT "Sale_batchId_fkey";
  END IF;
END$$;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "batchId" UUID;

-- Ensure CATFISH location exists
INSERT INTO "InventoryLocation" ("code", "name")
SELECT 'CATFISH', 'Catfish Facility'
WHERE NOT EXISTS (
  SELECT 1 FROM "InventoryLocation" WHERE "code" = 'CATFISH'
);

-- Seed catfish product
INSERT INTO "Product" ("name", "module", "unit", "active")
VALUES
  ('Live Catfish', 'CATFISH', 'KG', TRUE)
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE IF NOT EXISTS "CatfishPond" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "capacityFish" INTEGER NOT NULL DEFAULT 0,
  "waterType" TEXT NOT NULL DEFAULT 'EARTHEN' CHECK ("waterType" IN ('EARTHEN', 'CONCRETE', 'TANK')),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'MAINTENANCE')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CatfishBatch" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchCode" TEXT NOT NULL UNIQUE,
  "pondId" UUID NOT NULL REFERENCES "CatfishPond"("id") ON DELETE RESTRICT,
  "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "initialFingerlingsCount" INTEGER NOT NULL DEFAULT 0,
  "fingerlingUnitCost" NUMERIC NOT NULL DEFAULT 0,
  "totalFingerlingCost" NUMERIC NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'GROWING' CHECK ("status" IN ('GROWING', 'HARVESTING', 'CLOSED')),
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishBatch_ageCategory_check'
  ) THEN
    ALTER TABLE "CatfishBatch" DROP CONSTRAINT "CatfishBatch_ageCategory_check";
  END IF;
END$$;

ALTER TABLE "CatfishBatch"
  DROP COLUMN IF EXISTS "ageCategory";

CREATE TABLE IF NOT EXISTS "CatfishFeedLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "feedProductId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "quantityKg" NUMERIC NOT NULL DEFAULT 0,
  "unitCostAtTime" NUMERIC NOT NULL DEFAULT 0,
  "totalCost" NUMERIC NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CatfishMortalityLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "deadCount" INTEGER NOT NULL DEFAULT 0,
  "cause" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "CatfishMortalityLog"
  DROP COLUMN IF EXISTS "notes";

CREATE TABLE IF NOT EXISTS "CatfishHarvest" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "quantityKg" NUMERIC NOT NULL DEFAULT 0,
  "fishCountHarvested" INTEGER,
  "averageFishWeightKg" NUMERIC NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "CatfishHarvest"
  ADD COLUMN IF NOT EXISTS "fishCountHarvested" INTEGER;

-- Internal purchase handler (Feed Mill -> Catfish)
CREATE OR REPLACE FUNCTION handle_internal_feed_purchase_catfish(
  p_product_id UUID,
  p_quantity_kg NUMERIC,
  p_unit_price NUMERIC,
  p_sold_by UUID,
  p_bought_by UUID
) RETURNS UUID AS $$
DECLARE
  v_feed_mill UUID;
  v_catfish UUID;
  v_product RECORD;
  v_units NUMERIC;
  v_unit_price_per_unit NUMERIC;
  v_cost_basis_per_unit NUMERIC;
  v_feed_mill_qty NUMERIC;
  v_feed_mill_avg NUMERIC;
  v_catfish_qty NUMERIC;
  v_catfish_avg NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
  v_purchase_id UUID;
BEGIN
  SELECT id INTO v_feed_mill FROM "InventoryLocation" WHERE "code" = 'FEED_MILL';
  SELECT id INTO v_catfish FROM "InventoryLocation" WHERE "code" = 'CATFISH';

  IF v_feed_mill IS NULL OR v_catfish IS NULL THEN
    RAISE EXCEPTION 'Locations not found';
  END IF;

  SELECT "unit", "unitSizeKg"
  INTO v_product
  FROM "Product"
  WHERE id = p_product_id;

  IF v_product."unit" = 'BAG' AND COALESCE(v_product."unitSizeKg", 0) > 0 THEN
    v_units := ROUND((p_quantity_kg / v_product."unitSizeKg")::numeric, 2);
    v_unit_price_per_unit := p_unit_price * v_product."unitSizeKg";
  ELSE
    v_units := p_quantity_kg;
    v_unit_price_per_unit := p_unit_price;
  END IF;

  SELECT "quantityOnHand", "averageUnitCost"
  INTO v_feed_mill_qty, v_feed_mill_avg
  FROM "FinishedGoodsInventory"
  WHERE "productId" = p_product_id AND "locationId" = v_feed_mill
  FOR UPDATE;

  IF COALESCE(v_feed_mill_qty, 0) < COALESCE(v_units, 0) THEN
    RAISE EXCEPTION 'Insufficient feed mill stock';
  END IF;

  v_cost_basis_per_unit := COALESCE(NULLIF(v_feed_mill_avg, 0), v_unit_price_per_unit);

  UPDATE "FinishedGoodsInventory"
  SET "quantityOnHand" = v_feed_mill_qty - v_units,
      "updatedAt" = NOW()
  WHERE "productId" = p_product_id AND "locationId" = v_feed_mill;

  SELECT "quantityOnHand", "averageUnitCost"
  INTO v_catfish_qty, v_catfish_avg
  FROM "FinishedGoodsInventory"
  WHERE "productId" = p_product_id AND "locationId" = v_catfish
  FOR UPDATE;

  v_catfish_qty := COALESCE(v_catfish_qty, 0);
  v_catfish_avg := COALESCE(v_catfish_avg, 0);
  v_next_qty := v_catfish_qty + v_units;
  v_next_avg := CASE
    WHEN v_next_qty > 0 THEN ((v_catfish_qty * v_catfish_avg) + (v_units * v_cost_basis_per_unit)) / v_next_qty
    ELSE v_cost_basis_per_unit
  END;

  INSERT INTO "FinishedGoodsInventory" ("productId", "locationId", "quantityOnHand", "averageUnitCost")
  VALUES (p_product_id, v_catfish, v_next_qty, ROUND(v_next_avg::numeric, 2))
  ON CONFLICT ("productId", "locationId") DO UPDATE SET
    "quantityOnHand" = EXCLUDED."quantityOnHand",
    "averageUnitCost" = EXCLUDED."averageUnitCost",
    "updatedAt" = NOW();

  INSERT INTO "FeedInternalPurchase" (
    "productId",
    "quantityKg",
    "unitPrice",
    "totalAmount",
    "purchaseDate",
    "soldByUserId",
    "boughtByUserId"
  ) VALUES (
    p_product_id,
    p_quantity_kg,
    p_unit_price,
    ROUND(p_quantity_kg * p_unit_price, 2),
    CURRENT_DATE,
    p_sold_by,
    p_bought_by
  ) RETURNING id INTO v_purchase_id;

  INSERT INTO "FinishedGoodsLedger" (
    "productId",
    "locationId",
    "type",
    "quantity",
    "unitCostAtTime",
    "referenceType",
    "referenceId",
    "createdBy"
  ) VALUES (
    p_product_id,
    v_feed_mill,
    'INTERNAL_SALE_OUT',
    v_units,
    v_cost_basis_per_unit,
    'INTERNAL_FEED_PURCHASE_CATFISH',
    v_purchase_id::text,
    p_sold_by
  );

  INSERT INTO "FinishedGoodsLedger" (
    "productId",
    "locationId",
    "type",
    "quantity",
    "unitCostAtTime",
    "referenceType",
    "referenceId",
    "createdBy"
  ) VALUES (
    p_product_id,
    v_catfish,
    'INTERNAL_PURCHASE_IN',
    v_units,
    v_cost_basis_per_unit,
    'INTERNAL_FEED_PURCHASE_CATFISH',
    v_purchase_id::text,
    p_bought_by
  );

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE "CatfishPond" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishFeedLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishMortalityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishHarvest" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishPond'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishPond"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishBatch'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishBatch"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishFeedLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishFeedLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishMortalityLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishMortalityLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishHarvest'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishHarvest"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "CatfishBatch_pond_idx"
  ON "CatfishBatch" ("pondId");
CREATE INDEX IF NOT EXISTS "CatfishFeedLog_batch_idx"
  ON "CatfishFeedLog" ("batchId");
CREATE INDEX IF NOT EXISTS "CatfishFeedLog_date_idx"
  ON "CatfishFeedLog" ("date");
CREATE INDEX IF NOT EXISTS "CatfishMortality_batch_idx"
  ON "CatfishMortalityLog" ("batchId");
CREATE INDEX IF NOT EXISTS "CatfishHarvest_batch_idx"
  ON "CatfishHarvest" ("batchId");
CREATE INDEX IF NOT EXISTS "CatfishHarvest_date_idx"
  ON "CatfishHarvest" ("date");
