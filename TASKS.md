# Catfish Module — Production, Inventory, Sales & P&L (Codex README)

This module adds **Catfish farming operations** into the Farm Management System.

The Catfish module must:
- Track ponds and production batches
- Track feed usage and mortality
- Calculate Cost of Production (COGS)
- Track harvest and sales
- Generate Profit & Loss per batch and per period

This module follows the same **Batch-Based Accounting Model** used in:
- Feed Mill
- Poultry
- BSF

---

## 1. BUSINESS OVERVIEW (REAL-WORLD FLOW)

Catfish farming operates in **batches**, usually per pond.

High-level flow:

1. Pond is stocked with fingerlings
2. Fish are fed daily (feed has cost)
3. Mortality occurs over time
4. Fish grow over weeks/months
5. Pond is harvested (partial or full)
6. Fish are sold
7. Profit or loss is calculated

Key rule:
> **You cannot calculate profit without tracking feed usage and mortality per batch**

---

## 2. CORE CONCEPT: CATFISH BATCH

A **Catfish Batch** represents one production cycle in one pond.

### Batch starts when:
- Fingerlings are stocked into a pond

### Batch ends when:
- Pond is fully harvested and closed

Each batch must track:
- Inputs (fingerlings, feed)
- Outputs (harvested fish)
- Losses (mortality)
- Revenue (sales)
- Costs (COGS)

---

## 3. MODULE ROUTES / TABS

Add sidebar parent: **Catfish**

Routes:
- `/catfish/dashboard`
- `/catfish/ponds`
- `/catfish/batches`
- `/catfish/batches/[id]`
- `/catfish/harvest`
- `/catfish/sales`
- `/catfish/reports/pnl`

---

## 4. ROLES & ACCESS

Follow tab-based role control.

Roles:
- ADMIN → full access
- CATFISH_STAFF → ponds, batches, feeding, harvest
- ACCOUNTANT → sales, reports
- STORE_KEEPER → feed inventory only (read/write)
- PROCUREMENT_MANAGER → procurement only

---

## 5. DATA MODEL (WHAT CODEX MUST CREATE)

### 5.1 Catfish Pond
Represents a physical pond.

Table: `CatfishPond`
- id (uuid)
- name (text) e.g. "Pond A"
- capacityFish (int)
- waterType (enum: EARTHEN, CONCRETE, TANK)
- status (ACTIVE, MAINTENANCE)
- createdAt, updatedAt

---

### 5.2 Catfish Batch (Core Table)

Table: `CatfishBatch`
- id (uuid)
- batchCode (text unique) e.g. CAT-2024-001
- pondId (fk → CatfishPond)
- startDate (date)
- initialFingerlingsCount (int)
- fingerlingUnitCost (numeric)
- totalFingerlingCost (computed)
- status (GROWING, HARVESTING, CLOSED)
- notes
- createdAt, updatedAt

---

### 5.3 Daily Feeding Log (COGS driver)

Table: `CatfishFeedLog`
- id
- batchId (fk)
- date (date)
- feedProductId (fk → Feed Mill finished feed)
- quantityKg (numeric)
- unitCostAtTime (numeric)
- totalCost (computed)
- createdAt

Rules:
- Feed must come from **Feed Mill finished goods**
- Deduct feed stock from FEED_MILL
- Add cost to batch COGS

---

### 5.4 Mortality Log

Table: `CatfishMortalityLog`
- id
- batchId (fk)
- date
- deadCount
- cause (text)
- notes

Used for:
- Survival rate
- Production accuracy

---

### 5.5 Harvest Log

Table: `CatfishHarvest`
- id
- batchId (fk)
- date
- quantityKg
- averageFishWeightKg
- notes

Rules:
- Partial harvests allowed
- Final harvest closes batch

---

### 5.6 Sales

Option A (Recommended):
Reuse existing `Sales` table with:
- module = 'CATFISH'
- batchId reference

Fields:
- product = 'Live Catfish'
- quantityKg
- unitPrice
- totalRevenue
- customer
- paymentStatus

---

## 6. INVENTORY & COST FLOW

### Feed Source
- Catfish feed MUST come from Feed Mill finished goods
- No direct Store → Catfish feeding

Flow:
Feed Mill Finished Goods
↓
Catfish Feed Log
↓
Batch COGS

### COGS Components
- Fingerlings cost
- Feed cost
- Optional:
  - Medication
  - Water treatment
  - Labor (later phase)

---

## 7. PROFIT & LOSS LOGIC

### Profit Per Batch

Formula:
FCR = Total Feed Used (kg) / Total Fish Harvested (kg)


2. Survival Rate


Survival % = (Harvested Fish Count / Initial Fingerlings) × 100

3. Average Fish Weight at Harvest

4. Cost per Kg of Fish
Cost per Kg = Total Batch Cost / Total Harvested Kg

5. Batch Profitability
- Profit per batch
- Profit per pond

---

## 9. DAILY OPERATION FLOW (STAFF)

1. Start batch (stock fingerlings)
2. Log daily feeding
3. Log mortality when it occurs
4. Harvest fish (partial or final)
5. Record sales
6. System auto-calculates profit

---

## 10. SQL RULES (MANDATORY)

All SQL MUST be:
- Idempotent
- Safe on re-run

Rules:
- `CREATE TABLE IF NOT EXISTS`
- Enums via `DO $$ IF NOT EXISTS`
- Unique constraints via `CREATE UNIQUE INDEX IF NOT EXISTS`
- Policies checked via `pg_policies`

This rule applies to:
- Catfish
- BSF
- Poultry
- Any future module

---

## 11. MVP SCOPE (PHASE 1)

Must-have:
- Ponds
- Batches
- Feed logs
- Mortality
- Harvest
- Sales
- Batch P&L

Phase 2:
- Medication tracking
- Water quality logs
- Automated alerts
- Mobile-first UI

---

## 12. SUCCESS CRITERIA

The Catfish module is considered DONE when:
- Staff can run production without spreadsheets
- Feed cost is traceable per batch
- Profit per pond is visible
- Data matches real farm operations

---

## FINAL NOTE

This module must **feel boring and accurate**, not fancy.

Accuracy > Automation  
Truth > UI polish  

Build it like an accountant and a farm manager will use it daily.
