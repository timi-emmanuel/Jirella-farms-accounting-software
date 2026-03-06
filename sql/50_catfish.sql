-- sql/50_catfish.sql
-- Catfish module (idempotent). Depends on sql/00_core.sql and sql/10_store.sql
-- Lifecycle rollout: supports Fingerlings, Juvenile, Grow-out (Adult) stages

-- Ensure CATFISH role exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole'
        AND e.enumlabel = 'CATFISH_STAFF'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'CATFISH_STAFF';
    END IF;
  END IF;
END$$;

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

-- Fingerlings-first unified batch table
CREATE TABLE IF NOT EXISTS "CatfishBatch" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "productionType" TEXT NOT NULL DEFAULT 'Fingerlings',
  "batchName" TEXT NOT NULL,
  "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "expectedHarvestDate" DATE,
  "initialStock" INTEGER NOT NULL DEFAULT 0,
  "initialSeedCost" NUMERIC NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "productionType" TEXT;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "batchName" TEXT;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "expectedHarvestDate" DATE;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "initialStock" INTEGER;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "initialSeedCost" NUMERIC;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "parentBatchId" UUID REFERENCES "CatfishBatch"("id") ON DELETE SET NULL;
ALTER TABLE "CatfishBatch"
  ADD COLUMN IF NOT EXISTS "transferCostBasis" NUMERIC;

-- Legacy compatibility: old schema may still enforce batchCode NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'batchCode'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "CatfishBatch"
      ALTER COLUMN "batchCode" DROP NOT NULL;
  END IF;
END$$;

UPDATE "CatfishBatch"
SET "productionType" = COALESCE("productionType", 'Fingerlings');

UPDATE "CatfishBatch"
SET "productionType" = 'Grow-out (Adult)'
WHERE "productionType" = 'Melange';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'batchCode'
  ) THEN
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "batchName" = COALESCE("batchName", "batchCode", ''Batch-'' || SUBSTRING("id"::text, 1, 8))
      WHERE "batchName" IS NULL
    ';
  ELSE
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "batchName" = COALESCE("batchName", ''Batch-'' || SUBSTRING("id"::text, 1, 8))
      WHERE "batchName" IS NULL
    ';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'initialFingerlingsCount'
  ) THEN
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "initialStock" = COALESCE("initialStock", "initialFingerlingsCount", 0)
      WHERE "initialStock" IS NULL
    ';
  ELSE
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "initialStock" = COALESCE("initialStock", 0)
      WHERE "initialStock" IS NULL
    ';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'totalFingerlingCost'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'fingerlingUnitCost'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CatfishBatch'
      AND column_name = 'initialFingerlingsCount'
  ) THEN
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "initialSeedCost" = COALESCE(
        "initialSeedCost",
        "totalFingerlingCost",
        COALESCE("initialFingerlingsCount", 0) * COALESCE("fingerlingUnitCost", 0),
        0
      )
      WHERE "initialSeedCost" IS NULL
    ';
  ELSE
    EXECUTE '
      UPDATE "CatfishBatch"
      SET "initialSeedCost" = COALESCE("initialSeedCost", 0)
      WHERE "initialSeedCost" IS NULL
    ';
  END IF;
END$$;

UPDATE "CatfishBatch"
SET "status" = CASE
  WHEN "status" IN ('GROWING', 'HARVESTING') THEN 'Active'
  WHEN "status" = 'CLOSED' THEN 'Completed'
  ELSE COALESCE("status", 'Active')
END;

ALTER TABLE "CatfishBatch"
  ALTER COLUMN "productionType" SET DEFAULT 'Fingerlings';
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "productionType" SET NOT NULL;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "batchName" SET NOT NULL;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "initialStock" SET DEFAULT 0;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "initialStock" SET NOT NULL;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "initialSeedCost" SET DEFAULT 0;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "initialSeedCost" SET NOT NULL;
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "status" SET DEFAULT 'Active';
ALTER TABLE "CatfishBatch"
  ALTER COLUMN "status" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishBatch_productionType_check'
  ) THEN
    ALTER TABLE "CatfishBatch" DROP CONSTRAINT "CatfishBatch_productionType_check";
  END IF;
END$$;

ALTER TABLE "CatfishBatch"
  ADD CONSTRAINT "CatfishBatch_productionType_check"
  CHECK ("productionType" IN ('Fingerlings', 'Juvenile', 'Grow-out (Adult)'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishBatch_status_check'
  ) THEN
    ALTER TABLE "CatfishBatch" DROP CONSTRAINT "CatfishBatch_status_check";
  END IF;
END$$;

ALTER TABLE "CatfishBatch"
  ADD CONSTRAINT "CatfishBatch_status_check"
  CHECK ("status" IN ('Active', 'Completed'));

-- Unified daily log table
CREATE TABLE IF NOT EXISTS "CatfishDailyLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "logDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "feedBrand" TEXT NOT NULL,
  "feedAmountKg" NUMERIC NOT NULL DEFAULT 0,
  "feedUnitPrice" NUMERIC NOT NULL DEFAULT 0,
  "dailyFeedCost" NUMERIC GENERATED ALWAYS AS ("feedAmountKg" * "feedUnitPrice") STORED,
  "mortalityCount" INTEGER NOT NULL DEFAULT 0,
  "abwGrams" NUMERIC,
  "averageLengthCm" NUMERIC,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "feedBrand" TEXT;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "feedAmountKg" NUMERIC;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "feedUnitPrice" NUMERIC;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "mortalityCount" INTEGER;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "abwGrams" NUMERIC;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "averageLengthCm" NUMERIC;
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "CatfishDailyLog"
SET "feedBrand" = COALESCE("feedBrand", 'Unknown')
WHERE "feedBrand" IS NULL;

UPDATE "CatfishDailyLog"
SET "feedAmountKg" = COALESCE("feedAmountKg", 0)
WHERE "feedAmountKg" IS NULL;

UPDATE "CatfishDailyLog"
SET "feedUnitPrice" = COALESCE("feedUnitPrice", 0)
WHERE "feedUnitPrice" IS NULL;

UPDATE "CatfishDailyLog"
SET "mortalityCount" = COALESCE("mortalityCount", 0)
WHERE "mortalityCount" IS NULL;

ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "feedBrand" SET NOT NULL;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "feedAmountKg" SET DEFAULT 0;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "feedAmountKg" SET NOT NULL;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "feedUnitPrice" SET DEFAULT 0;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "feedUnitPrice" SET NOT NULL;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "mortalityCount" SET DEFAULT 0;
ALTER TABLE "CatfishDailyLog"
  ALTER COLUMN "mortalityCount" SET NOT NULL;

-- Optional link to feed product for inventory accounting
ALTER TABLE "CatfishDailyLog"
  ADD COLUMN IF NOT EXISTS "feedProductId" UUID REFERENCES "Product"("id") ON DELETE SET NULL;

-- Unified catfish sales table (separate from global "Sale")
CREATE TABLE IF NOT EXISTS "CatfishSale" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "batchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "saleDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "saleType" TEXT NOT NULL,
  "pricingMethod" TEXT NOT NULL DEFAULT 'CM',
  "saleLengthCm" NUMERIC,
  "saleWeightKg" NUMERIC,
  "sizeCategoryName" TEXT,
  "quantitySold" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" NUMERIC NOT NULL DEFAULT 0,
  "totalSaleValue" NUMERIC GENERATED ALWAYS AS ("quantitySold" * "unitPrice") STORED,
  "buyerDetails" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE "CatfishSale"
  ADD COLUMN IF NOT EXISTS "pricingMethod" TEXT;
ALTER TABLE "CatfishSale"
  ADD COLUMN IF NOT EXISTS "saleLengthCm" NUMERIC;
ALTER TABLE "CatfishSale"
  ADD COLUMN IF NOT EXISTS "saleWeightKg" NUMERIC;
ALTER TABLE "CatfishSale"
  ADD COLUMN IF NOT EXISTS "sizeCategoryName" TEXT;

UPDATE "CatfishSale"
SET "pricingMethod" = COALESCE("pricingMethod", 'CM')
WHERE "pricingMethod" IS NULL;

ALTER TABLE "CatfishSale"
  ALTER COLUMN "pricingMethod" SET DEFAULT 'CM';
ALTER TABLE "CatfishSale"
  ALTER COLUMN "pricingMethod" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "CatfishTransfer" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "fromBatchId" UUID NOT NULL REFERENCES "CatfishBatch"("id") ON DELETE CASCADE,
  "toBatchId" UUID REFERENCES "CatfishBatch"("id") ON DELETE SET NULL,
  "fromStage" TEXT NOT NULL,
  "toStage" TEXT NOT NULL,
  "transferDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "costPerFishAtTransfer" NUMERIC NOT NULL DEFAULT 0,
  "transferCostBasis" NUMERIC NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hatchery module tables
CREATE TABLE IF NOT EXISTS "CatfishBroodstockLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "logDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "feedBrand" TEXT NOT NULL,
  "feedAmountKg" NUMERIC NOT NULL DEFAULT 0,
  "feedUnitPrice" NUMERIC NOT NULL DEFAULT 0,
  "dailyFeedCost" NUMERIC GENERATED ALWAYS AS ("feedAmountKg" * "feedUnitPrice") STORED,
  "mortalityCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE "CatfishBroodstockLog"
  ADD COLUMN IF NOT EXISTS "logDate" DATE,
  ADD COLUMN IF NOT EXISTS "feedBrand" TEXT,
  ADD COLUMN IF NOT EXISTS "feedAmountKg" NUMERIC,
  ADD COLUMN IF NOT EXISTS "feedUnitPrice" NUMERIC,
  ADD COLUMN IF NOT EXISTS "mortalityCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "CatfishSpawningEvent" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "eventDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "femalesStripped" INTEGER NOT NULL DEFAULT 0,
  "hormoneCost" NUMERIC NOT NULL DEFAULT 0,
  "maleFishCost" NUMERIC NOT NULL DEFAULT 0,
  "sacrificedMaleWeightKg" NUMERIC NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Incubating',
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE "CatfishSpawningEvent"
  ADD COLUMN IF NOT EXISTS "eventDate" DATE,
  ADD COLUMN IF NOT EXISTS "femalesStripped" INTEGER,
  ADD COLUMN IF NOT EXISTS "hormoneCost" NUMERIC,
  ADD COLUMN IF NOT EXISTS "maleFishCost" NUMERIC,
  ADD COLUMN IF NOT EXISTS "sacrificedMaleWeightKg" NUMERIC,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "CatfishFryTransfer" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "spawningEventId" UUID NOT NULL REFERENCES "CatfishSpawningEvent"("id") ON DELETE CASCADE,
  "transferDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "liveFryCount" INTEGER NOT NULL DEFAULT 0,
  "internalPricePerFry" NUMERIC NOT NULL DEFAULT 0,
  "sacrificedMaleWeightKg" NUMERIC NOT NULL DEFAULT 0,
  "sacrificedMaleMeatPrice" NUMERIC NOT NULL DEFAULT 0,
  "totalTransferValue" NUMERIC GENERATED ALWAYS AS (
    ("liveFryCount" * "internalPricePerFry") + ("sacrificedMaleWeightKg" * "sacrificedMaleMeatPrice")
  ) STORED,
  "toBatchId" UUID REFERENCES "CatfishBatch"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "CatfishFryTransfer_spawningEvent_unique" UNIQUE ("spawningEventId")
);
ALTER TABLE "CatfishFryTransfer"
  ADD COLUMN IF NOT EXISTS "spawningEventId" UUID,
  ADD COLUMN IF NOT EXISTS "transferDate" DATE,
  ADD COLUMN IF NOT EXISTS "liveFryCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "internalPricePerFry" NUMERIC,
  ADD COLUMN IF NOT EXISTS "sacrificedMaleWeightKg" NUMERIC,
  ADD COLUMN IF NOT EXISTS "sacrificedMaleMeatPrice" NUMERIC,
  ADD COLUMN IF NOT EXISTS "toBatchId" UUID,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishTransfer_fromStage_check'
  ) THEN
    ALTER TABLE "CatfishTransfer" DROP CONSTRAINT "CatfishTransfer_fromStage_check";
  END IF;
END$$;

UPDATE "CatfishTransfer"
SET "fromStage" = 'Grow-out (Adult)'
WHERE "fromStage" = 'Melange';

UPDATE "CatfishTransfer"
SET "toStage" = 'Grow-out (Adult)'
WHERE "toStage" = 'Melange';

ALTER TABLE "CatfishTransfer"
  ADD CONSTRAINT "CatfishTransfer_fromStage_check"
  CHECK ("fromStage" IN ('Fingerlings', 'Juvenile', 'Grow-out (Adult)'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishTransfer_toStage_check'
  ) THEN
    ALTER TABLE "CatfishTransfer" DROP CONSTRAINT "CatfishTransfer_toStage_check";
  END IF;
END$$;

ALTER TABLE "CatfishTransfer"
  ADD CONSTRAINT "CatfishTransfer_toStage_check"
  CHECK ("toStage" IN ('Fingerlings', 'Juvenile', 'Grow-out (Adult)'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishTransfer_status_check'
  ) THEN
    ALTER TABLE "CatfishTransfer" DROP CONSTRAINT "CatfishTransfer_status_check";
  END IF;
END$$;

ALTER TABLE "CatfishTransfer"
  ADD CONSTRAINT "CatfishTransfer_status_check"
  CHECK ("status" IN ('PENDING', 'COMPLETED', 'CANCELLED'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishSpawningEvent_status_check'
  ) THEN
    ALTER TABLE "CatfishSpawningEvent" DROP CONSTRAINT "CatfishSpawningEvent_status_check";
  END IF;
END$$;

ALTER TABLE "CatfishSpawningEvent"
  ADD CONSTRAINT "CatfishSpawningEvent_status_check"
  CHECK ("status" IN ('Incubating', 'Completed', 'Failed'));

DO $$
BEGIN
  -- Clean up duplicate relationship if both legacy and canonical FK names exist.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_spawningEvent_fkey')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_spawningEventId_fkey') THEN
    ALTER TABLE "CatfishFryTransfer" DROP CONSTRAINT "CatfishFryTransfer_spawningEvent_fkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_toBatch_fkey')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_toBatchId_fkey') THEN
    ALTER TABLE "CatfishFryTransfer" DROP CONSTRAINT "CatfishFryTransfer_toBatch_fkey";
  END IF;

  -- Ensure canonical FK names exist (for stable Supabase embedding).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_spawningEventId_fkey'
  ) THEN
    ALTER TABLE "CatfishFryTransfer"
      ADD CONSTRAINT "CatfishFryTransfer_spawningEventId_fkey"
      FOREIGN KEY ("spawningEventId") REFERENCES "CatfishSpawningEvent"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatfishFryTransfer_toBatchId_fkey'
  ) THEN
    ALTER TABLE "CatfishFryTransfer"
      ADD CONSTRAINT "CatfishFryTransfer_toBatchId_fkey"
      FOREIGN KEY ("toBatchId") REFERENCES "CatfishBatch"("id") ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishFryTransfer_spawningEvent_unique'
  ) THEN
    ALTER TABLE "CatfishFryTransfer"
      ADD CONSTRAINT "CatfishFryTransfer_spawningEvent_unique"
      UNIQUE ("spawningEventId");
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishSale_saleType_check'
  ) THEN
    ALTER TABLE "CatfishSale" DROP CONSTRAINT "CatfishSale_saleType_check";
  END IF;
END$$;

ALTER TABLE "CatfishSale"
  ADD CONSTRAINT "CatfishSale_saleType_check"
  CHECK ("saleType" IN ('Partial Offload', 'Final Clear-Out'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CatfishSale_pricingMethod_check'
  ) THEN
    ALTER TABLE "CatfishSale" DROP CONSTRAINT "CatfishSale_pricingMethod_check";
  END IF;
END$$;

ALTER TABLE "CatfishSale"
  ADD CONSTRAINT "CatfishSale_pricingMethod_check"
  CHECK ("pricingMethod" IN ('CM', 'KG'));

-- Guardrails: cannot sell more than available population
CREATE OR REPLACE FUNCTION catfish_validate_sale_population()
RETURNS TRIGGER AS $$
DECLARE
  v_initial_stock INTEGER;
  v_total_mortality INTEGER;
  v_total_sold_before INTEGER;
  v_available INTEGER;
BEGIN
  SELECT "initialStock"
  INTO v_initial_stock
  FROM "CatfishBatch"
  WHERE "id" = NEW."batchId";

  IF v_initial_stock IS NULL THEN
    RAISE EXCEPTION 'Catfish batch not found';
  END IF;

  SELECT COALESCE(SUM("mortalityCount"), 0)
  INTO v_total_mortality
  FROM "CatfishDailyLog"
  WHERE "batchId" = NEW."batchId";

  SELECT COALESCE(SUM("quantitySold"), 0)
  INTO v_total_sold_before
  FROM "CatfishSale"
  WHERE "batchId" = NEW."batchId"
    AND (TG_OP = 'INSERT' OR "id" <> NEW."id");

  v_available := GREATEST(v_initial_stock - v_total_mortality - v_total_sold_before, 0);

  IF COALESCE(NEW."quantitySold", 0) > v_available THEN
    RAISE EXCEPTION 'Cannot sell % fish. Available stock is %.',
      NEW."quantitySold",
      v_available;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CatfishSale_validate_population_trg" ON "CatfishSale";
CREATE TRIGGER "CatfishSale_validate_population_trg"
BEFORE INSERT OR UPDATE ON "CatfishSale"
FOR EACH ROW
EXECUTE FUNCTION catfish_validate_sale_population();

-- Final Clear-Out marks batch as completed
CREATE OR REPLACE FUNCTION catfish_finalize_batch_on_clearout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."saleType" = 'Final Clear-Out' THEN
    UPDATE "CatfishBatch"
    SET "status" = 'Completed',
        "updatedAt" = NOW()
    WHERE "id" = NEW."batchId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CatfishSale_finalize_batch_trg" ON "CatfishSale";
CREATE TRIGGER "CatfishSale_finalize_batch_trg"
AFTER INSERT OR UPDATE ON "CatfishSale"
FOR EACH ROW
EXECUTE FUNCTION catfish_finalize_batch_on_clearout();

-- Hatchery fry transfer creates a fingerlings batch automatically
CREATE OR REPLACE FUNCTION catfish_create_fingerlings_batch_from_fry_transfer()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_batch_name TEXT;
BEGIN
  IF NEW."toBatchId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_batch_name := 'FRY-' || to_char(NEW."transferDate", 'YYYYMMDD') || '-' || substr(replace(NEW."id"::text, '-', ''), 1, 6);

  INSERT INTO "CatfishBatch" (
    "productionType",
    "batchName",
    "startDate",
    "initialStock",
    "initialSeedCost",
    "status",
    "createdAt",
    "updatedAt"
  ) VALUES (
    'Fingerlings',
    v_batch_name,
    NEW."transferDate",
    NEW."liveFryCount",
    NEW."totalTransferValue",
    'Active',
    NOW(),
    NOW()
  ) RETURNING "id" INTO v_batch_id;

  UPDATE "CatfishFryTransfer"
  SET "toBatchId" = v_batch_id
  WHERE "id" = NEW."id";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CatfishFryTransfer_create_batch_trg" ON "CatfishFryTransfer";
CREATE TRIGGER "CatfishFryTransfer_create_batch_trg"
AFTER INSERT ON "CatfishFryTransfer"
FOR EACH ROW
EXECUTE FUNCTION catfish_create_fingerlings_batch_from_fry_transfer();

-- Dashboard view with database-level aggregations
CREATE OR REPLACE VIEW "CatfishLiveDashboard" AS
SELECT
  b."id" AS "batchId",
  b."productionType",
  b."batchName",
  b."status",
  b."initialStock",
  b."initialSeedCost",
  (
    b."initialStock"
    - COALESCE((SELECT SUM(dl."mortalityCount") FROM "CatfishDailyLog" dl WHERE dl."batchId" = b."id"), 0)
    - COALESCE((SELECT SUM(cs."quantitySold") FROM "CatfishSale" cs WHERE cs."batchId" = b."id"), 0)
    - COALESCE((SELECT SUM(ct."quantity") FROM "CatfishTransfer" ct WHERE ct."fromBatchId" = b."id" AND ct."status" = 'COMPLETED'), 0)
    + COALESCE((SELECT SUM(ct."quantity") FROM "CatfishTransfer" ct WHERE ct."toBatchId" = b."id" AND ct."status" = 'COMPLETED'), 0)
  ) AS "currentPopulation",
  COALESCE((SELECT SUM(dl."dailyFeedCost") FROM "CatfishDailyLog" dl WHERE dl."batchId" = b."id"), 0)
    AS "totalFeedCostToDate",
  COALESCE((SELECT SUM(dl."feedAmountKg") FROM "CatfishDailyLog" dl WHERE dl."batchId" = b."id"), 0)
    AS "totalFeedGivenKg",
  (
    SELECT dl."abwGrams"
    FROM "CatfishDailyLog" dl
    WHERE dl."batchId" = b."id"
      AND dl."abwGrams" IS NOT NULL
    ORDER BY dl."logDate" DESC, dl."createdAt" DESC
    LIMIT 1
  ) AS "latestAbwGrams",
  (
    SELECT dl."averageLengthCm"
    FROM "CatfishDailyLog" dl
    WHERE dl."batchId" = b."id"
      AND dl."averageLengthCm" IS NOT NULL
    ORDER BY dl."logDate" DESC, dl."createdAt" DESC
    LIMIT 1
  ) AS "latestAverageLengthCm"
FROM "CatfishBatch" b;

-- Keep global sale table flexible for module-specific batch linkage
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "batchId" UUID;

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

-- Size pricing configuration for batch classification and seed pricing
CREATE TABLE IF NOT EXISTS public.catfish_size_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  pricing_method TEXT NOT NULL DEFAULT 'CM',
  min_cm NUMERIC NOT NULL,
  max_cm NUMERIC NOT NULL,
  price_per_piece NUMERIC,
  price_per_kg NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT catfish_size_pricing_cm_check CHECK (min_cm < max_cm),
  CONSTRAINT catfish_size_pricing_method_check CHECK (pricing_method IN ('CM', 'KG')),
  CONSTRAINT catfish_size_pricing_piece_check CHECK (price_per_piece IS NULL OR price_per_piece > 0),
  CONSTRAINT catfish_size_pricing_kg_check CHECK (price_per_kg IS NULL OR price_per_kg > 0)
);

ALTER TABLE public.catfish_size_pricing
  ADD COLUMN IF NOT EXISTS pricing_method TEXT;
ALTER TABLE public.catfish_size_pricing
  ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC;

UPDATE public.catfish_size_pricing
SET pricing_method = COALESCE(pricing_method, 'CM')
WHERE pricing_method IS NULL;

ALTER TABLE public.catfish_size_pricing
  ALTER COLUMN pricing_method SET DEFAULT 'CM';
ALTER TABLE public.catfish_size_pricing
  ALTER COLUMN pricing_method SET NOT NULL;
ALTER TABLE public.catfish_size_pricing
  ALTER COLUMN price_per_piece DROP NOT NULL;

INSERT INTO public.catfish_size_pricing (name, pricing_method, min_cm, max_cm, price_per_piece, price_per_kg, is_active)
SELECT * FROM (
  VALUES
    ('Small / Ijebu Fingerlings', 'CM', 2::numeric, 3::numeric, 25::numeric, NULL::numeric, true),
    ('Standard Fingerlings', 'CM', 3::numeric, 4::numeric, 50::numeric, NULL::numeric, true),
    ('Post-Fingerlings', 'CM', 5::numeric, 6::numeric, 80::numeric, NULL::numeric, true),
    ('Juveniles', 'CM', 6::numeric, 8::numeric, 100::numeric, NULL::numeric, true),
    ('Jumbo / Post-Juveniles', 'CM', 10::numeric, 12::numeric, 120::numeric, NULL::numeric, true),
    ('Adults', 'CM', 12::numeric, 9999::numeric, 150::numeric, NULL::numeric, true)
) AS seed(name, pricing_method, min_cm, max_cm, price_per_piece, price_per_kg, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catfish_size_pricing
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.catfish_size_pricing
    WHERE lower(name) = lower('Adults')
  ) THEN
    UPDATE public.catfish_size_pricing
    SET min_cm = 12,
        max_cm = 9999,
        pricing_method = 'CM',
        price_per_piece = 150,
        price_per_kg = NULL::numeric,
        is_active = true
    WHERE lower(name) = lower('Adults');
  ELSE
    INSERT INTO public.catfish_size_pricing (name, pricing_method, min_cm, max_cm, price_per_piece, price_per_kg, is_active)
    VALUES ('Adults', 'CM', 12::numeric, 9999::numeric, 150::numeric, NULL::numeric, true);
  END IF;
END$$;

-- RLS
ALTER TABLE "CatfishBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishDailyLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishBroodstockLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishSpawningEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatfishFryTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catfish_size_pricing ENABLE ROW LEVEL SECURITY;

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
    WHERE schemaname = 'public' AND tablename = 'CatfishBroodstockLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishBroodstockLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishSpawningEvent'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishSpawningEvent"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishFryTransfer'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishFryTransfer"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishTransfer'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishTransfer"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishDailyLog'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishDailyLog"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'CatfishSale'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
    ON "CatfishSale"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catfish_size_pricing'
      AND policyname = 'catfish_size_pricing_read_active_or_admin'
  ) THEN
    CREATE POLICY "catfish_size_pricing_read_active_or_admin"
      ON public.catfish_size_pricing
      FOR SELECT
      TO authenticated
      USING (
        is_active = true
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catfish_size_pricing'
      AND policyname = 'catfish_size_pricing_admin_insert'
  ) THEN
    CREATE POLICY "catfish_size_pricing_admin_insert"
      ON public.catfish_size_pricing
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catfish_size_pricing'
      AND policyname = 'catfish_size_pricing_admin_update'
  ) THEN
    CREATE POLICY "catfish_size_pricing_admin_update"
      ON public.catfish_size_pricing
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
        )
      );
  END IF;
END$$;

-- Indexes
WITH ranked_logs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "batchId", "logDate"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "CatfishDailyLog"
)
DELETE FROM "CatfishDailyLog" d
USING ranked_logs r
WHERE d."id" = r."id"
  AND r.rn > 1;

CREATE INDEX IF NOT EXISTS "CatfishBatch_production_status_idx"
  ON "CatfishBatch" ("productionType", "status");
CREATE INDEX IF NOT EXISTS "CatfishBatch_startDate_idx"
  ON "CatfishBatch" ("startDate");
CREATE INDEX IF NOT EXISTS "CatfishDailyLog_batch_logDate_idx"
  ON "CatfishDailyLog" ("batchId", "logDate");
CREATE UNIQUE INDEX IF NOT EXISTS "CatfishDailyLog_batch_logDate_unique_idx"
  ON "CatfishDailyLog" ("batchId", "logDate");
CREATE INDEX IF NOT EXISTS "CatfishSale_batch_saleDate_idx"
  ON "CatfishSale" ("batchId", "saleDate");
CREATE INDEX IF NOT EXISTS "CatfishTransfer_from_batch_idx"
  ON "CatfishTransfer" ("fromBatchId", "transferDate");
CREATE INDEX IF NOT EXISTS "CatfishTransfer_to_batch_idx"
  ON "CatfishTransfer" ("toBatchId", "transferDate");
CREATE INDEX IF NOT EXISTS "CatfishBroodstockLog_logDate_idx"
  ON "CatfishBroodstockLog" ("logDate");
CREATE INDEX IF NOT EXISTS "CatfishSpawningEvent_eventDate_idx"
  ON "CatfishSpawningEvent" ("eventDate");
CREATE INDEX IF NOT EXISTS "CatfishSpawningEvent_status_idx"
  ON "CatfishSpawningEvent" ("status");
CREATE INDEX IF NOT EXISTS "CatfishFryTransfer_transferDate_idx"
  ON "CatfishFryTransfer" ("transferDate");
CREATE INDEX IF NOT EXISTS "CatfishFryTransfer_toBatch_idx"
  ON "CatfishFryTransfer" ("toBatchId");
CREATE INDEX IF NOT EXISTS catfish_size_pricing_active_range_idx
  ON public.catfish_size_pricing (is_active, min_cm, max_cm);
