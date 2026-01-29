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