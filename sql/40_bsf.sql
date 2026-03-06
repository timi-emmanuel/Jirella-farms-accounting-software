-- BSF Module (Insectorium + Larvarium)
-- Idempotent module SQL

-- Ensure BSF location exists
INSERT INTO "InventoryLocation" ("code", "name")
SELECT 'BSF', 'BSF Facility'
WHERE NOT EXISTS (
  SELECT 1 FROM "InventoryLocation" WHERE "code" = 'BSF'
);

-- Seed BSF products (idempotent)
UPDATE "Product"
SET "name" = 'Wet Larvae'
WHERE "name" = 'Live Larvae'
  AND "module" = 'BSF'
  AND NOT EXISTS (
    SELECT 1 FROM "Product"
    WHERE "name" = 'Wet Larvae' AND "module" = 'BSF'
  );

INSERT INTO "Product" ("name", "module", "unit", "active")
VALUES
  ('BSF Eggs', 'BSF', 'GRAM', TRUE),
  ('Wet Larvae', 'BSF', 'KG', TRUE),
  ('Dry Larvae', 'BSF', 'KG', TRUE),
  ('Larvae Oil', 'BSF', 'LITER', TRUE),
  ('Larvae Cake', 'BSF', 'KG', TRUE),
  ('Frass', 'BSF', 'KG', TRUE),
  ('Pupae Shells', 'BSF', 'KG', TRUE),
  ('Dead Fly', 'BSF', 'KG', TRUE)
ON CONFLICT ("name") DO NOTHING;

-- Seed BSF inputs (idempotent)
  INSERT INTO "Ingredient" ("name", "unit", "description")
  VALUES
    ('PKC', 'KG', 'Palm Kernel Cake for BSF feed'),
    ('Poultry Waste', 'KG', 'Poultry waste substrate for BSF'),
    ('Starter Mesh', 'PCS', 'Starter mesh for BSF larvae')
  ON CONFLICT ("name") DO NOTHING;

CREATE TABLE IF NOT EXISTS "BsfInsectoriumLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "pupaeLoadedKg" NUMERIC NOT NULL DEFAULT 0,
  "eggsHarvestedGrams" NUMERIC NOT NULL DEFAULT 0,
  "pupaeShellsHarvestedKg" NUMERIC NOT NULL DEFAULT 0,
  "deadFlyKg" NUMERIC NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "BsfInsectoriumLog"
  ADD COLUMN IF NOT EXISTS "deadFlyKg" NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE "BsfInsectoriumLog"
  DROP COLUMN IF EXISTS "mortalityRate";

CREATE TABLE IF NOT EXISTS "BsfLarvariumBatch" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchCode" TEXT NOT NULL UNIQUE,
  "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "eggsGramsUsed" NUMERIC NOT NULL DEFAULT 0,
  "initialLarvaeWeightGrams" NUMERIC NOT NULL DEFAULT 0,
  "substrateMixRatio" TEXT,
  "status" TEXT NOT NULL DEFAULT 'GROWING'
    CHECK ("status" IN ('GROWING', 'HARVESTED', 'PROCESSED', 'CLOSED')),
  "harvestDate" DATE,
  "notes" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "BsfBatchFeedLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "BsfLarvariumBatch"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "pkcKg" NUMERIC NOT NULL DEFAULT 0,
  "poultryWasteKg" NUMERIC NOT NULL DEFAULT 0,
  "poultryWasteCostOverride" NUMERIC,
  "notes" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "BsfBatchFeedLog_batch_date_key" UNIQUE ("batchId", "date")
);

CREATE TABLE IF NOT EXISTS "BsfHarvestYield" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL UNIQUE REFERENCES "BsfLarvariumBatch"("id") ON DELETE CASCADE,
  "wetLarvaeKg" NUMERIC NOT NULL DEFAULT 0,
  "frassKg" NUMERIC NOT NULL DEFAULT 0,
  "residueWasteKg" NUMERIC NOT NULL DEFAULT 0,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "BsfProcessingRun" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "BsfLarvariumBatch"("id") ON DELETE CASCADE,
  "processType" TEXT NOT NULL CHECK ("processType" IN ('DRYING', 'PRESSING_EXTRACTION')),
  "inputWeightKg" NUMERIC NOT NULL DEFAULT 0,
  "outputDryLarvaeKg" NUMERIC NOT NULL DEFAULT 0,
  "outputLarvaeOilLiters" NUMERIC NOT NULL DEFAULT 0,
  "outputLarvaeCakeKg" NUMERIC NOT NULL DEFAULT 0,
  "energyCostEstimate" NUMERIC,
  "runAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional batch link for sales
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "batchId" UUID REFERENCES "BsfLarvariumBatch"("id") ON DELETE SET NULL;

ALTER TABLE "BsfLarvariumBatch"
  ADD COLUMN IF NOT EXISTS "eggsGramsUsed" NUMERIC NOT NULL DEFAULT 0;

-- RLS
ALTER TABLE "BsfInsectoriumLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BsfLarvariumBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BsfBatchFeedLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BsfHarvestYield" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BsfProcessingRun" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'BsfInsectoriumLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "BsfInsectoriumLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'BsfLarvariumBatch'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "BsfLarvariumBatch"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'BsfBatchFeedLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "BsfBatchFeedLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'BsfHarvestYield'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "BsfHarvestYield"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'BsfProcessingRun'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "BsfProcessingRun"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "BsfInsectoriumLog_date_idx"
  ON "BsfInsectoriumLog" ("date");
CREATE INDEX IF NOT EXISTS "BsfBatchFeedLog_batch_idx"
  ON "BsfBatchFeedLog" ("batchId");
CREATE INDEX IF NOT EXISTS "BsfProcessingRun_batch_idx"
  ON "BsfProcessingRun" ("batchId");

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "sourceUnit" TEXT;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "productType" TEXT;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "totalAmount" NUMERIC;

-- Internal purchase handler (Feed Mill -> BSF)
CREATE OR REPLACE FUNCTION handle_internal_feed_purchase_bsf(
  p_product_id UUID,
  p_quantity_kg NUMERIC,
  p_unit_price NUMERIC,
  p_sold_by UUID,
  p_bought_by UUID
) RETURNS UUID AS $$
DECLARE
  v_feed_mill UUID;
  v_bsf UUID;
  v_product RECORD;
  v_units NUMERIC;
  v_unit_price_per_unit NUMERIC;
  v_cost_basis_per_unit NUMERIC;
  v_feed_mill_qty NUMERIC;
  v_feed_mill_avg NUMERIC;
  v_bsf_qty NUMERIC;
  v_bsf_avg NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
  v_purchase_id UUID;
BEGIN
  SELECT id INTO v_feed_mill FROM "InventoryLocation" WHERE "code" = 'FEED_MILL';
  SELECT id INTO v_bsf FROM "InventoryLocation" WHERE "code" = 'BSF';

  IF v_feed_mill IS NULL OR v_bsf IS NULL THEN
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
  INTO v_bsf_qty, v_bsf_avg
  FROM "FinishedGoodsInventory"
  WHERE "productId" = p_product_id AND "locationId" = v_bsf
  FOR UPDATE;

  v_bsf_qty := COALESCE(v_bsf_qty, 0);
  v_bsf_avg := COALESCE(v_bsf_avg, 0);
  v_next_qty := v_bsf_qty + v_units;
  v_next_avg := CASE
    WHEN v_next_qty > 0 THEN ((v_bsf_qty * v_bsf_avg) + (v_units * v_cost_basis_per_unit)) / v_next_qty
    ELSE v_cost_basis_per_unit
  END;

  INSERT INTO "FinishedGoodsInventory" ("productId", "locationId", "quantityOnHand", "averageUnitCost")
  VALUES (p_product_id, v_bsf, v_next_qty, ROUND(v_next_avg::numeric, 2))
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
    'INTERNAL_FEED_PURCHASE_BSF',
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
    v_bsf,
    'INTERNAL_PURCHASE_IN',
    v_units,
    v_cost_basis_per_unit,
    'INTERNAL_FEED_PURCHASE_BSF',
    v_purchase_id::text,
    p_bought_by
  );

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
