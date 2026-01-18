-- sql/30_poultry.sql
-- Poultry module (idempotent). Depends on sql/00_core.sql and sql/10_store.sql

CREATE TABLE IF NOT EXISTS "PoultryFlock" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL,
  "breed" TEXT,
  "initialCount" INTEGER NOT NULL DEFAULT 0,
  "currentCount" INTEGER NOT NULL DEFAULT 0,
  "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'CLOSED')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PoultryDailyLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "flockId" UUID NOT NULL REFERENCES "PoultryFlock"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "eggsCollected" INTEGER NOT NULL DEFAULT 0,
  "eggsDamaged" INTEGER NOT NULL DEFAULT 0,
  "mortality" INTEGER NOT NULL DEFAULT 0,
  "feedItemId" UUID REFERENCES "Ingredient"("id") ON DELETE SET NULL,
  "feedProductId" UUID REFERENCES "Product"("id") ON DELETE SET NULL,
  "feedConsumedKg" NUMERIC NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "PoultryDailyLog_flock_date_key" UNIQUE ("flockId", "date")
);

CREATE TABLE IF NOT EXISTS "Expense" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "module" TEXT NOT NULL CHECK ("module" IN ('FEED_MILL', 'POULTRY')),
  "category" TEXT NOT NULL,
  "amount" NUMERIC NOT NULL,
  "spentAt" DATE NOT NULL DEFAULT CURRENT_DATE,
  "notes" TEXT,
  "createdBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FeedInternalPurchase" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "quantityKg" NUMERIC NOT NULL,
  "unitPrice" NUMERIC NOT NULL,
  "totalAmount" NUMERIC NOT NULL,
  "purchaseDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "soldByUserId" UUID REFERENCES auth.users(id),
  "boughtByUserId" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Additive column safety
ALTER TABLE "PoultryDailyLog"
  ADD COLUMN IF NOT EXISTS "feedProductId" UUID REFERENCES "Product"("id") ON DELETE SET NULL;

-- Ensure uniqueness (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "PoultryDailyLog_flock_date_unique_idx"
  ON "PoultryDailyLog" ("flockId", "date");

-- Create daily log (atomic)
CREATE OR REPLACE FUNCTION handle_poultry_daily_log(
  p_flock_id UUID,
  p_log_date DATE,
  p_eggs_collected INTEGER,
  p_eggs_damaged INTEGER,
  p_mortality INTEGER,
  p_feed_item_id UUID,
  p_feed_product_id UUID,
  p_feed_consumed_kg NUMERIC,
  p_notes TEXT,
  p_created_by UUID,
  p_eggs_product_id UUID
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_location_id UUID;
  v_feed_unit_cost NUMERIC;
  v_feed_unit_cost_per_kg NUMERIC;
  v_current_count INTEGER;
  v_initial_count INTEGER;
  v_eggs_net INTEGER;
  v_stock RECORD;
  v_has_stock BOOLEAN := false;
  v_current_qty NUMERIC;
  v_current_avg NUMERIC;
  v_feed_stock RECORD;
  v_has_feed_stock BOOLEAN := false;
  v_feed_unit TEXT;
  v_feed_unit_size NUMERIC;
  v_feed_qty_units NUMERIC;
  v_unit_cost NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
BEGIN
  IF p_log_date IS NULL THEN
    p_log_date := CURRENT_DATE;
  END IF;

  IF p_eggs_collected IS NULL OR p_eggs_collected < 0 THEN
    RAISE EXCEPTION 'Eggs collected must be zero or greater';
  END IF;
  IF p_eggs_damaged IS NULL OR p_eggs_damaged < 0 THEN
    RAISE EXCEPTION 'Eggs damaged must be zero or greater';
  END IF;
  IF p_mortality IS NULL OR p_mortality < 0 THEN
    RAISE EXCEPTION 'Mortality must be zero or greater';
  END IF;

  SELECT id INTO v_location_id FROM "InventoryLocation" WHERE "code" = 'POULTRY';
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Poultry location not found';
  END IF;

  SELECT "currentCount", "initialCount"
  INTO v_current_count, v_initial_count
  FROM "PoultryFlock"
  WHERE id = p_flock_id
  FOR UPDATE;

  IF v_current_count IS NULL THEN
    RAISE EXCEPTION 'Flock not found';
  END IF;

  INSERT INTO "PoultryDailyLog" (
    "flockId",
    "date",
    "eggsCollected",
    "eggsDamaged",
    "mortality",
    "feedItemId",
    "feedProductId",
    "feedConsumedKg",
    "notes"
  ) VALUES (
    p_flock_id,
    p_log_date,
    COALESCE(p_eggs_collected, 0),
    COALESCE(p_eggs_damaged, 0),
    COALESCE(p_mortality, 0),
    p_feed_item_id,
    p_feed_product_id,
    COALESCE(p_feed_consumed_kg, 0),
    p_notes
  ) RETURNING id INTO v_log_id;

  IF p_feed_product_id IS NOT NULL AND COALESCE(p_feed_consumed_kg, 0) > 0 THEN
    SELECT "unit", "unitSizeKg"
    INTO v_feed_unit, v_feed_unit_size
    FROM "Product"
    WHERE id = p_feed_product_id;

    SELECT *
    INTO v_feed_stock
    FROM "FinishedGoodsInventory"
    WHERE "productId" = p_feed_product_id AND "locationId" = v_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_has_feed_stock := false;
      v_current_qty := 0;
      v_current_avg := 0;
    ELSE
      v_has_feed_stock := true;
      v_current_qty := COALESCE(v_feed_stock."quantityOnHand", 0);
      v_current_avg := COALESCE(v_feed_stock."averageUnitCost", 0);
    END IF;

    v_feed_unit_cost := v_current_avg;
    IF v_feed_unit = 'BAG' AND COALESCE(v_feed_unit_size, 0) > 0 THEN
      v_feed_qty_units := ROUND((COALESCE(p_feed_consumed_kg, 0) / v_feed_unit_size)::numeric, 2);
      v_feed_unit_cost_per_kg := COALESCE(v_feed_unit_cost, 0) / v_feed_unit_size;
    ELSE
      v_feed_qty_units := COALESCE(p_feed_consumed_kg, 0);
      v_feed_unit_cost_per_kg := COALESCE(v_feed_unit_cost, 0);
    END IF;

    IF v_current_qty < COALESCE(v_feed_qty_units, 0) THEN
      RAISE EXCEPTION 'Insufficient feed stock';
    END IF;

    v_next_qty := v_current_qty - COALESCE(v_feed_qty_units, 0);

    UPDATE "FinishedGoodsInventory"
    SET "quantityOnHand" = v_next_qty,
        "updatedAt" = NOW()
    WHERE "productId" = p_feed_product_id AND "locationId" = v_location_id;

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
      p_feed_product_id,
      v_location_id,
      'USAGE',
      COALESCE(v_feed_qty_units, 0),
      v_feed_unit_cost,
      'POULTRY_DAILY_LOG',
      v_log_id::text,
      p_created_by
    );
  ELSIF p_feed_item_id IS NOT NULL AND COALESCE(p_feed_consumed_kg, 0) > 0 THEN
    PERFORM apply_inventory_movement(
      p_feed_item_id,
      v_location_id,
      'USAGE',
      'OUT',
      COALESCE(p_feed_consumed_kg, 0),
      NULL::numeric,
      'POULTRY_DAILY_LOG',
      v_log_id::text,
      p_notes,
      p_created_by
    );
  END IF;

  IF COALESCE(p_mortality, 0) > 0 THEN
    UPDATE "PoultryFlock"
    SET "currentCount" = GREATEST(COALESCE(v_current_count, v_initial_count) - p_mortality, 0),
        "updatedAt" = NOW()
    WHERE id = p_flock_id;
  END IF;

  v_eggs_net := GREATEST(COALESCE(p_eggs_collected, 0) - COALESCE(p_eggs_damaged, 0), 0);
  IF v_eggs_net > 0 AND p_eggs_product_id IS NOT NULL THEN
    SELECT *
    INTO v_stock
    FROM "FinishedGoodsInventory"
    WHERE "productId" = p_eggs_product_id AND "locationId" = v_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_has_stock := false;
      v_current_qty := 0;
      v_current_avg := 0;
    ELSE
      v_has_stock := true;
      v_current_qty := COALESCE(v_stock."quantityOnHand", 0);
      v_current_avg := COALESCE(v_stock."averageUnitCost", 0);
    END IF;

    IF COALESCE(p_feed_consumed_kg, 0) > 0 THEN
      v_unit_cost := ROUND((COALESCE(p_feed_consumed_kg, 0) * COALESCE(v_feed_unit_cost_per_kg, 0)) / v_eggs_net, 2);
    ELSE
      v_unit_cost := v_current_avg;
    END IF;

    v_next_qty := v_current_qty + v_eggs_net;
    v_next_avg := CASE
      WHEN v_next_qty > 0 THEN ((v_current_qty * v_current_avg) + (v_eggs_net * v_unit_cost)) / v_next_qty
      ELSE v_unit_cost
    END;

    IF v_has_stock = false THEN
      INSERT INTO "FinishedGoodsInventory" ("productId", "locationId", "quantityOnHand", "averageUnitCost")
      VALUES (p_eggs_product_id, v_location_id, v_eggs_net, v_unit_cost);
    ELSE
      UPDATE "FinishedGoodsInventory"
      SET "quantityOnHand" = v_next_qty,
          "averageUnitCost" = ROUND(v_next_avg::numeric, 2),
          "updatedAt" = NOW()
      WHERE "productId" = p_eggs_product_id AND "locationId" = v_location_id;
    END IF;

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
      p_eggs_product_id,
      v_location_id,
      'PRODUCTION_IN',
      v_eggs_net,
      v_unit_cost,
      'POULTRY_DAILY_LOG',
      v_log_id::text,
      p_created_by
    );
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update daily log (atomic edit)
CREATE OR REPLACE FUNCTION update_poultry_daily_log(
  p_log_id UUID,
  p_eggs_collected INTEGER,
  p_eggs_damaged INTEGER,
  p_mortality INTEGER,
  p_feed_item_id UUID,
  p_feed_product_id UUID,
  p_feed_consumed_kg NUMERIC,
  p_notes TEXT,
  p_updated_by UUID,
  p_eggs_product_id UUID
) RETURNS void AS $$
DECLARE
  v_log RECORD;
  v_location_id UUID;
  v_old_net_eggs INTEGER;
  v_new_net_eggs INTEGER;
  v_egg_delta INTEGER;
  v_current_count INTEGER;
  v_feed_unit TEXT;
  v_feed_unit_size NUMERIC;
  v_old_feed_units NUMERIC;
  v_new_feed_units NUMERIC;
  v_feed_avg NUMERIC;
  v_current_qty NUMERIC;
  v_current_avg NUMERIC;
BEGIN
  SELECT * INTO v_log
  FROM "PoultryDailyLog"
  WHERE id = p_log_id
  FOR UPDATE;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Daily log not found';
  END IF;

  SELECT id INTO v_location_id FROM "InventoryLocation" WHERE "code" = 'POULTRY';
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Poultry location not found';
  END IF;

  -- Reverse prior feed usage
  IF v_log."feedProductId" IS NOT NULL AND COALESCE(v_log."feedConsumedKg", 0) > 0 THEN
    SELECT "unit", "unitSizeKg"
    INTO v_feed_unit, v_feed_unit_size
    FROM "Product"
    WHERE id = v_log."feedProductId";

    v_old_feed_units := CASE
      WHEN v_feed_unit = 'BAG' AND COALESCE(v_feed_unit_size, 0) > 0
        THEN ROUND((v_log."feedConsumedKg" / v_feed_unit_size)::numeric, 2)
      ELSE COALESCE(v_log."feedConsumedKg", 0)
    END;

    SELECT "quantityOnHand", "averageUnitCost"
    INTO v_current_qty, v_current_avg
    FROM "FinishedGoodsInventory"
    WHERE "productId" = v_log."feedProductId" AND "locationId" = v_location_id
    FOR UPDATE;

    v_current_qty := COALESCE(v_current_qty, 0) + COALESCE(v_old_feed_units, 0);

    UPDATE "FinishedGoodsInventory"
    SET "quantityOnHand" = v_current_qty,
        "updatedAt" = NOW()
    WHERE "productId" = v_log."feedProductId" AND "locationId" = v_location_id;

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
      v_log."feedProductId",
      v_location_id,
      'ADJUSTMENT',
      -COALESCE(v_old_feed_units, 0),
      COALESCE(v_current_avg, 0),
      'POULTRY_DAILY_LOG_EDIT',
      v_log.id::text,
      p_updated_by
    );
  ELSIF v_log."feedItemId" IS NOT NULL AND COALESCE(v_log."feedConsumedKg", 0) > 0 THEN
    PERFORM apply_inventory_movement(
      v_log."feedItemId",
      v_location_id,
      'ADJUSTMENT',
      'IN',
      COALESCE(v_log."feedConsumedKg", 0),
      NULL::numeric,
      'POULTRY_DAILY_LOG_EDIT',
      v_log.id::text,
      NULL,
      p_updated_by
    );
  END IF;

  -- Apply new feed usage
  IF p_feed_product_id IS NOT NULL AND COALESCE(p_feed_consumed_kg, 0) > 0 THEN
    SELECT "unit", "unitSizeKg"
    INTO v_feed_unit, v_feed_unit_size
    FROM "Product"
    WHERE id = p_feed_product_id;

    v_new_feed_units := CASE
      WHEN v_feed_unit = 'BAG' AND COALESCE(v_feed_unit_size, 0) > 0
        THEN ROUND((COALESCE(p_feed_consumed_kg, 0) / v_feed_unit_size)::numeric, 2)
      ELSE COALESCE(p_feed_consumed_kg, 0)
    END;

    SELECT "quantityOnHand", "averageUnitCost"
    INTO v_current_qty, v_feed_avg
    FROM "FinishedGoodsInventory"
    WHERE "productId" = p_feed_product_id AND "locationId" = v_location_id
    FOR UPDATE;

    IF COALESCE(v_current_qty, 0) < COALESCE(v_new_feed_units, 0) THEN
      RAISE EXCEPTION 'Insufficient feed stock';
    END IF;

    UPDATE "FinishedGoodsInventory"
    SET "quantityOnHand" = COALESCE(v_current_qty, 0) - COALESCE(v_new_feed_units, 0),
        "updatedAt" = NOW()
    WHERE "productId" = p_feed_product_id AND "locationId" = v_location_id;

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
      p_feed_product_id,
      v_location_id,
      'USAGE',
      COALESCE(v_new_feed_units, 0),
      COALESCE(v_feed_avg, 0),
      'POULTRY_DAILY_LOG',
      v_log.id::text,
      p_updated_by
    );
  ELSIF p_feed_item_id IS NOT NULL AND COALESCE(p_feed_consumed_kg, 0) > 0 THEN
    PERFORM apply_inventory_movement(
      p_feed_item_id,
      v_location_id,
      'USAGE',
      'OUT',
      COALESCE(p_feed_consumed_kg, 0),
      NULL::numeric,
      'POULTRY_DAILY_LOG',
      v_log.id::text,
      NULL,
      p_updated_by
    );
  END IF;

  -- Update egg stock
  v_old_net_eggs := GREATEST(COALESCE(v_log."eggsCollected", 0) - COALESCE(v_log."eggsDamaged", 0), 0);
  v_new_net_eggs := GREATEST(COALESCE(p_eggs_collected, 0) - COALESCE(p_eggs_damaged, 0), 0);
  v_egg_delta := v_new_net_eggs - v_old_net_eggs;

  IF v_egg_delta <> 0 AND p_eggs_product_id IS NOT NULL THEN
    SELECT "quantityOnHand", "averageUnitCost"
    INTO v_current_qty, v_current_avg
    FROM "FinishedGoodsInventory"
    WHERE "productId" = p_eggs_product_id AND "locationId" = v_location_id
    FOR UPDATE;

    v_current_qty := COALESCE(v_current_qty, 0) + v_egg_delta;
    IF v_current_qty < 0 THEN
      RAISE EXCEPTION 'Egg stock cannot be negative';
    END IF;

    UPDATE "FinishedGoodsInventory"
    SET "quantityOnHand" = v_current_qty,
        "updatedAt" = NOW()
    WHERE "productId" = p_eggs_product_id AND "locationId" = v_location_id;

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
      p_eggs_product_id,
      v_location_id,
      'ADJUSTMENT',
      v_egg_delta,
      COALESCE(v_current_avg, 0),
      'POULTRY_DAILY_LOG_EDIT',
      v_log.id::text,
      p_updated_by
    );
  END IF;

  -- Update flock count by mortality delta
  SELECT "currentCount" INTO v_current_count
  FROM "PoultryFlock"
  WHERE id = v_log."flockId"
  FOR UPDATE;

  IF v_current_count IS NOT NULL THEN
    UPDATE "PoultryFlock"
    SET "currentCount" = GREATEST(COALESCE(v_current_count, 0) - (COALESCE(p_mortality, 0) - COALESCE(v_log."mortality", 0)), 0),
        "updatedAt" = NOW()
    WHERE id = v_log."flockId";
  END IF;

  UPDATE "PoultryDailyLog"
  SET "eggsCollected" = COALESCE(p_eggs_collected, 0),
      "eggsDamaged" = COALESCE(p_eggs_damaged, 0),
      "mortality" = COALESCE(p_mortality, 0),
      "feedItemId" = p_feed_item_id,
      "feedProductId" = p_feed_product_id,
      "feedConsumedKg" = COALESCE(p_feed_consumed_kg, 0),
      "notes" = p_notes,
      "updatedAt" = NOW()
  WHERE id = v_log.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Internal purchase handler (Feed Mill -> Poultry)
CREATE OR REPLACE FUNCTION handle_internal_feed_purchase(
  p_product_id UUID,
  p_quantity_kg NUMERIC,
  p_unit_price NUMERIC,
  p_sold_by UUID,
  p_bought_by UUID
) RETURNS UUID AS $$
DECLARE
  v_feed_mill UUID;
  v_poultry UUID;
  v_product RECORD;
  v_units NUMERIC;
  v_unit_price_per_unit NUMERIC;
  v_cost_basis_per_unit NUMERIC;
  v_feed_mill_qty NUMERIC;
  v_feed_mill_avg NUMERIC;
  v_poultry_qty NUMERIC;
  v_poultry_avg NUMERIC;
  v_next_qty NUMERIC;
  v_next_avg NUMERIC;
  v_purchase_id UUID;
BEGIN
  SELECT id INTO v_feed_mill FROM "InventoryLocation" WHERE "code" = 'FEED_MILL';
  SELECT id INTO v_poultry FROM "InventoryLocation" WHERE "code" = 'POULTRY';

  IF v_feed_mill IS NULL OR v_poultry IS NULL THEN
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
  INTO v_poultry_qty, v_poultry_avg
  FROM "FinishedGoodsInventory"
  WHERE "productId" = p_product_id AND "locationId" = v_poultry
  FOR UPDATE;

  v_poultry_qty := COALESCE(v_poultry_qty, 0);
  v_poultry_avg := COALESCE(v_poultry_avg, 0);
  v_next_qty := v_poultry_qty + v_units;
  v_next_avg := CASE
    WHEN v_next_qty > 0 THEN ((v_poultry_qty * v_poultry_avg) + (v_units * v_cost_basis_per_unit)) / v_next_qty
    ELSE v_cost_basis_per_unit
  END;

  INSERT INTO "FinishedGoodsInventory" ("productId", "locationId", "quantityOnHand", "averageUnitCost")
  VALUES (p_product_id, v_poultry, v_next_qty, ROUND(v_next_avg::numeric, 2))
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
    'INTERNAL_FEED_PURCHASE',
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
    v_poultry,
    'INTERNAL_PURCHASE_IN',
    v_units,
    v_cost_basis_per_unit,
    'INTERNAL_FEED_PURCHASE',
    v_purchase_id::text,
    p_bought_by
  );

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE "PoultryFlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PoultryDailyLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedInternalPurchase" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'PoultryFlock'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "PoultryFlock"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'PoultryDailyLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "PoultryDailyLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Expense'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "Expense"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FeedInternalPurchase'
      AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users"
    ON "FeedInternalPurchase"
    FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'FeedInternalPurchase'
      AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users"
    ON "FeedInternalPurchase"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = "soldByUserId");
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "PoultryDailyLog_flock_date_idx"
  ON "PoultryDailyLog" ("flockId", "date");
CREATE INDEX IF NOT EXISTS "PoultryDailyLog_date_idx"
  ON "PoultryDailyLog" ("date");
CREATE INDEX IF NOT EXISTS "Expense_module_date_idx"
  ON "Expense" ("module", "spentAt");
CREATE INDEX IF NOT EXISTS "FeedInternalPurchase_product_idx"
  ON "FeedInternalPurchase" ("productId");
CREATE INDEX IF NOT EXISTS "FeedInternalPurchase_date_idx"
  ON "FeedInternalPurchase" ("purchaseDate");
