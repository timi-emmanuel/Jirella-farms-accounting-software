-- Feed mill module (idempotent)

CREATE TABLE IF NOT EXISTS "Recipe" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "targetBatchSize" DOUBLE PRECISION NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "RecipeItem" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "recipeId" UUID NOT NULL REFERENCES "Recipe"("id") ON DELETE CASCADE,
  "ingredientId" UUID NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT,
  "percentage" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "RecipeItem_recipeId_ingredientId_key" UNIQUE ("recipeId", "ingredientId")
);

CREATE TABLE IF NOT EXISTS "ProductionLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "recipeId" UUID REFERENCES "Recipe"("id") ON DELETE SET NULL,
  "quantityProduced" FLOAT NOT NULL DEFAULT 0,
  "costPerKg" FLOAT NOT NULL DEFAULT 0,
  "cost15kg" FLOAT8,
  "cost25kg" FLOAT8,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FinishedGoodsTransferRequest" (
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

CREATE TABLE IF NOT EXISTS "FinishedGoodsTransferLine" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "transferRequestId" UUID NOT NULL REFERENCES "FinishedGoodsTransferRequest"("id") ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "quantityRequested" NUMERIC NOT NULL,
  "quantityTransferred" NUMERIC
);

-- Production function (legacy)
CREATE OR REPLACE FUNCTION handle_production(
  p_recipe_id UUID,
  p_quantity_produced FLOAT8,
  p_cost_per_kg FLOAT8,
  p_date DATE
) RETURNS void AS $$
DECLARE
  item RECORD;
  required_qty FLOAT8;
  v_cost15kg FLOAT8;
  v_cost25kg FLOAT8;
BEGIN
  v_cost15kg := p_cost_per_kg * 15;
  v_cost25kg := p_cost_per_kg * 25;

  FOR item IN
    SELECT
      ri.percentage,
      i.id AS ingredient_id,
      i.name,
      i."currentStock",
      i."averageCost"
    FROM "RecipeItem" ri
    JOIN "Ingredient" i ON ri."ingredientId" = i.id
    WHERE ri."recipeId" = p_recipe_id
  LOOP
    required_qty := (item.percentage / 100.0) * p_quantity_produced;

    IF item."currentStock" < required_qty THEN
      RAISE EXCEPTION 'Insufficient stock for ingredient: % (Required: %, Available: %)',
        item.name,
        ROUND(required_qty::numeric, 2),
        ROUND(item."currentStock"::numeric, 2);
    END IF;

    UPDATE "Ingredient"
    SET
      "currentStock" = "currentStock" - required_qty,
      "usedInProduction" = COALESCE("usedInProduction", 0) + required_qty
    WHERE "id" = item.ingredient_id;
  END LOOP;

  INSERT INTO "ProductionLog" (
    "recipeId",
    "quantityProduced",
    "costPerKg",
    "cost15kg",
    "cost25kg",
    "date"
  ) VALUES (
    p_recipe_id,
    p_quantity_produced,
    p_cost_per_kg,
    v_cost15kg,
    v_cost25kg,
    p_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Production function using location-based inventory
CREATE OR REPLACE FUNCTION handle_production_location(
  p_recipe_id UUID,
  p_quantity_produced FLOAT8,
  p_cost_per_kg FLOAT8,
  p_date DATE,
  p_location_code TEXT,
  p_created_by UUID
) RETURNS void AS $$
DECLARE
  item RECORD;
  required_qty FLOAT8;
  v_location_id UUID;
  v_cost15kg FLOAT8;
  v_cost25kg FLOAT8;
BEGIN
  SELECT id INTO v_location_id FROM "InventoryLocation" WHERE "code" = p_location_code;
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Location not found';
  END IF;

  v_cost15kg := p_cost_per_kg * 15;
  v_cost25kg := p_cost_per_kg * 25;

  FOR item IN
    SELECT
      ri.percentage,
      i.id AS ingredient_id,
      i.name
    FROM "RecipeItem" ri
    JOIN "Ingredient" i ON ri."ingredientId" = i.id
    WHERE ri."recipeId" = p_recipe_id
  LOOP
    required_qty := (item.percentage / 100.0) * p_quantity_produced;
    IF required_qty <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM apply_inventory_movement(
      item.ingredient_id,
      v_location_id,
      'USAGE',
      'OUT',
      required_qty::numeric,
      NULL::numeric,
      'PRODUCTION_USAGE',
      p_recipe_id::text,
      NULL,
      p_created_by
    );
  END LOOP;

  INSERT INTO "ProductionLog" (
    "recipeId",
    "quantityProduced",
    "costPerKg",
    "cost15kg",
    "cost25kg",
    "date"
  ) VALUES (
    p_recipe_id,
    p_quantity_produced,
    p_cost_per_kg,
    v_cost15kg,
    v_cost25kg,
    p_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete finished goods transfer request
CREATE OR REPLACE FUNCTION complete_finished_goods_transfer_request(
  p_request_id UUID,
  p_completed_by UUID
) RETURNS void AS $$
DECLARE
  v_request RECORD;
  v_line RECORD;
  v_source_avg_cost NUMERIC;
  v_source_qty NUMERIC;
  v_dest_qty NUMERIC;
  v_dest_avg NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
BEGIN
  SELECT * INTO v_request
  FROM "FinishedGoodsTransferRequest"
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Finished goods transfer request not found';
  END IF;
  IF v_request.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Finished goods transfer request must be APPROVED';
  END IF;

  FOR v_line IN
    SELECT * FROM "FinishedGoodsTransferLine"
    WHERE "transferRequestId" = p_request_id
  LOOP
    SELECT "quantityOnHand", "averageUnitCost"
    INTO v_source_qty, v_source_avg_cost
    FROM "FinishedGoodsInventory"
    WHERE "productId" = v_line."productId" AND "locationId" = v_request."fromLocationId"
    FOR UPDATE;

    IF COALESCE(v_source_qty, 0) < v_line."quantityRequested" THEN
      RAISE EXCEPTION 'Insufficient finished goods stock';
    END IF;

    UPDATE "FinishedGoodsInventory"
    SET "quantityOnHand" = v_source_qty - v_line."quantityRequested",
        "updatedAt" = NOW()
    WHERE "productId" = v_line."productId" AND "locationId" = v_request."fromLocationId";

    SELECT "quantityOnHand", "averageUnitCost"
    INTO v_dest_qty, v_dest_avg
    FROM "FinishedGoodsInventory"
    WHERE "productId" = v_line."productId" AND "locationId" = v_request."toLocationId"
    FOR UPDATE;

    v_dest_qty := COALESCE(v_dest_qty, 0);
    v_dest_avg := COALESCE(v_dest_avg, 0);
    v_next_qty := v_dest_qty + v_line."quantityRequested";
    v_next_avg := CASE
      WHEN v_next_qty > 0 THEN ((v_dest_qty * v_dest_avg) + (v_line."quantityRequested" * COALESCE(v_source_avg_cost, 0))) / v_next_qty
      ELSE COALESCE(v_source_avg_cost, 0)
    END;

    INSERT INTO "FinishedGoodsInventory" ("productId", "locationId", "quantityOnHand", "averageUnitCost")
    VALUES (v_line."productId", v_request."toLocationId", v_next_qty, ROUND(v_next_avg::numeric, 2))
    ON CONFLICT ("productId", "locationId") DO UPDATE SET
      "quantityOnHand" = EXCLUDED."quantityOnHand",
      "averageUnitCost" = EXCLUDED."averageUnitCost",
      "updatedAt" = NOW();

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
      v_line."productId",
      v_request."fromLocationId",
      'TRANSFER_OUT',
      v_line."quantityRequested",
      COALESCE(v_source_avg_cost, 0),
      'FINISHED_GOODS_TRANSFER',
      p_request_id::text,
      p_completed_by
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
      v_line."productId",
      v_request."toLocationId",
      'TRANSFER_IN',
      v_line."quantityRequested",
      COALESCE(v_source_avg_cost, 0),
      'FINISHED_GOODS_TRANSFER',
      p_request_id::text,
      p_completed_by
    );

    UPDATE "FinishedGoodsTransferLine"
    SET "quantityTransferred" = v_line."quantityRequested"
    WHERE id = v_line.id;
  END LOOP;

  UPDATE "FinishedGoodsTransferRequest"
  SET status = 'COMPLETED',
      "completedBy" = p_completed_by,
      "updatedAt" = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE "Recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinishedGoodsTransferRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinishedGoodsTransferLine" ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Recipe'
      AND policyname = 'Enable all for authenticated users'
  ) THEN
    CREATE POLICY "Enable all for authenticated users"
    ON "Recipe"
    FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'RecipeItem'
      AND policyname = 'Enable all for authenticated users'
  ) THEN
    CREATE POLICY "Enable all for authenticated users"
    ON "RecipeItem"
    FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ProductionLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "ProductionLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsTransferRequest'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "FinishedGoodsTransferRequest"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsTransferLine'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "FinishedGoodsTransferLine"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsTransferRequest'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "FinishedGoodsTransferRequest"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = "requestedBy");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FinishedGoodsTransferLine'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "FinishedGoodsTransferLine"
    FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "FinishedGoodsTransferRequest_status_idx"
  ON "FinishedGoodsTransferRequest" ("status");
CREATE INDEX IF NOT EXISTS "FinishedGoodsTransferLine_request_idx"
  ON "FinishedGoodsTransferLine" ("transferRequestId");
