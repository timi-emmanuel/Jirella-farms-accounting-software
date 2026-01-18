# BSF Module (Insectorium + Larvarium) — Implementation README (for Codex)

This module adds **Black Soldier Fly (BSF)** operations to the farm system.

Business structure:
- **Insectorium** = breeding cycle (pupae → eggs → pupae shells byproduct)
- **Larvarium** = growth + production cycle (5-DOL → wet larvae → processing outputs)

Products:
- Primary: **Wet larvae**, **Pupae shells**
- Processed: **Dry larvae**, **Larvae oil**, **Larvae cake**, **Frass**
Inputs (COGS): **PKC**, **Poultry waste** (even if “free”, record transport/labor cost).:contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}

Goal:
- Track batches end-to-end
- Track inventory usage by batch (COGS)
- Track yields + processing conversions
- Track sales
- Generate **Profit & Loss (P&L)** + KPIs (FCR, yields, oil extraction, breeding efficiency, survival proxy):contentReference[oaicite:5]{index=5}:contentReference[oaicite:6]{index=6}

---

## 1. Tabs / Routes

Add sidebar parent: **BSF**
- `/bsf/dashboard`
- `/bsf/procurement` (inputs: PKC, poultry waste, additives, fuel/energy optional):contentReference[oaicite:7]{index=7}
- `/bsf/insectorium` (daily breeding logs):contentReference[oaicite:8]{index=8}
- `/bsf/larvarium/batches` (create/manage larvarium batches):contentReference[oaicite:9]{index=9}
- `/bsf/larvarium/batches/[id]` (batch detail: feed log, harvest, processing)
- `/bsf/harvest` (optional shortcut view across batches):contentReference[oaicite:10]{index=10}
- `/bsf/processing` (optional shortcut view across batches):contentReference[oaicite:11]{index=11}
- `/bsf/sales` (sell products):contentReference[oaicite:12]{index=12}
- `/bsf/reports/pnl` (monthly P&L)
- `/bsf/reports/batch-pnl` (profit per batch)
- `/bsf/kpis` (FCR, yields, etc.)

---

## 2. Roles / Access

Keep it simple (align with your role-based tabs system):
- ADMIN: full access
- BSF_STAFF: Insectorium, Larvarium, Harvest, Processing
- ACCOUNTANT: Sales + Reports
- PROCUREMENT_MANAGER: Procurement only

---

## 3. Core Domain Model (What must exist)

### 3.1 Two batch types (non-negotiable)
A) Insectorium cycle (breeding)
- Trigger: pupae moved into breeding cage
- Inputs: pupae_loaded_kg
- Outputs (daily): eggs_harvested_grams, pupae_shells_harvested_kg
- Waste: mortality_rate / notes
Key metric: grams of eggs per kg pupae.:contentReference[oaicite:13]{index=13}

B) Larvarium batch (production)
- Trigger: 5-DOL inoculated into substrate
- Has Batch ID: e.g. BAT-2024-001
- Feed log: PKC + poultry waste usage (daily or total)
- Duration: until harvest
- Outputs (harvest): wet larvae + frass + residue waste
- Processing: drying, pressing/extraction producing dry larvae + cake + oil:contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}

---

## 4. Database (Supabase/Postgres) — Tables to Create

NOTE: The Gemini doc proposes a schema conceptually like:
- raw materials inventory + procurement log
- insectorium logs
- larvarium batches
- harvest yields
- processing runs
- sales transactions:contentReference[oaicite:16]{index=16}:contentReference[oaicite:17]{index=17}

### Implement in OUR system style:
We already have “Store/Inventory/Procurement” architecture in the app.
So for BSF, we should:
- Reuse the **unified Store inventory ledger** for PKC + poultry waste inputs
- Add BSF-specific tables for:
  - insectorium logs
  - larvarium batches
  - harvest yields
  - processing runs
  - BSF sales lines (or reuse Sales table with product type + batch reference)

### Minimal tables (recommended)
1) `BsfInsectoriumLog`
- id (uuid)
- date (date) UNIQUE (per-day record for breeding floor)
- pupaeLoadedKg (numeric)
- eggsHarvestedGrams (numeric)
- pupaeShellsHarvestedKg (numeric)
- mortalityRate (numeric)
- notes (text)
- createdBy (uuid users.id)
- createdAt, updatedAt

2) `BsfLarvariumBatch`
- id (uuid)
- batchCode (text unique) e.g. BAT-2024-001:contentReference[oaicite:18]{index=18}
- startDate (date)
- initialLarvaeWeightGrams (numeric):contentReference[oaicite:19]{index=19}
- substrateMixRatio (text) e.g. 60% PKC / 40% Waste:contentReference[oaicite:20]{index=20}
- status (enum: GROWING, HARVESTED, PROCESSED, CLOSED):contentReference[oaicite:21]{index=21}
- harvestDate (date, nullable)
- notes (text)
- createdBy, createdAt, updatedAt

3) `BsfBatchFeedLog`
(so we can cost inputs by batch precisely)
- id
- batchId (fk BsfLarvariumBatch.id)
- date
- pkcKg (numeric)
- poultryWasteKg (numeric)
- poultryWasteCostOverride (numeric nullable) (if you want explicit cost per log)
- notes

4) `BsfHarvestYield`
- id
- batchId (unique fk) 1:1 with batch
- wetLarvaeKg (numeric):contentReference[oaicite:22]{index=22}
- frassKg (numeric):contentReference[oaicite:23]{index=23}
- residueWasteKg (numeric):contentReference[oaicite:24]{index=24}
- createdAt

5) `BsfProcessingRun`
- id
- batchId (fk)
- processType (enum: DRYING, PRESSING_EXTRACTION):contentReference[oaicite:25]{index=25}
- inputWeightKg (numeric)
- outputDryLarvaeKg (numeric)
- outputLarvaeOilLiters (numeric)
- outputLarvaeCakeKg (numeric):contentReference[oaicite:26]{index=26}
- energyCostEstimate (numeric nullable):contentReference[oaicite:27]{index=27}
- runAt (timestamp)
- createdBy

6) Sales (choose one)
Option A (recommended): reuse your existing Sales model
- Add fields: module = 'BSF', productType enum, batchId reference optional
Option B: `BsfSale`
- id, date, customerName, productSold, quantity, unitPrice, totalRevenue, paymentStatus, batchId(optional):contentReference[oaicite:28]{index=28}

---

## 5. Inventory & COGS Rules (Important)

COGS must be tracked **when used**, not just when bought.:contentReference[oaicite:29]{index=29}

Rule:
- PKC purchase updates store inventory average cost.
- Poultry waste might be “free” but we still record acquisition cost (transport/labor).:contentReference[oaicite:30]{index=30}

Batch cost allocation:
- batchFeedCost = (PKC used * PKC avg cost/kg) + (Waste used * waste cost/kg) + (energy cost estimates)
This aligns with: (total_pkc_consumed_kg * avg_cost) + (total_waste_consumed_kg * cost_of_waste) + energy costs.:contentReference[oaicite:31]{index=31}

Implementation detail:
- When “log feed to batch”, also write inventory ledger OUT entries for PKC/Waste (or at least validate availability).

---

## 6. Production Workflow (What staff does)

### Step 1 — Insectorium daily logs
Staff logs:
- pupae loaded
- eggs harvested (grams)
- pupae shells harvested (kg)
- mortality
Goal: trend breeding efficiency.:contentReference[oaicite:32]{index=32}

### Step 2 — Start larvarium batch
Create batch with:
- batchCode
- startDate
- initial larvae grams
- substrate ratio:contentReference[oaicite:33]{index=33}

### Step 3 — Feed logs (daily or total)
Record PKC/Waste fed to that batch.
This is the primary source of COGS.

### Step 4 — Harvest
At harvest, record:
- wet larvae (kg)
- frass (kg)
- residue waste (kg):contentReference[oaicite:34]{index=34}

### Step 5 — Processing runs
Two processing types:
A) Drying: wet larvae → dry larvae (drying ratio):contentReference[oaicite:35]{index=35}
B) Pressing/Extraction: dry larvae → cake + oil (oil extraction rate):contentReference[oaicite:36]{index=36}

Note:
- Pupae shells are handled from Insectorium logs (separate byproduct).:contentReference[oaicite:37]{index=37}

### Step 6 — Sales
Sell:
- Dry larvae
- Oil
- Cake
- Frass
- Shells
Each sale should optionally reference a batchId for traceability (at least for larvae-derived products).:contentReference[oaicite:38]{index=38}

---

## 7. Financial Logic (Batch P&L + Monthly P&L)

### 7.1 Profit per batch (core formula)
Profit = Revenue(from products) - (Direct Costs + Allocated Overhead):contentReference[oaicite:39]{index=39}

Revenue is sum:
- dry larvae kg * unit price
- oil liters * unit price
- cake kg * unit price
- frass kg * unit price
- shells kg * unit price:contentReference[oaicite:40]{index=40}

Costs:
- direct feed costs (PKC + waste)
- labor allocation (optional)
- energy costs for drying/pressing (optional):contentReference[oaicite:41]{index=41}

### 7.2 Monthly P&L report
Gemini provided a sample monthly P&L query concept (revenue vs feed costs), but it uses MySQL `DATE_FORMAT`.
We should implement this using Postgres date_trunc + joins in our app.

Required output columns:
- Month
- Total Revenue
- PKC Cost
- Waste Cost
- Total COGS
- Gross Profit (Revenue - COGS):contentReference[oaicite:42]{index=42}

---

## 8. KPIs to display on BSF dashboard

Implement these 5 KPIs as cards:

1) FCR (Feed Conversion Ratio)
FCR = Total wet larvae harvested (kg) / total feed input (kg)
Target: 1.5–2.0:contentReference[oaicite:43]{index=43}

2) Yield per batch
Show bar chart: wet larvae kg for last 10 batches:contentReference[oaicite:44]{index=44}

3) Oil extraction efficiency
ExtractionRate(%) = (Liters of oil recovered / weight of dry larvae pressed) * 100:contentReference[oaicite:45]{index=45}

4) Breeding efficiency
Breeding KPI ~ grams eggs harvested per (kg pupae loaded) (or per cage if cages are modeled):contentReference[oaicite:46]{index=46}:contentReference[oaicite:47]{index=47}

5) Survival proxy / growth multiple
Example heuristic: input egg grams vs expected larvae kg output trend:contentReference[oaicite:48]{index=48}

---

## 9. MVP Roadmap (what to build first)

Phase 1 (MVP):
- Material inventory logging (PKC/Waste):contentReference[oaicite:49]{index=49}
- Batch tracking (insectorium logs + larvarium batches):contentReference[oaicite:50]{index=50}
- Harvest + Processing logs:contentReference[oaicite:51]{index=51}
- Sales ledger:contentReference[oaicite:52]{index=52}
- Basic P&L report:contentReference[oaicite:53]{index=53}

Deliverable:
A working admin panel replacing spreadsheets.:contentReference[oaicite:54]{index=54}

---

## 10. Task List (Codex should implement)

### UI
- [ ] Create BSF sidebar and routes
- [ ] Insectorium daily log form + table (1/day entries)
- [ ] Larvarium batch list (AG Grid) + create batch modal
- [ ] Batch detail page:
  - [ ] feed logs (daily rows)
  - [ ] harvest form (1 per batch)
  - [ ] processing runs form + table
- [ ] BSF sales page (simple add sale modal + table)
- [ ] BSF P&L report page:
  - [ ] monthly P&L table
  - [ ] per-batch P&L view
- [ ] BSF dashboard KPI cards + charts (optional charts after MVP)

### Backend (Supabase)
- [ ] Create tables + RLS policies aligned with role access
- [ ] Write server-side actions or API routes for:
  - [ ] create batch, update batch status
  - [ ] write feed log + inventory deduction
  - [ ] write harvest yield
  - [ ] write processing run
  - [ ] write sale + stock deduction (if stock tracking is enabled for BSF products)
- [ ] Add activity log entries for all actions (create/update/delete)

---

## 11. Rules (must follow)

- Store raw inputs (weights, costs, usage). Derived totals are computed.
- COGS is calculated based on **usage**, not purchase timing.:contentReference[oaicite:55]{index=55}
- Batch is the “unit of truth” for profitability: all costs + revenues should tie to a batch where possible.:contentReference[oaicite:56]{index=56}:contentReference[oaicite:57]{index=57}
- Processing is a conversion step; track input/output ratios for audits.:contentReference[oaicite:58]{index=58}
