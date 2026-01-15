# Poultry Module (Layers) — Implementation Spec (Codex Ready)

This spec translates the boss/Gemini poultry blueprint into implementable features.
Focus: daily operations + inventory control + sales/expenses + core KPIs.

Source intent: Daily Log is the “heart” of the system; it must record egg production, mortality, feeding, and enforce “no feeding beyond available stock.”:contentReference[oaicite:1]{index=1}

---

## 0) Roles & Access (tab-based)
- POULTRY_STAFF: can create daily logs, view poultry dashboards, request items from Store, view own module reports.
- STORE_KEEPER: can approve/fulfil internal requisitions (Store → Poultry transfers), receive procurement deliveries into STORE.
- PROCUREMENT_MANAGER: can approve procurement requests (no inventory changes).
- ACCOUNTANT: can view financial summaries, enter overhead expenses, view P&L.
- ADMIN: full access, manage users/roles, activity logs.

---

## 1) Core Poultry Feature Modules

### A) Daily Log (Core Production)
The system must store a daily record per Pen/House (or per Flock if pens not used).
Required fields:
- date
- flockId (or penId)
- eggsCollectedTotal
- eggsDamaged
- (optional phase 2) egg size breakdown: small/medium/jumbo
- mortalityCount
- feedType (inventory item reference)
- feedConsumedKg
- notes

Critical behavior:
- Auto-update current bird count when mortality is recorded.:contentReference[oaicite:2]{index=2}
- System check: feeding must not exceed available stock (see inventory rules).:contentReference[oaicite:3]{index=3}

---

### B) Inventory & Store Requests (Feed Request System)
Inventory is location-scoped (Model B):
- STORE
- POULTRY
- FEED_MILL

Workflow intent:
- Stock In: record purchases/receiving for feed, medicine, egg trays.:contentReference[oaicite:4]{index=4}
- Requisition / internal request:
  Farm Manager requests → Store Manager approves → inventory decreases → cost allocated to flock.:contentReference[oaicite:5]{index=5}

Implementation mapping (recommended):
- Poultry consumes stock from POULTRY location.
- Poultry stock is replenished only via STORE → POULTRY TRANSFER.
- Procurement only creates/approves purchase requests; only STORE receiving increases STORE stock.

Optional phase 2:
- Threshold alerts (“Only 3 days of Layer Mash left”).:contentReference[oaicite:6]{index=6}

---

### C) Financial Module (Sales + Expenses + P&L)
Required:
- Sales: eggs, spent layers (old birds), manure (optional).:contentReference[oaicite:7]{index=7}
- Expenses: labour, fuel/power, maintenance, vaccination, etc.:contentReference[oaicite:8]{index=8}
- P&L: real-time = Total Sales − (COGS + Overheads).:contentReference[oaicite:9]{index=9}
- Cost per crate analysis: must compute cost to produce a crate based on feed usage and cost. :contentReference[oaicite:10]{index=10}:contentReference[oaicite:11]{index=11}

---

### D) Standard Poultry KPIs (Dashboard Metrics)
Must include:
- FCR analysis: kg feed required per dozen eggs.:contentReference[oaicite:12]{index=12}
- Hen-Day Production % (HDP).:contentReference[oaicite:13]{index=13}
- (phase 2) vaccination schedule + flock lifecycle + multi-pen comparison.:contentReference[oaicite:14]{index=14}

---

## 2) Data Model (Postgres/Supabase)

### A) Flocks
Table: `PoultryFlock`
Fields:
- id (uuid)
- name / batchName (e.g., "Batch A - Jan 2026")
- breed (optional)
- initialCount
- currentCount (store OR compute; see rule below)
- startDate / dateHatched
- status: ACTIVE | CLOSED

Gemini-intent bird count logic:
CurrentCount = InitialCount − totalMortality − soldBirds.:contentReference[oaicite:15]{index=15}

---

### B) Daily Logs
Table: `PoultryDailyLog`
Fields (minimum):
- id
- flockId
- date (unique per flock per day)
- eggsCollected
- eggsDamaged
- mortality
- feedItemId (InventoryItem reference)
- feedConsumedKg
- notes

---

### C) Inventory (Ledger-based, location-scoped)
Use your existing unified inventory system:

Tables (recommended):
- `InventoryItem` (master list: maize, layer mash, drugs, egg trays, etc.)
- `InventoryLocation` (STORE, POULTRY, FEED_MILL)
- `InventoryLedger` (all movements; has itemId + locationId + qty + unitCost + refType)

Important costing note:
Store `unitCostAtTime` on ledger OUT lines so “cost per crate” remains historically accurate if prices change (Gemini hints at this).:contentReference[oaicite:16]{index=16}

---

### D) Requisitions / Transfers
Tables:
- `StockTransferRequest` (PENDING, APPROVED, REJECTED, FULFILLED)
- `StockTransferLine` (itemId, qty)

Fulfillment action creates ledger movements:
- STORE: OUT
- POULTRY: IN
and writes `unitCostAtTime`.

---

### E) Poultry Finished Goods (Egg Stock)
Option 1 (recommended): represent eggs as an InventoryItem (`EGGS`) stocked at location POULTRY via ledger IN.
- Daily egg collection → ledger IN (quantity in eggs or crates)
- Egg sales → ledger OUT

---

### F) Sales & Expenses
If you already have a unified sales table:
- add `module = POULTRY`
- productType: EGGS | SPENT_LAYERS | MANURE
- qty, unit, unitPrice, total

Expenses:
- `Expense` with `module = POULTRY` and category

---

## 3) Required Calculations (Backend Source of Truth)

### A) Hen-Day Production (HDP %)
HDP = (eggsCollectedToday / currentLiveBirds) * 100.:contentReference[oaicite:17]{index=17}

Warning rule (optional):
- If HDP < 85% during peak lay → flag alert.:contentReference[oaicite:18]{index=18}

### B) Feed per Bird (grams)
feedPerBirdG = (feedConsumedKg * 1000) / currentLiveBirds.:contentReference[oaicite:19]{index=19}

### C) FCR per Dozen Eggs
FCR = totalFeedKg / (totalEggs / 12).:contentReference[oaicite:20]{index=20}

### D) Cost per Crate (feed-driven cost)
- crates = totalEggs / 30
- totalFeedCost = Σ(feedConsumedKg * unitCostAtTime)
- costPerCrate = totalFeedCost / crates

Gemini math summary: crates = eggs/30 and feed cost uses price/kg from inventory.:contentReference[oaicite:21]{index=21}

---

## 4) Workflows (What happens when user clicks Save)

### A) Save Daily Log (Transaction)
Input: eggs, mortality, feed type, feed kg.
Steps:
1) Validate flock exists.
2) Validate available POULTRY stock for feedItem >= feedConsumedKg.
   - If insufficient → block save with error (do not partially update).
   (Gemini intent: system must not allow recording feed if store is empty / insufficient.):contentReference[oaicite:22]{index=22}
3) Write daily log row.
4) Write inventory ledger OUT at POULTRY for feed consumption
   - store unitCostAtTime from valuation method
5) Update flock currentCount if mortality > 0 (or compute currentCount from events).

All of the above must be atomic (single DB transaction).

---

### B) Request Feed (Poultry → Store)
1) Poultry staff creates StockTransferRequest to move items from STORE → POULTRY.
2) Store keeper approves and fulfills:
   - ledger STORE OUT + POULTRY IN
   - cost allocated to flock if provided.:contentReference[oaicite:23]{index=23}

---

### C) Receive Procurement (Procurement → Store)
1) Store creates procurement request (PENDING) — no stock change.
2) Procurement manager approves (APPROVED) — no stock change.
3) Store marks received (RECEIVED) — ledger STORE IN + unit cost captured.

(“Receive Stock” is the only step that changes STORE inventory.)

---

### D) Record Egg Production (optional separation)
Option 1: eggs are implied from daily log and posted to finished stock automatically on save.
- When saving daily log: create ledger IN for EGGS at POULTRY location.

Option 2: separate “Egg Stock Entry” page.
(Option 1 is simpler and matches the daily workflow.)

---

### E) Sales
- Egg sale creates ledger OUT for EGGS from POULTRY.
- Bird sale reduces flock count (if you track spent layers as sales).:contentReference[oaicite:24]{index=24}

---

## 5) UI Pages / Routes (App Router)

Under `(main)`:
- `/poultry/dashboard`
- `/poultry/flocks`
- `/poultry/daily-log`
- `/poultry/inventory` (location=POULTRY)
- `/poultry/requests` (create transfer requests)
- `/poultry/sales`
- `/poultry/expenses`

Store/Procurement:
- `/store/inventory` (location=STORE)
- `/store/requests` (fulfil poultry/feedmill transfers)
- `/procurement/requests` (approve purchases)

---

## 6) MVP Checklist (Done when)
- Can create a flock and see current count.
- Can enter daily logs (eggs + mortality + feed kg/type).
- System blocks feeding if poultry inventory is insufficient.:contentReference[oaicite:25]{index=25}
- Saving daily log deducts POULTRY feed stock.
- Eggs recorded increase egg stock (POULTRY).
- Can record egg sales and see stock reduce.
- Dashboard shows HDP%, FCR/dozen, mortality, cost per crate, basic P&L.:contentReference[oaicite:26]{index=26}

---

## 7) Non-Goals (Phase 2)
- Vaccination & medication calendar/scheduling.:contentReference[oaicite:27]{index=27}
- Full flock lifecycle tracking (D.O.C → Point of lay → spent).:contentReference[oaicite:28]{index=28}
- Multi-pen comparisons / advanced analytics.:contentReference[oaicite:29]{index=29}
- Threshold alerts / days-of-stock warning.:contentReference[oaicite:30]{index=30}

---
